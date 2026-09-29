from __future__ import annotations

import asyncio
import json
import os
import socket
from typing import Any

import asyncpg
from fastapi import FastAPI, HTTPException
from google.cloud import pubsub_v1

import scheduler
import source_adapters

DATABASE_URL = os.environ["DATABASE_URL"]
PROJECT_ID = os.getenv("PUBSUB_PROJECT_ID", "").strip()
TOPIC_PREFIX = os.getenv("PUBSUB_TOPIC_PREFIX", "geoacademic").strip()
DISPATCH_LIMIT = max(1, min(5000, int(os.getenv("DISPATCH_LIMIT", "500"))))
REVIEW_TICKS = max(0, min(16, int(os.getenv("REVIEW_TICKS", "4"))))
WORKER_ID = f"dispatcher-{socket.gethostname()}"

if not PROJECT_ID:
    raise RuntimeError("PUBSUB_PROJECT_ID is required")

publisher = pubsub_v1.PublisherClient()
app = FastAPI(title="GeoAcademic distributed dispatcher", version="1.0")


def topic_path(task_type: str) -> str:
    return publisher.topic_path(PROJECT_ID, f"{TOPIC_PREFIX}-{task_type.lower()}")


async def publish_task(conn: asyncpg.Connection, task: asyncpg.Record) -> None:
    payload = {
        "task_id": int(task["id"]),
        "task_type": str(task["task_type"]),
        "attempts": int(task["attempts"]),
    }
    path = topic_path(str(task["task_type"]))
    try:
        future = publisher.publish(
            path,
            json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            task_type=str(task["task_type"]),
        )
        await asyncio.to_thread(future.result, 30)
        await conn.execute(
            """
            UPDATE ingestion_tasks
            SET dispatch_state='DISPATCHED',
                dispatched_at=now(),
                dispatch_attempts=dispatch_attempts+1,
                updated_at=now()
            WHERE id=$1
            """,
            task["id"],
        )
    except Exception:
        await conn.execute(
            """
            UPDATE ingestion_tasks
            SET dispatch_state='PENDING',
                dispatch_attempts=dispatch_attempts+1,
                updated_at=now()
            WHERE id=$1
            """,
            task["id"],
        )
        raise


async def dispatch_queued_tasks(pool: asyncpg.Pool) -> int:
    dispatched = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            rows = await conn.fetch(
                """
                SELECT id, task_type, attempts
                FROM ingestion_tasks
                WHERE task_type IN ('FETCH','EXTRACT')
                  AND status IN ('QUEUED','RETRY')
                  AND next_attempt_at <= now()
                  AND coalesce(dispatch_state,'PENDING')='PENDING'
                ORDER BY priority DESC, next_attempt_at, id
                FOR UPDATE SKIP LOCKED
                LIMIT $1
                """,
                DISPATCH_LIMIT,
            )
            for row in rows:
                try:
                    await publish_task(conn, row)
                    dispatched += 1
                except Exception as exc:
                    print(f"DISPATCH_FAILED task={row['id']} type={row['task_type']} error={exc}")
    return dispatched


async def run_tick() -> dict[str, Any]:
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=12)
    try:
        adapter_result = await source_adapters.run_source_adapters(pool)
        recovered = await scheduler.recover_stale(pool)
        queued = await scheduler.enqueue_due(pool)
        dispatched = await dispatch_queued_tasks(pool)
    finally:
        await pool.close()

    review_published = 0
    if REVIEW_TICKS:
        review_path = topic_path("REVIEW")
        for _ in range(REVIEW_TICKS):
            try:
                future = publisher.publish(
                    review_path,
                    b'{"trigger":"scheduler-tick"}',
                    task_type="REVIEW",
                )
                await asyncio.to_thread(future.result, 15)
                review_published += 1
            except Exception as exc:
                print(f"REVIEW_DISPATCH_FAILED error={exc}")
                break

    result = {
        "adapters": adapter_result,
        "recovered": recovered,
        "queued": queued,
        "dispatched": dispatched,
        "review_ticks": review_published,
    }
    print("DISTRIBUTED_TICK " + json.dumps(result, sort_keys=True))
    return result


@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "dispatcher"}


@app.post("/tick")
async def tick():
    try:
        return await run_tick()
    except Exception as exc:
        print(f"DISTRIBUTED_TICK_FAILED error={exc}")
        raise HTTPException(status_code=500, detail="dispatcher tick failed") from exc
