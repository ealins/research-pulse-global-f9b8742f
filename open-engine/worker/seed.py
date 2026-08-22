import asyncio
import os
import re
import sys
from urllib.parse import urlparse

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")

if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", DB_SCHEMA):
    raise SystemExit(f"Invalid DB_SCHEMA: {DB_SCHEMA!r}")

DB_SEARCH_PATH = f"{DB_SCHEMA},extensions,public"


async def main(urls: list[str]):
    if not urls:
        raise SystemExit("Usage: python seed.py https://example.org/page [more URLs...]")

    conn = await asyncpg.connect(
        DATABASE_URL,
        server_settings={"search_path": DB_SEARCH_PATH},
    )
    try:
        sources = 0
        queued = 0
        for raw in urls:
            url = raw.strip()
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                print(f"SKIP invalid URL: {url}")
                continue

            source_id = await conn.fetchval(
                """
                INSERT INTO source_registry(
                    name, url, source_type, trust_level, next_check_at, active
                )
                VALUES($1,$2,'web','standard',now(),true)
                ON CONFLICT(url) DO UPDATE SET
                    active=true,
                    next_check_at=least(source_registry.next_check_at, now()),
                    updated_at=now()
                RETURNING id
                """,
                parsed.netloc,
                url,
            )
            sources += 1

            task_id = await conn.fetchval(
                """
                INSERT INTO ingestion_tasks(task_type, priority, payload)
                SELECT 'FETCH', 10,
                       jsonb_build_object('url',$1,'source_id',$2,'priority',10)
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ingestion_tasks
                    WHERE task_type='FETCH'
                      AND status IN ('QUEUED','RETRY','PROCESSING')
                      AND payload->>'url'=$1
                )
                RETURNING id
                """,
                url,
                source_id,
            )
            if task_id:
                queued += 1

        print(f"SEED_OK schema={DB_SCHEMA} sources={sources} queued={queued}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
