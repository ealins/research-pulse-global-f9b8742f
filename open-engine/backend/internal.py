import hmac
import os

from fastapi import Header, HTTPException, Query, Request

INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN", "")


def _require_token(authorization: str | None):
    if not INTERNAL_API_TOKEN:
        raise HTTPException(status_code=503, detail="Internal maintenance API is not configured")
    expected = f"Bearer {INTERNAL_API_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def register_internal_routes(app):
    @app.get("/internal/maintenance/status")
    async def maintenance_status(request: Request, authorization: str | None = Header(default=None)):
        _require_token(authorization)
        async with request.app.state.db.acquire() as conn:
            due_sources = await conn.fetchval(
                "SELECT count(*) FROM source_registry WHERE active=true AND coalesce(next_check_at, created_at) <= now()"
            )
            queue = await conn.fetch(
                """
                SELECT task_type, status, count(*)::int AS count
                FROM ingestion_tasks
                WHERE status IN ('QUEUED','PROCESSING','RETRY','DEAD')
                GROUP BY task_type, status
                ORDER BY task_type, status
                """
            )
            latest_signal = await conn.fetchval("SELECT max(published_at) FROM signals")
        return {
            "ok": True,
            "due_sources": due_sources,
            "queue": [dict(row) for row in queue],
            "latest_signal": latest_signal.isoformat() if latest_signal else None,
        }

    @app.post("/internal/maintenance/enqueue-due")
    async def enqueue_due(
        request: Request,
        limit: int = Query(500, ge=1, le=5000),
        authorization: str | None = Header(default=None),
    ):
        _require_token(authorization)
        async with request.app.state.db.acquire() as conn:
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
                WHERE s.active=true
                  AND coalesce(s.next_check_at, s.created_at) <= now()
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ingestion_tasks t
                      WHERE t.task_type='FETCH'
                        AND t.status IN ('QUEUED','PROCESSING','RETRY')
                        AND t.payload->>'source_id' = s.id::text
                  )
                ORDER BY coalesce(s.next_check_at, s.created_at), s.id
                LIMIT $1
                """,
                limit,
            )
        return {"ok": True, "queued": int(result.split()[-1])}

    @app.post("/internal/maintenance/recover-stale")
    async def recover_stale(
        request: Request,
        minutes: int = Query(30, ge=5, le=1440),
        authorization: str | None = Header(default=None),
    ):
        _require_token(authorization)
        async with request.app.state.db.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE ingestion_tasks
                SET status='RETRY', locked_at=NULL, locked_by=NULL,
                    error=coalesce(error, 'stale processing lease recovered'),
                    next_attempt_at=now(), updated_at=now()
                WHERE status='PROCESSING'
                  AND locked_at < now() - ($1 * interval '1 minute')
                """,
                minutes,
            )
        return {"ok": True, "recovered": int(result.split()[-1])}
