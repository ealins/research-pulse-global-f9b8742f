import asyncio
import os
import re

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")

if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", DB_SCHEMA):
    raise SystemExit(f"Invalid DB_SCHEMA: {DB_SCHEMA!r}")

DB_SEARCH_PATH = f"{DB_SCHEMA},extensions,public"


async def main() -> None:
    conn = await asyncpg.connect(
        DATABASE_URL,
        server_settings={"search_path": DB_SEARCH_PATH},
    )
    try:
        snapshots = await conn.fetch(
            """
            SELECT DISTINCT ON (source_url)
                   id, source_id, source_url
            FROM source_snapshots
            WHERE object_key IS NOT NULL
            ORDER BY source_url, fetched_at DESC
            """
        )

        queued = 0
        for snapshot in snapshots:
            task_id = await conn.fetchval(
                """
                INSERT INTO ingestion_tasks(task_type, priority, payload)
                SELECT 'EXTRACT', 10,
                       jsonb_build_object(
                           'snapshot_id', $1::bigint,
                           'source_url', $2::text,
                           'source_id', $3::uuid
                       )
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ingestion_tasks
                    WHERE task_type='EXTRACT'
                      AND status IN ('QUEUED','RETRY','PROCESSING')
                      AND payload->>'snapshot_id' = ($1::bigint)::text
                )
                RETURNING id
                """,
                snapshot["id"],
                snapshot["source_url"],
                snapshot["source_id"],
            )
            if task_id:
                queued += 1

        print(
            f"REPROCESS_OK schema={DB_SCHEMA} snapshots={len(snapshots)} queued={queued}"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
