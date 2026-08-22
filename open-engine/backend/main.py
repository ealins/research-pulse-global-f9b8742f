import os
from contextlib import asynccontextmanager

import asyncpg
import orjson
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

DATABASE_URL = os.environ["DATABASE_URL"]
ALLOWED_ENTITY_TYPES = {
    "institution",
    "researcher",
    "publication",
    "project",
    "programme",
    "opportunity",
    "event",
    "topic",
}


def row_dict(row):
    if row is None:
        return None
    value = dict(row)
    for key, item in list(value.items()):
        if hasattr(item, "isoformat"):
            value[key] = item.isoformat()
    return value


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=2,
        max_size=int(os.getenv("DB_POOL_MAX", "20")),
        command_timeout=30,
    )
    try:
        yield
    finally:
        await app.state.db.close()


app = FastAPI(
    title="GeoAcademic Open Engine",
    version="0.1.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

origins = [
    value.strip()
    for value in os.getenv("PUBLIC_CORS_ORIGINS", "https://geoacademic.app").split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    async with app.state.db.acquire() as conn:
        now = await conn.fetchval("SELECT now()")
    return {"ok": True, "service": "geoacademic-open-engine", "database_time": now}


@app.get("/v1/pulse/latest")
async def latest_pulse(
    limit: int = Query(50, ge=1, le=200),
    hours: int = Query(24, ge=1, le=24 * 30),
    country: str | None = None,
    topic: str | None = None,
):
    filters = ["published_at >= now() - ($1 * interval '1 hour')"]
    args: list[object] = [hours]
    if country:
        args.append(country)
        filters.append(f"country = ${len(args)}")
    if topic:
        args.append(topic)
        filters.append(f"${len(args)} = ANY(topics)")
    args.append(limit)
    sql = f"""
        SELECT id, signal_type, entity_id, entity_type, title, summary, country,
               topics, importance_score, confidence, verification_status,
               source_url, detected_at, published_at, expires_at, data
        FROM live_public_signals
        WHERE {' AND '.join(filters)}
        ORDER BY importance_score DESC, published_at DESC
        LIMIT ${len(args)}
    """
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return {"items": [row_dict(row) for row in rows], "window_hours": hours}


@app.get("/v1/pulse/summary")
async def pulse_summary(hours: int = Query(24, ge=1, le=24 * 30)):
    async with app.state.db.acquire() as conn:
        total = await conn.fetchval(
            "SELECT count(*) FROM live_public_signals WHERE published_at >= now() - ($1 * interval '1 hour')",
            hours,
        )
        rows = await conn.fetch(
            """
            SELECT signal_type, count(*)::int AS count
            FROM live_public_signals
            WHERE published_at >= now() - ($1 * interval '1 hour')
            GROUP BY signal_type
            ORDER BY count DESC
            """,
            hours,
        )
    return {"window_hours": hours, "total": total, "by_type": [row_dict(row) for row in rows]}


@app.get("/v1/latest/{entity_type}")
async def latest_entities(
    entity_type: str,
    limit: int = Query(50, ge=1, le=200),
    country: str | None = None,
):
    if entity_type not in ALLOWED_ENTITY_TYPES:
        raise HTTPException(status_code=404, detail="Unknown entity type")
    args: list[object] = [entity_type]
    filters = ["entity_type = $1"]
    if country:
        args.append(country)
        filters.append(f"country = ${len(args)}")
    args.append(limit)
    sql = f"""
        SELECT id, entity_type, external_key, slug, title, subtitle, country,
               latitude, longitude, verification_status, confidence, source_url,
               published_at, first_seen_at, last_seen_at, last_changed_at, data
        FROM latest_public_entities
        WHERE {' AND '.join(filters)}
        ORDER BY coalesce(published_at, last_changed_at) DESC
        LIMIT ${len(args)}
    """
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return {"entity_type": entity_type, "items": [row_dict(row) for row in rows]}


@app.get("/v1/entities/{entity_type}/{slug}")
async def entity_detail(entity_type: str, slug: str):
    if entity_type not in ALLOWED_ENTITY_TYPES:
        raise HTTPException(status_code=404, detail="Unknown entity type")
    async with app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT e.*,
                   coalesce(array_agg(t.topic) FILTER (WHERE t.topic IS NOT NULL), '{}') AS topics
            FROM latest_public_entities e
            LEFT JOIN entity_topics t ON t.entity_id = e.id
            WHERE e.entity_type = $1 AND e.slug = $2
            GROUP BY e.id, e.entity_type, e.external_key, e.slug, e.title, e.subtitle,
                     e.country, e.latitude, e.longitude, e.verification_status,
                     e.confidence, e.source_url, e.published_at, e.first_seen_at,
                     e.last_seen_at, e.last_changed_at, e.data, e.created_at, e.updated_at
            """,
            entity_type,
            slug,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Entity not found")
    return row_dict(row)


@app.get("/v1/search")
async def search(q: str = Query(..., min_length=2, max_length=160), limit: int = Query(20, ge=1, le=100)):
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, entity_type, slug, title, subtitle, country,
                   verification_status, confidence, source_url,
                   greatest(similarity(title, $1), CASE WHEN title ILIKE '%' || $1 || '%' THEN 0.8 ELSE 0 END) AS score
            FROM latest_public_entities
            WHERE title ILIKE '%' || $1 || '%' OR similarity(title, $1) > 0.25
            ORDER BY score DESC, coalesce(published_at, last_changed_at) DESC
            LIMIT $2
            """,
            q.strip(),
            limit,
        )
    return {"query": q, "items": [row_dict(row) for row in rows]}
