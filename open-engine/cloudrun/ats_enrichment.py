from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timezone
from typing import Any

import asyncpg

GEO_TERMS = re.compile(
    r"\b(?:photogrammetr\w*|remote sensing|earth observation|geoai|geospatial|"
    r"geoinformat\w*|geomatics|geodes\w*|gis\b|lidar|laser scanning|"
    r"insar|\bsar\b|synthetic aperture radar|hyperspectral|satellite|"
    r"uav|drone|point cloud|3d reconstruction|slam\b|spatial data|"
    r"digital twin|citygml|geobim|mapping|cartograph\w*)\b",
    re.IGNORECASE,
)

TOPIC_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"remote sensing|earth observation|satellite|hyperspectral", re.I), "Environmental Remote Sensing"),
    (re.compile(r"foundation model", re.I), "Foundation Models for Earth Observation"),
    (re.compile(r"multimodal.*earth observation|earth observation.*multimodal", re.I), "Multimodal Earth Observation"),
    (re.compile(r"geomatics|geodes\w*|geoinformat\w*", re.I), "Geomatics"),
    (re.compile(r"\bgis\b|3d gis|citygml", re.I), "3D GIS"),
    (re.compile(r"uav|drone|aerial mapping", re.I), "UAV Mapping"),
    (re.compile(r"digital twin|geobim|citygml", re.I), "Urban Digital Twins"),
)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:70]
    return slug or "opportunity"


def _opportunity_type(title: str) -> str:
    value = title.lower()
    if re.search(r"\bph\.?d\b", value):
        return "phd"
    if "doctoral" in value:
        return "doctoral_researcher"
    if re.search(r"post[- ]?doc|postdoctoral", value):
        return "postdoc"
    if "research assistant" in value:
        return "research_assistant"
    return "other"


def _iso_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _status(deadline: date | None) -> str:
    if deadline is None:
        return "possibly_open"
    today = datetime.now(timezone.utc).date()
    if deadline < today:
        return "closed"
    if (deadline - today).days <= 14:
        return "closing_soon"
    return "open"


def _job_text(job: Any) -> str:
    parts = [
        getattr(job, "title", None),
        getattr(job, "description", None),
        getattr(job, "department", None),
        getattr(job, "team", None),
        getattr(job, "location", None),
    ]
    return " ".join(str(part) for part in parts if part)


def _topic_names(text: str) -> list[str]:
    names: list[str] = []
    for pattern, name in TOPIC_PATTERNS:
        if pattern.search(text) and name not in names:
            names.append(name)
    return names


async def _record_source(
    conn: asyncpg.Connection,
    *,
    opportunity_id,
    source_url: str,
    organization: str,
    title: str,
) -> None:
    existing = await conn.fetchval(
        """
        SELECT id FROM public.record_sources
        WHERE entity_type='opportunity' AND entity_id=$1 AND source_url=$2
        ORDER BY discovered_at LIMIT 1
        """,
        opportunity_id,
        source_url,
    )
    if existing:
        await conn.execute(
            """
            UPDATE public.record_sources
            SET source_organization=$2, original_title=$3,
                claim='ATS-native job record', last_checked_at=now(),
                verification_status='auto_discovered', confidence='high',
                is_primary=true, updated_at=now()
            WHERE id=$1
            """,
            existing,
            organization,
            title,
        )
        return
    await conn.execute(
        """
        INSERT INTO public.record_sources(
            entity_type, entity_id, source_url, source_organization,
            source_type, original_title, claim, last_checked_at,
            verification_status, confidence, is_primary
        ) VALUES(
            'opportunity',$1,$2,$3,'api',$4,'ATS-native job record',now(),
            'auto_discovered','high',true
        )
        """,
        opportunity_id,
        source_url,
        organization,
        title,
    )


async def _link_topics(conn: asyncpg.Connection, opportunity_id, text: str) -> None:
    names = _topic_names(text)
    if not names:
        return
    rows = await conn.fetch(
        "SELECT id,name FROM public.research_topics WHERE active=true AND name=ANY($1::text[])",
        names,
    )
    for row in rows:
        await conn.execute(
            """
            INSERT INTO public.opportunity_topics(opportunity_id,topic_id)
            VALUES($1,$2) ON CONFLICT DO NOTHING
            """,
            opportunity_id,
            row["id"],
        )


