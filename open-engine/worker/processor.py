import asyncio
import gzip
import hashlib
import json
import os
import socket

import asyncpg
from bs4 import BeautifulSoup
from minio import Minio

from ai_router import extract_with_ai
from date_normalization import normalize_candidate_dates
from deterministic_extractors import extract_deterministic_candidates

DATABASE_URL = os.environ["DATABASE_URL"]
WORKER_ID = f"process-{socket.gethostname()}"
S3_ENDPOINT = os.environ["S3_ENDPOINT"].replace("http://", "").replace("https://", "")
S3_SECURE = os.environ["S3_ENDPOINT"].startswith("https://")
S3_BUCKET = os.environ["S3_BUCKET"]
AI_FALLBACK_ENABLED = os.getenv("AI_FALLBACK_ENABLED", "true").lower() in {"1", "true", "yes", "on"}

minio = Minio(
    S3_ENDPOINT,
    access_key=os.environ["S3_ACCESS_KEY"],
    secret_key=os.environ["S3_SECRET_KEY"],
    secure=S3_SECURE,
)

TYPE_MAP = {
    "scholarlyarticle": "publication",
    "article": "publication",
    "jobposting": "opportunity",
    "event": "event",
    "educationevent": "event",
    "course": "programme",
    "educationaloccupationalprogram": "programme",
    "person": "researcher",
    "organization": "institution",
    "collegeoruniversity": "institution",
    "researchorganization": "institution",
    "project": "project",
    "researchproject": "project",
}


def iter_jsonld(value):
    if isinstance(value, list):
        for item in value:
            yield from iter_jsonld(item)
    elif isinstance(value, dict):
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from iter_jsonld(item)
        yield value


def types_of(node):
    raw = node.get("@type")
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [value for value in raw if isinstance(value, str)]
    return []


def best_title(node):
    for key in ("headline", "name", "title"):
        value = node.get(key)
        if isinstance(value, str) and len(value.strip()) >= 3:
            return " ".join(value.split())[:500]
    return None


def extract_candidates(html: str, source_url: str):
    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    for script in soup.find_all("script", attrs={"type": lambda v: v and "ld+json" in v.lower()}):
        text = script.string or script.get_text() or ""
        try:
            parsed = json.loads(text)
        except Exception:
            continue
        for node in iter_jsonld(parsed):
            mapped = None
            for raw_type in types_of(node):
                mapped = TYPE_MAP.get(raw_type.lower())
                if mapped:
                    break
            title = best_title(node)
            if not mapped or not title:
                continue
            external = node.get("@id") or node.get("url") or source_url
            if isinstance(external, dict):
                external = external.get("@id") or external.get("url")
            external_key = hashlib.sha256(f"{mapped}|{external}|{title}".encode()).hexdigest()
            country = None
            location = node.get("jobLocation") or node.get("location")
            if isinstance(location, dict):
                address = location.get("address")
                if isinstance(address, dict):
                    country = address.get("addressCountry")
            confidence = 0.90 if mapped in {"opportunity", "publication", "event"} else 0.82
            candidates.append({
                "entity_type": mapped,
                "external_key": external_key,
                "title": title,
                "country": country if isinstance(country, str) else None,
                "confidence": confidence,
                "source_url": source_url,
                "verification_status": "auto_discovered",
                "data": node,
            })
    return candidates[:40]


async def read_object(key: str) -> str:
    response = await asyncio.to_thread(minio.get_object, S3_BUCKET, key)
    try:
        compressed = await asyncio.to_thread(response.read)
    finally:
        await asyncio.to_thread(response.close)
        await asyncio.to_thread(response.release_conn)
    return gzip.decompress(compressed).decode("utf-8", errors="replace")


