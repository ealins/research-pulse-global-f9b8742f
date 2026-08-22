import asyncio
import io
import json
import os
from datetime import datetime, timezone

import asyncpg
from minio import Minio

DATABASE_URL = os.environ["DATABASE_URL"]
S3_ENDPOINT = os.environ["S3_ENDPOINT"].replace("http://", "").replace("https://", "")
S3_SECURE = os.environ["S3_ENDPOINT"].startswith("https://")
S3_BUCKET = os.environ["S3_BUCKET"]
SNAPSHOT_KEY = os.getenv("PUBLIC_SNAPSHOT_KEY", "public/latest.json")
SNAPSHOT_INTERVAL_SECONDS = max(60, int(os.getenv("SNAPSHOT_INTERVAL_SECONDS", "900")))

minio = Minio(
    S3_ENDPOINT,
    access_key=os.environ["S3_ACCESS_KEY"],
    secret_key=os.environ["S3_SECRET_KEY"],
    secure=S3_SECURE,
)

ENTITY_TYPES = [
    "publication",
    "programme",
    "project",
    "opportunity",
    "event",
    "researcher",
    "institution",
]


def serializable(row):
    value = dict(row)
    for key, item in list(value.items()):
        if hasattr(item, "isoformat"):
            value[key] = item.isoformat()
    return value


async def build_snapshot(pool: asyncpg.Pool):
    async with pool.acquire() as conn:
        pulse_rows = await conn.fetch(
            """
            SELECT id, signal_type, entity_id, entity_type, title, summary, country,
                   topics, importance_score, confidence, verification_status,
                   source_url, detected_at, published_at, expires_at, data
            FROM live_public_signals
            WHERE published_at >= now() - interval '24 hours'
            ORDER BY importance_score DESC, published_at DESC
            LIMIT 100
            """
        )
        summary_total = await conn.fetchval(
            "SELECT count(*) FROM live_public_signals WHERE published_at >= now() - interval '24 hours'"
        )
        summary_rows = await conn.fetch(
            """
            SELECT signal_type, count(*)::int AS count
            FROM live_public_signals
            WHERE published_at >= now() - interval '24 hours'
            GROUP BY signal_type
            ORDER BY count DESC
            """
        )
        latest = {}
        for entity_type in ENTITY_TYPES:
            rows = await conn.fetch(
                """
                SELECT id, entity_type, external_key, slug, title, subtitle, country,
                       latitude, longitude, verification_status, confidence, source_url,
                       published_at, first_seen_at, last_seen_at, last_changed_at, data
                FROM latest_public_entities
                WHERE entity_type=$1
                ORDER BY coalesce(published_at, last_changed_at) DESC
                LIMIT 50
                """,
                entity_type,
            )
            latest[entity_type] = [serializable(row) for row in rows]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pulse": {
            "items": [serializable(row) for row in pulse_rows],
            "window_hours": 24,
        },
        "pulse_summary": {
            "window_hours": 24,
            "total": summary_total,
            "by_type": [serializable(row) for row in summary_rows],
        },
        "latest": latest,
    }


async def upload(snapshot):
    body = json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    await asyncio.to_thread(
        minio.put_object,
        S3_BUCKET,
        SNAPSHOT_KEY,
        io.BytesIO(body),
        len(body),
        content_type="application/json",
        metadata={"Cache-Control": "public, max-age=300"},
    )


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    try:
        while True:
            try:
                snapshot = await build_snapshot(pool)
                await upload(snapshot)
                print(
                    f"SNAPSHOT pulse={len(snapshot['pulse']['items'])} "
                    f"key={SNAPSHOT_KEY} generated_at={snapshot['generated_at']}"
                )
            except Exception as exc:
                print(f"SNAPSHOT_FAILED error={exc}")
            await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