async def _upsert_job(
    conn: asyncpg.Connection,
    *,
    institution: asyncpg.Record,
    job: Any,
) -> bool:
    title = " ".join(str(getattr(job, "title", "") or "").split())[:500]
    if len(title) < 3:
        return False
    text = _job_text(job)
    if not GEO_TERMS.search(text):
        return False

    public_url = str(getattr(job, "url", "") or "").strip()
    apply_url = str(getattr(job, "apply_url", "") or public_url).strip()
    if not public_url:
        return False

    deadline = _iso_date(getattr(job, "application_deadline", None))
    status = _status(deadline)
    if status == "closed":
        return False

    dedupe_key = hashlib.sha256(f"ats|{public_url}".encode("utf-8")).hexdigest()
    suffix = dedupe_key[:8]
    slug = f"{_slugify(title)}-{suffix}"
    normalized_title = " ".join(title.lower().split())
    location = str(getattr(job, "location", "") or "").strip() or None
    city = location.split(",", 1)[0].strip()[:120] if location else None
    country = str(getattr(job, "country_iso", "") or "").strip().upper() or None
    description = str(getattr(job, "description", "") or "").strip()[:12_000] or None
    salary = str(getattr(job, "salary_summary", "") or "").strip()[:500] or None
    employer = str(getattr(job, "company", "") or institution["name"]).strip()[:240]
    ats_type = str(getattr(job, "ats_type", "ats-scrapers"))[:120]

    opportunity_id = await conn.fetchval(
        """
        INSERT INTO public.opportunities(
            title,slug,normalized_title,dedupe_key,institution_id,country,city,
            opportunity_type,description,salary_text,application_deadline,
            application_url,official_source_url,last_checked_at,status,confidence,
            verification_status,is_demo,sector,employer_name,extracted_by,
            extraction_model,extraction_confidence,extraction_timestamp
        ) VALUES(
            $1,$2,$3,$4,$5,$6,$7,$8::public.opportunity_type,$9,$10,$11,$12,$13,
            now(),$14::public.opportunity_status,'high','auto_discovered',false,
            'academic',$15,'ATS_SCRAPERS',$16,0.95,now()
        )
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
            title=excluded.title,
            normalized_title=excluded.normalized_title,
            institution_id=coalesce(excluded.institution_id,public.opportunities.institution_id),
            country=coalesce(excluded.country,public.opportunities.country),
            city=coalesce(excluded.city,public.opportunities.city),
            opportunity_type=excluded.opportunity_type,
            description=coalesce(excluded.description,public.opportunities.description),
            salary_text=coalesce(excluded.salary_text,public.opportunities.salary_text),
            application_deadline=coalesce(excluded.application_deadline,public.opportunities.application_deadline),
            application_url=excluded.application_url,
            official_source_url=excluded.official_source_url,
            last_checked_at=now(),
            status=excluded.status,
            confidence='high',
            verification_status=CASE
                WHEN public.opportunities.verification_status='verified' THEN 'verified'::public.verification_status
                ELSE 'auto_discovered'::public.verification_status
            END,
            employer_name=excluded.employer_name,
            extracted_by='ATS_SCRAPERS',
            extraction_model=excluded.extraction_model,
            extraction_confidence=excluded.extraction_confidence,
            extraction_timestamp=now(),
            updated_at=now()
        RETURNING id
        """,
        title,
        slug,
        normalized_title,
        dedupe_key,
        institution["id"],
        country,
        city,
        _opportunity_type(title),
        description,
        salary,
        deadline,
        apply_url,
        public_url,
        status,
        employer,
        ats_type,
    )
    await _record_source(
        conn,
        opportunity_id=opportunity_id,
        source_url=public_url,
        organization=employer,
        title=title,
    )
    await _link_topics(conn, opportunity_id, text)
    return True


async def run_ats_enrichment(pool: asyncpg.Pool, max_sources: int = 5) -> dict[str, int]:
    """Scrape ATS-backed institution career pages and upsert relevant jobs.

    Unsupported university career pages are skipped without error; the existing
    HTML pipeline remains responsible for those sites. This keeps ATS ingestion
    complementary rather than creating another competing crawler.
    """

    try:
        from ats_scrapers import get_scraper_for_url
    except Exception as exc:
        print(f"ATS_ENRICHMENT unavailable={exc}")
        return {"sources": 0, "supported": 0, "jobs": 0, "written": 0}

    async with pool.acquire() as conn:
        institutions = await conn.fetch(
            """
            SELECT id,name,careers_url
            FROM public.institutions
            WHERE is_demo=false AND active=true AND careers_url IS NOT NULL
            ORDER BY last_verified_at DESC NULLS LAST, name
            LIMIT 100
            """
        )

    sources = supported = jobs_seen = written = 0
    for institution in institutions:
        if supported >= max_sources:
            break
        url = institution["careers_url"]
        sources += 1
        try:
            scraper = get_scraper_for_url(url)
        except Exception:
            continue
        supported += 1
        try:
            jobs = await scraper.afetch()
        except Exception as exc:
            print(f"ATS_SOURCE_FAILED institution={institution['name']!r} url={url} error={exc}")
            continue
        jobs_seen += len(jobs)
        async with pool.acquire() as conn:
            async with conn.transaction():
                for job in jobs[:250]:
                    if await _upsert_job(conn, institution=institution, job=job):
                        written += 1

    result = {"sources": sources, "supported": supported, "jobs": jobs_seen, "written": written}
    print("ATS_ENRICHMENT " + " ".join(f"{key}={value}" for key, value in result.items()))
    return result