async def claim(pool):
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT id, payload, attempts, max_attempts
                FROM ingestion_tasks
                WHERE task_type='EXTRACT'
                  AND status IN ('QUEUED','RETRY')
                  AND next_attempt_at <= now()
                ORDER BY priority DESC, next_attempt_at, id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
                """
            )
            if not row:
                return None
            await conn.execute(
                "UPDATE ingestion_tasks SET status='PROCESSING', locked_at=now(), locked_by=$2, attempts=attempts+1, updated_at=now() WHERE id=$1",
                row["id"], WORKER_ID,
            )
            return dict(row)


async def fail(pool, task_id, message):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT attempts, max_attempts FROM ingestion_tasks WHERE id=$1", task_id)
        dead = row and row["attempts"] >= row["max_attempts"]
        await conn.execute(
            """
            UPDATE ingestion_tasks
            SET status=$2, error=$3,
                next_attempt_at=now() + (least(3600, power(2, attempts)::int * 30) * interval '1 second'),
                updated_at=now()
            WHERE id=$1
            """,
            task_id, "DEAD" if dead else "RETRY", str(message)[:1000],
        )


async def materialize(pool, task):
    payload = task["payload"] or {}
    snapshot_id = payload.get("snapshot_id")
    try:
        async with pool.acquire() as conn:
            snapshot = await conn.fetchrow(
                "SELECT source_url, object_key, content_hash FROM source_snapshots WHERE id=$1",
                snapshot_id,
            )
        if not snapshot or not snapshot["object_key"]:
            raise RuntimeError("snapshot body unavailable")
        html = await read_object(snapshot["object_key"])
        candidates = extract_candidates(html, snapshot["source_url"])
        extraction_path = "structured"

        if not candidates:
            candidates = extract_deterministic_candidates(html, snapshot["source_url"])
            extraction_path = "deterministic" if candidates else "none"

        if not candidates and AI_FALLBACK_ENABLED:
            candidates = await extract_with_ai(html, snapshot["source_url"])
            extraction_path = "ai" if candidates else "none"

        candidates = [normalize_candidate_dates(candidate) for candidate in candidates]

        async with pool.acquire() as conn:
            async with conn.transaction():
                for candidate in candidates:
                    verification_status = candidate.get("verification_status", "auto_discovered")
                    existing = await conn.fetchrow(
                        "SELECT id, data FROM canonical_entities WHERE entity_type=$1 AND external_key=$2",
                        candidate["entity_type"], candidate["external_key"],
                    )
                    entity_id = await conn.fetchval(
                        """
                        INSERT INTO canonical_entities(
                            entity_type, external_key, title, country, verification_status,
                            confidence, source_url, published_at, data
                        ) VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8::jsonb)
                        ON CONFLICT (entity_type, external_key) WHERE external_key IS NOT NULL
                        DO UPDATE SET
                            title=excluded.title,
                            country=coalesce(excluded.country, canonical_entities.country),
                            verification_status=CASE
                                WHEN canonical_entities.verification_status='verified' THEN 'verified'
                                ELSE excluded.verification_status
                            END,
                            confidence=greatest(canonical_entities.confidence, excluded.confidence),
                            source_url=excluded.source_url,
                            last_seen_at=now(),
                            last_changed_at=CASE WHEN canonical_entities.data IS DISTINCT FROM excluded.data THEN now() ELSE canonical_entities.last_changed_at END,
                            data=excluded.data,
                            updated_at=now()
                        RETURNING id
                        """,
                        candidate["entity_type"], candidate["external_key"], candidate["title"],
                        candidate["country"], verification_status, candidate["confidence"],
                        candidate["source_url"], json.dumps(candidate["data"]),
                    )
                    await conn.execute(
                        """
                        WITH updated AS (
                            UPDATE record_sources
                            SET content_hash=$3,
                                last_checked_at=now(),
                                verification_status=CASE
                                    WHEN verification_status='verified' THEN 'verified'
                                    ELSE $4
                                END,
                                confidence=greatest(confidence, $5),
                                evidence=$6::jsonb
                            WHERE id = (
                                SELECT id
                                FROM record_sources
                                WHERE entity_id=$1
                                  AND source_url=$2
                                  AND is_primary=true
                                ORDER BY discovered_at, id
                                LIMIT 1
                            )
                            RETURNING id
                        )
                        INSERT INTO record_sources(
                            entity_id, source_url, content_hash, last_checked_at,
                            verification_status, confidence, is_primary, evidence
                        )
                        SELECT $1,$2,$3,now(),$4,$5,true,$6::jsonb
                        WHERE NOT EXISTS (SELECT 1 FROM updated)
                        """,
                        entity_id, candidate["source_url"], snapshot["content_hash"],
                        verification_status, candidate["confidence"],
                        json.dumps({
                            "extraction_path": extraction_path,
                            "evidence": candidate.get("data", {}).get("evidence") if isinstance(candidate.get("data"), dict) else None,
                        }),
                    )
                    changed = existing is None or existing["data"] != candidate["data"]
                    if changed:
                        prefix = "NEW" if existing is None else "UPDATED"
                        signal_type = f"{prefix}_{candidate['entity_type'].upper()}"
                        signal_data = {
                            "snapshot_id": snapshot_id,
                            "extraction_path": extraction_path,
                        }
                        candidate_data = candidate.get("data")
                        if isinstance(candidate_data, dict):
                            for key in ("start_date", "end_date", "posted_date", "deadline_date"):
                                if candidate_data.get(key):
                                    signal_data[key] = candidate_data[key]
                        await conn.execute(
                            """
                            INSERT INTO signals(
                                signal_type, entity_id, entity_type, title, country,
                                importance_score, confidence, verification_status, source_url, data
                            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
                            """,
                            signal_type, entity_id, candidate["entity_type"], candidate["title"],
                            candidate["country"], 55 if existing is None else 35,
                            candidate["confidence"], verification_status, candidate["source_url"],
                            json.dumps(signal_data),
                        )
                await conn.execute(
                    "UPDATE ingestion_tasks SET status='DONE', error=NULL, updated_at=now() WHERE id=$1",
                    task["id"],
                )
        print(f"EXTRACT task={task['id']} path={extraction_path} candidates={len(candidates)}")
    except Exception as exc:
        await fail(pool, task["id"], exc)
        print(f"EXTRACT_FAILED task={task['id']} error={exc}")


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=8)
    while True:
        task = await claim(pool)
        if not task:
            await asyncio.sleep(2)
            continue
        await materialize(pool, task)


if __name__ == "__main__":
    asyncio.run(main())
