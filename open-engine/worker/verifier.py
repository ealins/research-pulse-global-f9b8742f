import asyncio
import os

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
VERIFY_INTERVAL_SECONDS = max(60, int(os.getenv("VERIFY_INTERVAL_SECONDS", "600")))
VERIFY_MIN_AGE_HOURS = max(1, int(os.getenv("VERIFY_MIN_AGE_HOURS", "6")))
VERIFY_LIMIT = max(1, min(5000, int(os.getenv("VERIFY_LIMIT", "500"))))
VERIFY_MIN_CONFIDENCE = max(0.60, min(0.99, float(os.getenv("VERIFY_MIN_CONFIDENCE", "0.78"))))


async def promote(pool: asyncpg.Pool) -> int:
    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT e.id
                FROM canonical_entities e
                WHERE e.verification_status='auto_discovered'
                  AND e.confidence >= $1
                  AND EXISTS (
                      SELECT 1
                      FROM record_sources r
                      WHERE r.entity_id=e.id
                        AND r.is_primary=true
                        AND r.confidence >= $1
                        AND r.last_checked_at IS NOT NULL
                        AND r.last_checked_at >= r.discovered_at + ($2 * interval '1 hour')
                  )
                ORDER BY e.first_seen_at
                FOR UPDATE SKIP LOCKED
                LIMIT $3
                """,
                VERIFY_MIN_CONFIDENCE,
                VERIFY_MIN_AGE_HOURS,
                VERIFY_LIMIT,
            )
            ids = [row["id"] for row in rows]
            if not ids:
                return 0
            await conn.execute(
                """
                UPDATE canonical_entities
                SET verification_status='verified', updated_at=now()
                WHERE id = ANY($1::uuid[])
                """,
                ids,
            )
            await conn.execute(
                """
                UPDATE record_sources
                SET verification_status='verified', last_verified_at=now()
                WHERE entity_id = ANY($1::uuid[])
                  AND verification_status='auto_discovered'
                """,
                ids,
            )
            await conn.execute(
                """
                UPDATE signals
                SET verification_status='verified'
                WHERE entity_id = ANY($1::uuid[])
                  AND verification_status='auto_discovered'
                """,
                ids,
            )
            return len(ids)


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    try:
        while True:
            try:
                promoted = await promote(pool)
                print(f"VERIFY promoted={promoted}")
            except Exception as exc:
                print(f"VERIFY_FAILED error={exc}")
            await asyncio.sleep(VERIFY_INTERVAL_SECONDS)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
