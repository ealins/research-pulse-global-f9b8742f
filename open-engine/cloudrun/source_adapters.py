"""Curated-source discovery adapters for the GeoAcademic knowledge hub.

Adapters query only explicitly registered authoritative sources. They emit fresh
content URLs into source_registry; the existing FETCH/EXTRACT pipeline then
processes those URLs. No open-ended web crawling is performed here.
"""
from __future__ import annotations

import asyncio
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from typing import Any

import asyncpg
import httpx
from bs4 import BeautifulSoup

UA = "GeoAcademic-SourceAdapter/1.0 (+https://geoacademic.app)"
MAX_CANDIDATES = 500


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    try:
        parsed = parsedate_to_datetime(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _within_window(value: Any, days: int) -> bool:
    parsed = _parse_date(value)
    return parsed is None or parsed >= _now() - timedelta(days=max(1, days))


def _clean_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    url = value.strip()
    if not url or not url.startswith(("http://", "https://")):
        return None
    return url.split("#", 1)[0]


def _topic_terms(config: dict[str, Any]) -> list[str]:
    raw = config.get("queries") or []
    return [str(v).strip() for v in raw if str(v).strip()]


async def _register_candidates(
    pool: asyncpg.Pool,
    adapter: asyncpg.Record,
    candidates: list[dict[str, Any]],
) -> int:
    inserted = 0
    async with pool.acquire() as conn:
        for candidate in candidates[:MAX_CANDIDATES]:
            url = _clean_url(candidate.get("url"))
            if not url:
                continue
            if url == adapter["url"]:
                continue
            exists = await conn.fetchval(
                "SELECT 1 FROM source_registry WHERE url=$1",
                url,
            )
            if exists:
                continue
            await conn.execute(
                """
                INSERT INTO source_registry(
                    name,url,source_type,entity_hint,trust_level,
                    refresh_interval_minutes,active,category,access_method,
                    source_kind,config,retention_days,parent_source_id,
                    external_id,content_scope,next_check_at
                ) VALUES(
                    $1,$2,$3,$4,$5,$6,true,$7,'html','content',$8::jsonb,
                    $9,$10,$11,'fresh',now()
                )
                ON CONFLICT(url) DO NOTHING
                """,
                (candidate.get("title") or adapter["name"] or url)[:500],
                url,
                str(adapter["category"] or "general"),
                adapter["entity_hint"],
                adapter["trust_level"],
                10080,
                str(adapter["category"] or "general"),
                json.dumps({
                    "discovered_by": adapter["name"],
                    "published_at": candidate.get("published_at"),
                    "external_id": candidate.get("external_id"),
                }),
                int(adapter["retention_days"] or 30),
                adapter["id"],
                str(candidate.get("external_id") or url)[:500],
            )
            inserted += 1
    return inserted


async def _wikidata(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    query = (adapter["config"] or {}).get("query")
    if not query:
        return []
    response = await client.get(
        adapter["url"],
        params={"query": query, "format": "json"},
        headers={"Accept": "application/sparql-results+json", "User-Agent": UA},
        timeout=45,
    )
    response.raise_for_status()
    bindings = response.json().get("results", {}).get("bindings", [])
    result = []
    for row in bindings:
        website = row.get("website", {}).get("value")
        university = row.get("university", {}).get("value")
        label = row.get("universityLabel", {}).get("value")
        if website:
            result.append({
                "url": website,
                "title": label or university,
                "external_id": university,
            })
    return result


async def _openalex(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    since = (_now() - timedelta(days=int(adapter["retention_days"] or 365))).date().isoformat()
    params = {
        "search": config.get("search", ""),
        "filter": f"from_publication_date:{since}",
        "sort": "publication_date:desc",
        "per-page": int(config.get("per_page", 100)),
        "mailto": "geoacademic.app@proton.me",
    }
    response = await client.get(adapter["url"], params=params, headers={"User-Agent": UA}, timeout=45)
    response.raise_for_status()
    result = []
    for item in response.json().get("results", []):
        landing = _clean_url((item.get("primary_location") or {}).get("landing_page_url"))
        doi = _clean_url(item.get("doi"))
        url = landing or doi or _clean_url(item.get("id"))
        if url:
            result.append({
                "url": url,
                "title": item.get("display_name") or item.get("title"),
                "external_id": item.get("id") or doi,
                "published_at": item.get("publication_date"),
            })
    return result


async def _crossref(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    since = (_now() - timedelta(days=int(adapter["retention_days"] or 365))).date().isoformat()
    params = {
        "query": config.get("query", ""),
        "filter": f"from-pub-date:{since}",
        "sort": "published",
        "order": "desc",
        "rows": int(config.get("rows", 100)),
        "select": "DOI,title,published,URL",
    }
    response = await client.get(adapter["url"], params=params, headers={"User-Agent": UA}, timeout=45)
    response.raise_for_status()
    result = []
    for item in response.json().get("message", {}).get("items", []):
        title = (item.get("title") or [None])[0]
        url = _clean_url(item.get("URL")) or _clean_url(
            f"https://doi.org/{item['DOI']}" if item.get("DOI") else None
        )
        published = item.get("published", {}).get("date-parts", [[None]])[0]
        published_at = "-".join(str(v) for v in published if v)
        if url:
            result.append({
                "url": url,
                "title": title,
                "external_id": item.get("DOI"),
                "published_at": published_at,
            })
    return result


async def _github(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    recent = (_now() - timedelta(days=int(adapter["retention_days"] or 60))).date().isoformat()
    headers = {"Accept": "application/vnd.github+json", "User-Agent": UA}
    queries = _topic_terms(config)
    result = []
    for term in queries:
        params = {
            "q": f'"{term}" pushed:>{recent}',
            "sort": "updated",
            "order": "desc",
            "per_page": int(config.get("per_page", 30)),
        }
        response = await client.get(adapter["url"], params=params, headers=headers, timeout=30)
        if response.status_code == 403:
            break
        response.raise_for_status()
        for item in response.json().get("items", []):
            result.append({
                "url": item.get("html_url"),
                "title": item.get("full_name"),
                "external_id": item.get("full_name"),
            })
    return result


async def _arxiv(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    result = []
    for query in _topic_terms(config):
        response = await client.get(
            adapter["url"],
            params={
                "search_query": query,
                "start": 0,
                "max_results": int(config.get("max_results", 50)),
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            },
            headers={"User-Agent": UA},
            timeout=45,
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall("a:entry", ns):
            link = None
            for node in entry.findall("a:link", ns):
                if node.attrib.get("rel") in (None, "alternate"):
                    link = node.attrib.get("href")
                    break
            if link:
                result.append({
                    "url": link,
                    "title": (entry.findtext("a:title", namespaces=ns) or "").strip(),
                    "external_id": entry.findtext("a:id", namespaces=ns),
                    "published_at": entry.findtext("a:published", namespaces=ns),
                })
    return [item for item in result if _within_window(item.get("published_at"), int(adapter["retention_days"] or 365))]


async def _zenodo(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    result = []
    for term in _topic_terms(config):
        response = await client.get(
            adapter["url"],
            params={"q": term, "sort": "mostrecent", "size": int(config.get("size", 25))},
            headers={"User-Agent": UA},
            timeout=45,
        )
        response.raise_for_status()
        for item in response.json().get("hits", {}).get("hits", []):
            links = item.get("links") or {}
            url = _clean_url(links.get("html") or links.get("self"))
            created = item.get("created")
            if url and _within_window(created, int(adapter["retention_days"] or 90)):
                result.append({
                    "url": url,
                    "title": item.get("metadata", {}).get("title"),
                    "external_id": str(item.get("id") or ""),
                    "published_at": created,
                })
    return result


async def _rss(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    response = await client.get(adapter["url"], headers={"User-Agent": UA}, timeout=30)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    result = []
    # RSS 2.0
    for item in root.findall(".//item"):
        link = item.findtext("link")
        title = item.findtext("title")
        pub = item.findtext("pubDate") or item.findtext("date")
        if link and _within_window(pub, int(adapter["retention_days"] or 30)):
            result.append({"url": link, "title": title, "published_at": pub, "external_id": item.findtext("guid") or link})
    # Atom
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("a:entry", ns):
        link = next((n.attrib.get("href") for n in entry.findall("a:link", ns) if n.attrib.get("href")), None)
        title = entry.findtext("a:title", namespaces=ns)
        updated = entry.findtext("a:updated", namespaces=ns)
        if link and _within_window(updated, int(adapter["retention_days"] or 30)):
            result.append({"url": link, "title": title, "published_at": updated, "external_id": entry.findtext("a:id", namespaces=ns) or link})
    return result


async def _site_links(client: httpx.AsyncClient, adapter: asyncpg.Record) -> list[dict[str, Any]]:
    config = adapter["config"] or {}
    response = await client.get(adapter["url"], headers={"User-Agent": UA}, timeout=35)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    allowed_domains = set(config.get("allowed_domains") or [urllib.parse.urlparse(adapter["url"]).netloc])
    allowed_paths = [str(p) for p in (config.get("allowed_paths") or [])]
    result = []
    for anchor in soup.find_all("a", href=True):
        url = _clean_url(urllib.parse.urljoin(adapter["url"], anchor["href"]))
        if not url:
            continue
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc not in allowed_domains:
            continue
        if allowed_paths and not any(parsed.path.startswith(prefix) for prefix in allowed_paths):
            continue
        title = " ".join(anchor.get_text(" ", strip=True).split())
        if len(title) >= 3:
            result.append({"url": url, "title": title})
    return result


ADAPTERS = {
    "wikidata_sparql": _wikidata,
    "openalex": _openalex,
    "crossref": _crossref,
    "github": _github,
    "arxiv": _arxiv,
    "zenodo": _zenodo,
    "rss": _rss,
    "site_links": _site_links,
}


async def run_source_adapters(pool: asyncpg.Pool) -> dict[str, int]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM source_registry
            WHERE active=true
              AND source_kind='adapter'
              AND coalesce(next_check_at,created_at) <= now()
            ORDER BY CASE trust_level WHEN 'official' THEN 0 ELSE 1 END, next_check_at NULLS FIRST, id
            LIMIT 50
            """
        )

    totals = {"adapters": 0, "candidates": 0, "failed": 0}
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for adapter in rows:
            totals["adapters"] += 1
            method = str(adapter["access_method"])
            handler = ADAPTERS.get(method)
            if handler is None:
                continue
            try:
                candidates = await handler(client, adapter)
                inserted = await _register_candidates(pool, adapter, candidates)
                totals["candidates"] += inserted
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE source_registry
                        SET last_checked_at=now(),
                            next_check_at=now() + refresh_interval_minutes * interval '1 minute',
                            updated_at=now()
                        WHERE id=$1
                        """,
                        adapter["id"],
                    )
                print(f"SOURCE_ADAPTER name={adapter['name']!r} method={method} discovered={len(candidates)} new={inserted}")
            except Exception as exc:
                totals["failed"] += 1
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE source_registry SET last_checked_at=now(), next_check_at=now()+interval '2 hours', updated_at=now() WHERE id=$1",
                        adapter["id"],
                    )
                print(f"SOURCE_ADAPTER_FAILED name={adapter['name']!r} method={method} error={exc}")

    return totals
