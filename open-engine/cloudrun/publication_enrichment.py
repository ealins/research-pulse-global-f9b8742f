from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import quote, urlencode

import asyncpg
import httpx

OPENAIRE_API = "https://api.openaire.eu/graph/v3"
DOMAIN_QUERIES = (
    "photogrammetry",
    "remote sensing",
    "geodesy",
    "geoinformatics",
    "earth observation",
    "lidar point cloud",
)
GEO_RE = re.compile(
    r"photogrammetr|remote\s+sensing|geodes[yi]|geoinformatic|earth\s+observation|"
    r"\bgis\b|geoai|lidar|laser\s+scann|point\s+cloud|synthetic\s+aperture\s+radar|"
    r"\bsar\b|geomatic|spatial\s+data|cartograph|satellite",
    re.I,
)


def _normalized_title(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()[:300]


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _obj(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _arr(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _doi(work: dict[str, Any]) -> str | None:
    for pid in _arr(work.get("pids")):
        record = _obj(pid)
        if str(record.get("scheme") or "").lower() == "doi":
            value = _text(record.get("value"))
            if value:
                return re.sub(r"^https?://doi\.org/", "", value, flags=re.I).lower()
    return None


def _citation_count(work: dict[str, Any]) -> int | None:
    indicators = _obj(work.get("indicators"))
    for value in (
        indicators.get("citationCount"),
        indicators.get("citationsCount"),
        indicators.get("citation_count"),
        work.get("citationCount"),
    ):
        if isinstance(value, (int, float)):
            return int(round(value))
    return None


def _description(work: dict[str, Any]) -> str | None:
    for item in _arr(work.get("descriptions")):
        if isinstance(item, str) and item.strip():
            return item.strip()
        record = _obj(item)
        value = _text(record.get("value")) or _text(record.get("description"))
        if value:
            return value
    return None


def _subjects(work: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for item in _arr(work.get("subjects")):
        if isinstance(item, str) and item.strip():
            values.append(item.strip())
            continue
        record = _obj(item)
        value = (
            _text(record.get("subject"))
            or _text(record.get("value"))
            or _text(record.get("label"))
        )
        if value:
            values.append(value)
    return values[:30]


def _authors(work: dict[str, Any]) -> list[str]:
    rows = [_obj(item) for item in _arr(work.get("authors"))]
    rows.sort(key=lambda item: item.get("rank") if isinstance(item.get("rank"), (int, float)) else 999)
    return [name for row in rows if (name := _text(row.get("fullName")))][:25]


def _publication_date(value: Any) -> tuple[date | None, int | None]:
    raw = _text(value)
    if not raw:
        return None, None
    match = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?", raw)
    if not match:
        return None, None
    year = int(match.group(1))
    try:
        parsed = date(year, int(match.group(2) or 1), int(match.group(3) or 1))
    except ValueError:
        parsed = None
    return parsed, year


def _landing_url(work: dict[str, Any], doi: str | None, external_id: str) -> str:
    if doi:
        return f"https://doi.org/{doi}"
    for item in _arr(work.get("instances")):
        record = _obj(item)
        for key in ("url", "landingPage", "webresourceUrl"):
            value = _text(record.get(key))
            if value:
                return value
    return f"{OPENAIRE_API}/research-products/{quote(external_id, safe='')}"


def _is_open_access(work: dict[str, Any]) -> bool | None:
    label = _text(_obj(work.get("bestAccessRight")).get("label"))
    return bool(re.search(r"open", label, re.I)) if label else None


async def _fetch_works(
    client: httpx.AsyncClient,
    ror: str,
    query: str,
    since_year: int,
    page_size: int,
) -> list[dict[str, Any]]:
    params = {
        "rorId": ror,
        "type": "publication",
        "fromPublicationYear": str(since_year),
        "search": query,
        "pageSize": str(page_size),
        "sortBy": "publicationDate DESC",
    }
    response = await client.get(
        f"{OPENAIRE_API}/research-products?{urlencode(params)}",
        headers={"accept": "application/json", "user-agent": "GeoAcademicRadarBot/1.1"},
    )
    if response.status_code in (429, 503):
        raise RuntimeError(f"OpenAIRE deferred HTTP {response.status_code}")
    response.raise_for_status()
    payload = response.json()
    results = payload.get("results") if isinstance(payload, dict) else None
    return [item for item in results or [] if isinstance(item, dict)]


async def _upsert_publication(
    conn: asyncpg.Connection,
    institution_id: str,
    institution_name: str,
    query: str,
    work: dict[str, Any],
    *,
    min_known_citations: int,
) -> tuple[str, bool] | None:
    external_id = _text(work.get("id"))
    title = _text(work.get("mainTitle"))
    if not external_id or not title:
        return None

    subjects = _subjects(work)
    abstract = _description(work)
    evidence_text = " ".join([title, *subjects, abstract or ""])
    if not GEO_RE.search(evidence_text):
        return None

    cited = _citation_count(work)
    # OpenAIRE commonly omits citation indicators. Unknown is not zero: exact
    # ROR affiliation + a geospatial provider query remain strong provenance.
    if cited is not None and cited < min_known_citations:
        return None

    doi = _doi(work)
    pub_date, year = _publication_date(work.get("publicationDate"))
    authors = _authors(work)
    landing_url = _landing_url(work, doi, external_id)
    venue = _text(work.get("publisher"))
    is_oa = _is_open_access(work)
    now = datetime.now(timezone.utc)

    existing = None
    if doi:
        existing = await conn.fetchrow(
            "select id, institution_id from public.publications where lower(doi)=lower($1) limit 1",
            doi,
        )
    if not existing:
        existing = await conn.fetchrow(
            "select id, institution_id from public.publications where source='openaire' and external_id=$1 limit 1",
            external_id,
        )

    inserted = existing is None
    if existing:
        publication_id = str(existing["id"])
        await conn.execute(
            """
            update public.publications
               set doi=$2, title=$3, normalized_title=$4, publication_date=$5, year=$6,
                   venue=$7, authors_text=$8, citation_count=$9, citation_source='openaire',
                   is_open_access=$10, abstract=$11, source='openaire', external_id=$12,
                   landing_url=$13, verification_status='verified', confidence='high',
                   last_verified_at=$14, is_demo=false, updated_at=now()
             where id=$1
            """,
            publication_id,
            doi,
            title[:500],
            _normalized_title(title),
            pub_date,
            year,
            venue,
            ", ".join(authors) or None,
            cited,
            is_oa,
            abstract[:5000] if abstract else None,
            external_id,
            landing_url,
            now,
        )
    else:
        publication_id = str(
            await conn.fetchval(
                """
                insert into public.publications
                    (doi, title, normalized_title, publication_date, year, venue,
                     authors_text, citation_count, citation_source, is_open_access,
                     abstract, source, external_id, landing_url, institution_id,
                     verification_status, confidence, last_verified_at, is_demo)
                values
                    ($1,$2,$3,$4,$5,$6,$7,$8,'openaire',$9,$10,'openaire',$11,$12,$13,
                     'verified','high',$14,false)
                returning id
                """,
                doi,
                title[:500],
                _normalized_title(title),
                pub_date,
                year,
                venue,
                ", ".join(authors) or None,
                cited,
                is_oa,
                abstract[:5000] if abstract else None,
                external_id,
                landing_url,
                institution_id,
                now,
            )
        )
        await conn.execute(
            """
            insert into public.academic_changes(change_type, entity_type, entity_id, title, summary, details)
            values ('NEW_PUBLICATION','publication',$1,$2,$3,$4::jsonb)
            """,
            publication_id,
            title[:500],
            f"Imported from OpenAIRE Graph for {institution_name}",
            {"external_id": external_id, "doi": doi, "provider": "openaire", "query": query},
        )

    await conn.execute(
        """
        insert into public.publication_institutions(publication_id, institution_id)
        values ($1,$2)
        on conflict do nothing
        """,
        publication_id,
        institution_id,
    )

    evidence_url = f"{OPENAIRE_API}/research-products/{quote(external_id, safe='')}"
    exists = await conn.fetchval(
        """
        select 1 from public.record_sources
         where entity_type='publication' and entity_id=$1 and source_url=$2
         limit 1
        """,
        publication_id,
        evidence_url,
    )
    if not exists:
        await conn.execute(
            """
            insert into public.record_sources
                (entity_type, entity_id, source_url, source_organization, source_type,
                 original_title, claim, verification_status, confidence, is_primary,
                 last_checked_at, last_verified_at)
            values
                ('publication',$1,$2,'OpenAIRE Graph','publication_database',$3,
                 'Bibliographic metadata supplied by OpenAIRE Graph with exact ROR affiliation',
                 'verified','high',true,$4,$4)
            """,
            publication_id,
            evidence_url,
            title[:500],
            now,
        )
    return publication_id, inserted


async def run_publication_enrichment(
    pool: asyncpg.Pool,
    *,
    max_institutions: int = 6,
    queries_per_institution: int = 3,
    per_query: int = 12,
    min_known_citations: int = 3,
) -> dict[str, int]:
    """Fill the canonical publication table from exact-ROR OpenAIRE results.

    Institutions with the fewest linked publications go first, so repeated
    scheduled runs naturally rotate through the verified institution set.
    """
    async with pool.acquire() as conn:
        institutions = await conn.fetch(
            """
            select i.id, i.name, i.institution_identifier,
                   count(pi.publication_id)::int as publication_count
              from public.institutions i
              left join public.publication_institutions pi on pi.institution_id=i.id
             where i.is_demo=false
               and i.institution_identifier ~* '^0[a-z0-9]{8}$'
             group by i.id, i.name, i.institution_identifier
             order by count(pi.publication_id) asc, i.name asc
             limit $1
            """,
            max(1, max_institutions),
        )

    seen = 0
    inserted = 0
    updated = 0
    skipped = 0
    since_year = datetime.now(timezone.utc).year - 1
    queries = DOMAIN_QUERIES[: max(1, min(len(DOMAIN_QUERIES), queries_per_institution))]

    timeout = httpx.Timeout(35.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for institution in institutions:
            ror = f"https://ror.org/{institution['institution_identifier']}"
            for query in queries:
                try:
                    works = await _fetch_works(client, ror, query, since_year, max(1, per_query))
                except Exception as exc:
                    print(
                        f"PUBLICATION_PROVIDER_FAILED institution={institution['name']} "
                        f"query={query!r} error={str(exc)[:300]}"
                    )
                    continue
                for work in works:
                    seen += 1
                    try:
                        async with pool.acquire() as conn:
                            async with conn.transaction():
                                result = await _upsert_publication(
                                    conn,
                                    str(institution["id"]),
                                    str(institution["name"]),
                                    query,
                                    work,
                                    min_known_citations=min_known_citations,
                                )
                        if result is None:
                            skipped += 1
                        elif result[1]:
                            inserted += 1
                        else:
                            updated += 1
                    except Exception as exc:
                        skipped += 1
                        print(
                            f"PUBLICATION_WRITE_FAILED institution={institution['name']} "
                            f"error={str(exc)[:400]}"
                        )

    print(
        "PUBLICATION_ENRICHMENT "
        f"institutions={len(institutions)} seen={seen} inserted={inserted} "
        f"updated={updated} skipped={skipped}"
    )
    return {
        "institutions": len(institutions),
        "seen": seen,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
    }
