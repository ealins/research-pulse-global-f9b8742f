import asyncio
import gzip
import hashlib
import ipaddress
import os
import re
import socket
import urllib.parse
import urllib.robotparser
import uuid
from datetime import datetime, timezone

import asyncpg
import boto3
import httpx
from botocore.config import Config

DATABASE_URL = os.environ["DATABASE_URL"]
WORKER_CONCURRENCY = max(1, min(32, int(os.getenv("WORKER_CONCURRENCY", "4"))))
FETCH_TIMEOUT = float(os.getenv("FETCH_TIMEOUT_SECONDS", "25"))
USER_AGENT = "GeoAcademicBot/1.0 (+https://geoacademic.app)"
WORKER_ID = f"fetch-{socket.gethostname()}"
S3_ENDPOINT = os.environ["S3_ENDPOINT"].rstrip("/")
S3_BUCKET = os.environ["S3_BUCKET"]


def infer_s3_region() -> str:
    explicit = os.getenv("S3_REGION")
    if explicit:
        return explicit
    db_host = urllib.parse.urlsplit(DATABASE_URL).hostname or ""
    match = re.match(r"^aws-\d+-(.+?)\.pooler\.supabase\.com$", db_host)
    if match:
        return match.group(1)
    return "us-east-1"


S3_REGION = infer_s3_region()
s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=os.environ["S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["S3_SECRET_KEY"],
    region_name=S3_REGION,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)
robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


async def ensure_bucket():
    try:
        await asyncio.to_thread(s3.head_bucket, Bucket=S3_BUCKET)
    except Exception as exc:
        raise RuntimeError(
            f"S3 bucket check failed for {S3_BUCKET!r} in region {S3_REGION}: {exc}"
        ) from exc


async def assert_public_url(url: str):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("unsupported URL")
    if parsed.username or parsed.password:
        raise ValueError("credential-bearing URL is not allowed")
    infos = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, parsed.port or 443)
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved or address.is_multicast:
            raise ValueError("private network target is not allowed")


async def robots_allowed(client: httpx.AsyncClient, url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    parser = robots_cache.get(origin)
    if parser is None:
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(f"{origin}/robots.txt")
        try:
            response = await client.get(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT})
            parser.parse(response.text.splitlines() if response.is_success else [])
        except Exception:
            parser.parse([])
        robots_cache[origin] = parser
    return parser.can_fetch(USER_AGENT, url)


async def claim_task(pool: asyncpg.Pool):
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT id, payload, attempts, max_attempts
                FROM ingestion_tasks
                WHERE task_type = 'FETCH'
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
                """
                UPDATE ingestion_tasks
                SET status='PROCESSING', locked_at=now(), locked_by=$2,
                    attempts=attempts+1, updated_at=now()
                WHERE id=$1
                """,
                row["id"], WORKER_ID,
            )
            return dict(row)


async def store_snapshot(body: bytes, content_hash: str) -> str:
    now = datetime.now(timezone.utc)
    key = f"raw/{now:%Y/%m/%d}/{content_hash}.html.gz"
    compressed = gzip.compress(body, compresslevel=6)
    await asyncio.to_thread(
        s3.put_object,
        Bucket=S3_BUCKET,
        Key=key,
        Body=compressed,
        ContentType="application/gzip",
    )
    return key


async def complete_task(pool: asyncpg.Pool, task_id: int, *, success: bool, error: str | None = None):
    async with pool.acquire() as conn:
        if success:
            await conn.execute(
                "UPDATE ingestion_tasks SET status='DONE', error=NULL, updated_at=now() WHERE id=$1",
                task_id,
            )
        else:
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
                task_id, "DEAD" if dead else "RETRY", (error or "unknown error")[:1000],
            )


