import asyncio
import os

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
SCHEDULER_INTERVAL_SECONDS = max(30, int(os.getenv("SCHEDULER_INTERVAL_SECONDS", "300")))
ENQUEUE_LIMIT = max(1, min(5000, int(os.getenv("SCHEDULER_ENQUEUE_LIMIT", "500"))))
STALE_AFTER_MINUTES = max(5, int(os.getenv("TASK_STALE_AFTER_MINUTES", "30")))


async def enqueue_due(pool: asyncpg.Pool) -> int:
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            INSERT INTO ingestion_tasks(task_type, priority, payload)
            SELECT
                'FETCH',
                CASE s.trust_level WHEN 'high' THEN 20 WHEN 'official' THEN 20 ELSE 0 END,
                jsonb_build_object(
                    'source_id', s.id,
                    'url', s.url,
                    'priority', CASE s.trust_level WHEN 'high' THEN 20 WHEN 'official' THEN 20 ELSE 0 END
                )
            FROM source_registry s
            WHERE s.active = true
              AND coalesce(s.next_check_at, s.created_at) <= now()
              AND NOT EXISTS (
                  SELECT 1
                  FROM ingestion_tasks t
                  WHERE t.task_type = 'FETCH'
                    AND t.status IN ('QUEUED','PROCESSING','RETRY')
                    AND t.payload->>'source_id' = s.id::text
              )
            ORDER BY coalesce(s.next_check_at, s.created_at), s.id
            LIMIT $1
            ON CONFLICT DO NOTHING
            """,
            ENQUEUE_LIMIT,
        )
    return int(result.split()[-1])


async def recover_stale(pool: asyncpg.Pool) -> int:
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE ingestion_tasks
            SET status='RETRY',
                locked_at=NULL,
                locked_by=NULL,
                error=coalesce(error, 'stale processing lease recovered'),
                next_attempt_at=now(),
                updated_at=now()
            WHERE status='PROCESSING'
              AND locked_at < now() - ($1 * interval '1 minute')
            """,
            STALE_AFTER_MINUTES,
        )
    return int(result.split()[-1])


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    try:
        while True:
            try:
                recovered = await recover_stale(pool)
                queued = await enqueue_due(pool)
                print(f"SCHEDULER queued={queued} recovered={recovered}")
            except Exception as exc:
                print(f"SCHEDULER_FAILED error={exc}")
            await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
