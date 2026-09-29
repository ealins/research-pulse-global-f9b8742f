from __future__ import annotations

import asyncio
import gzip
import os
import urllib.parse

import asyncpg
import boto3
from botocore.config import Config

DATABASE_URL = os.environ["DATABASE_URL"]
S3_ENDPOINT = os.environ["S3_ENDPOINT"].rstrip("/")
S3_BUCKET = os.environ["S3_BUCKET"]


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name=os.getenv("S3_REGION", "us-east-1"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


async def purge(pool: asyncpg.Pool) -> dict[str, int]:
    # Keep source snapshots long enough to diagnose the previous ingestion cycle,
    # but not as a hidden long-term archive.
    async with pool.acquire() as conn:
        object_keys = await conn.fetch(
            """
            SELECT object_key
            FROM source_snapshots
            WHERE fetched_at < now() - interval '45 days'
              AND object_key IS NOT NULL
            LIMIT 5000
            """
        )
        await conn.execute(
            """
            DELETE FROM signals
            WHERE expires_at IS NOT NULL
              AND expires_at < now() - interval '14 days'
            """
        )
        await conn.execute(
            """
            DELETE FROM canonical_entities e
            WHERE e.entity_type IN ('publication','project')
              AND coalesce(e.published_at,e.last_changed_at) < now() - interval '395 days'
              AND NOT EXISTS (
                SELECT 1 FROM record_sources rs
                WHERE rs.entity_id=e.id AND rs.verification_status='verified'
              )
            """
        )
        await conn.execute(
            """
            DELETE FROM canonical_entities e
            WHERE e.entity_type='event'
              AND coalesce(nullif(e.data->>'end_date',''), nullif(e.data->>'start_date','')) IS NOT NULL
              AND coalesce(nullif(e.data->>'end_date',''), nullif(e.data->>'start_date'))::date < current_date - 14
              AND NOT EXISTS (
                SELECT 1 FROM record_sources rs
                WHERE rs.entity_id=e.id AND rs.verification_status='verified'
              )
            """
        )
        await conn.execute(
            """
            DELETE FROM canonical_entities e
            WHERE e.entity_type='opportunity'
              AND nullif(e.data->>'application_deadline','') IS NOT NULL
              AND nullif(e.data->>'application_deadline','')::date < current_date - 14
              AND NOT EXISTS (
                SELECT 1 FROM record_sources rs
                WHERE rs.entity_id=e.id AND rs.verification_status='verified'
              )
            """
        )
        await conn.execute(
            """
            DELETE FROM source_registry
            WHERE source_kind='content'
              AND created_at < now() - (greatest(retention_days,1) * interval '1 day')
              AND NOT EXISTS (
                SELECT 1 FROM record_sources rs
                WHERE rs.source_id=source_registry.id
              )
            """
        )
        await conn.execute(
            "DELETE FROM source_snapshots WHERE fetched_at < now() - interval '45 days'"
        )
        await conn.execute(
            "DELETE FROM ingestion_tasks WHERE status IN ('DONE','DEAD') AND updated_at < now() - interval '45 days'"
        )

    deleted_objects = 0
    if object_keys:
        s3 = _s3()
        for row in object_keys:
            key = row["object_key"]
            if not key:
                continue
            try:
                await asyncio.to_thread(s3.delete_object, Bucket=S3_BUCKET, Key=key)
                deleted_objects += 1
            except Exception as exc:
                print(f"RETENTION_OBJECT_DELETE_FAILED key={key!r} error={exc}")

    return {"objects_deleted": deleted_objects, "snapshot_candidates": len(object_keys)}


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=4)
    try:
        result = await purge(pool)
        print("RETENTION " + " ".join(f"{k}={v}" for k,v in result.items()))
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