async def process_fetch(pool: asyncpg.Pool, client: httpx.AsyncClient, task: dict):
    payload = task["payload"] or {}
    url = str(payload.get("url") or "").strip()
    raw_source_id = payload.get("source_id")
    source_id = uuid.UUID(str(raw_source_id)) if raw_source_id else None
    if not url:
        await complete_task(pool, task["id"], success=False, error="FETCH task has no url")
        return

    try:
        await assert_public_url(url)
        if not await robots_allowed(client, url):
            raise RuntimeError("disallowed by robots.txt")

        async with pool.acquire() as conn:
            previous = await conn.fetchrow(
                """
                SELECT content_hash, etag, last_modified
                FROM source_snapshots
                WHERE source_url=$1
                ORDER BY fetched_at DESC
                LIMIT 1
                """,
                url,
            )

        headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8"}
        if previous and previous["etag"]:
            headers["If-None-Match"] = previous["etag"]
        if previous and previous["last_modified"]:
            headers["If-Modified-Since"] = previous["last_modified"]

        response = await client.get(url, headers=headers)
        if response.status_code == 304 and previous:
            content_hash = previous["content_hash"]
            changed = False
            object_key = None
            body_size = 0
        else:
            response.raise_for_status()
            body = response.content
            if not body:
                raise RuntimeError("empty response")
            if len(body) > 8_000_000:
                raise RuntimeError("response exceeds 8 MB limit")
            content_hash = hashlib.sha256(body).hexdigest()
            changed = previous is None or previous["content_hash"] != content_hash
            object_key = await store_snapshot(body, content_hash) if changed else None
            body_size = len(body)

        async with pool.acquire() as conn:
            snapshot_id = await conn.fetchval(
                """
                INSERT INTO source_snapshots(
                    source_id, source_url, object_key, content_hash, etag,
                    last_modified, http_status, bytes, changed
                ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING id
                """,
                source_id, url, object_key, content_hash,
                response.headers.get("etag") or (previous["etag"] if previous else None),
                response.headers.get("last-modified") or (previous["last_modified"] if previous else None),
                response.status_code, body_size, changed,
            )
            if source_id:
                await conn.execute(
                    "UPDATE source_registry SET last_checked_at=now(), next_check_at=now() + refresh_interval_minutes * interval '1 minute', updated_at=now() WHERE id=$1",
                    source_id,
                )
            await conn.execute(
                "UPDATE record_sources SET last_checked_at=now() WHERE source_url=$1",
                url,
            )
            if changed:
                await conn.execute(
                    """
                    INSERT INTO ingestion_tasks(task_type, priority, payload)
                    VALUES(
                        'EXTRACT',
                        $1,
                        jsonb_build_object(
                            'snapshot_id', $2::bigint,
                            'source_url', $3::text,
                            'source_id', $4::uuid
                        )
                    )
                    """,
                    int(payload.get("priority", 0)), snapshot_id, url, source_id,
                )
        await complete_task(pool, task["id"], success=True)
        print(f"FETCH task={task['id']} status={response.status_code} changed={changed} url={url}")
    except Exception as exc:
        await complete_task(pool, task["id"], success=False, error=str(exc))
        print(f"FETCH_FAILED task={task['id']} url={url} error={exc}")


async def worker_loop(pool: asyncpg.Pool, client: httpx.AsyncClient):
    while True:
        task = await claim_task(pool)
        if not task:
            await asyncio.sleep(2)
            continue
        await process_fetch(pool, client, task)


async def main():
    await ensure_bucket()
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=WORKER_CONCURRENCY + 2)
    limits = httpx.Limits(max_connections=WORKER_CONCURRENCY * 2, max_keepalive_connections=WORKER_CONCURRENCY)
    timeout = httpx.Timeout(FETCH_TIMEOUT)
    async with httpx.AsyncClient(follow_redirects=True, limits=limits, timeout=timeout) as client:
        await asyncio.gather(*(worker_loop(pool, client) for _ in range(WORKER_CONCURRENCY)))


if __name__ == "__main__":
    asyncio.run(main())
