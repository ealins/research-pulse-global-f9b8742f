from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Any

import asyncpg
import httpx
from fastapi import FastAPI, HTTPException, Request

DATABASE_URL = os.environ["DATABASE_URL"]
STAGE = os.getenv("WORKER_STAGE", "FETCH").upper()
app = FastAPI(title=f"GeoAcademic {STAGE.lower()} worker", version="1.0")


def _message(body: dict[str, Any]) -> dict[str, Any]:
    message = body.get("message") or {}
    raw = message.get("data")
    if not raw:
        return {}
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        value = json.loads(decoded)
        return value if isinstance(value, dict) else {}
    except Exception as exc:
        raise ValueError(f"invalid Pub/Sub message: {exc}") from exc


async def _handle_task(task_id: int) -> None:
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=8)
    try:
        if STAGE == "FETCH":
            import worker

            await worker.ensure_bucket()
            async with httpx.AsyncClient(
                follow_redirects=True,
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
                timeout=httpx.Timeout(worker.FETCH_TIMEOUT),
            ) as client:
                task = await worker.claim_task_by_id(pool, task_id)
                if task:
                    await worker.process_fetch(pool, client, task)
        elif STAGE == "EXTRACT":
            import processor

            task = await processor.claim_by_id(pool, task_id)
            if task:
                await processor.materialize(pool, task)
        else:
            raise ValueError(f"unsupported task stage {STAGE}")
    finally:
        await pool.close()


async def _handle_review() -> None:
    from review_enrichment import run_review_enrichment

    await run_review_enrichment(
        max_rounds=1,
        lease_limit=max(4, int(os.getenv("REVIEW_LEASE_LIMIT", "16"))),
        concurrency=max(1, int(os.getenv("REVIEW_CONCURRENCY", "8"))),
    )


@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": STAGE.lower()}


@app.post("/pubsub")
async def pubsub(request: Request):
    try:
        body = await request.json()
        if STAGE == "REVIEW":
            await _handle_review()
        else:
            message = _message(body)
            task_id = int(message.get("task_id") or 0)
            if not task_id:
                raise ValueError("Pub/Sub payload does not contain task_id")
            await _handle_task(task_id)
        return {"ok": True}
    except Exception as exc:
        print(f"DISTRIBUTED_WORKER_FAILED stage={STAGE} error={exc}")
        raise HTTPException(status_code=500, detail="worker failed") from exc
