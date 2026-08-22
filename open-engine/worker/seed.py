import asyncio
import os
import sys
from urllib.parse import urlparse

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]


async def main(urls: list[str]):
    if not urls:
        raise SystemExit("Usage: python seed.py https://example.org/page [more URLs...]")
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        queued = 0
        for raw in urls:
            url = raw.strip()
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                print(f"SKIP invalid URL: {url}")
                continue
            source_id = await conn.fetchval(
                """
                INSERT INTO source_registry(name, url, source_type, trust_level, next_check_at)
                VALUES($1,$2,'web','standard',now())
                ON CONFLICT(url) DO UPDATE SET active=true, updated_at=now()
                RETURNING id
                """,
                parsed.netloc,
                url,
            )
            await conn.execute(
                """
                INSERT INTO ingestion_tasks(task_type, priority, payload)
                VALUES('FETCH', 10, jsonb_build_object('url',$1,'source_id',$2,'priority',10))
                """,
                url,
                source_id,
            )
            queued += 1
        print(f"queued={queued}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
