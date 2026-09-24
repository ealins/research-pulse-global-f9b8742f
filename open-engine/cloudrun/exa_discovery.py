"""Bounded Exa semantic discovery for the GeoAcademic Open Engine.

Exa only suggests public URLs. It never writes canonical entities or trusts
Exa's snippets as evidence: every candidate is registered at low trust, then
passes through the existing scheduler, safe fetcher, extractor, and verifier.
"""

from __future__ import annotations

import ipaddress
import json
import os
import re
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg
import httpx

EXA_API_URL = "https://api.exa.ai/search"
PROVIDER_NAME = "exa"
ALLOWED_SEARCH_TYPES = frozenset({"auto", "neural", "fast", "deep", "instant"})
TRACKING_PARAMETERS = frozenset(
    {
        "fbclid",
        "gclid",
        "ref",
        "referrer",
        "source",
        "campaign",
        "trk",
        "tracking",
    }
)
BLOCKED_HOSTS = frozenset({"localhost", "localhost.localdomain", "0.0.0.0", "::1"})


@dataclass(frozen=True)
class DiscoveryQuery:
    query: str
    entity_hint: str
    refresh_interval_minutes: int


DEFAULT_QUERIES: tuple[DiscoveryQuery, ...] = (
    DiscoveryQuery(
        query=(
            "official university or research institute PhD postdoctoral research "
            "assistant position in remote sensing photogrammetry geospatial GIS "
            "earth observation"
        ),
        entity_hint="opportunity",
        refresh_interval_minutes=720,
    ),
    DiscoveryQuery(
        query=(
            "official photogrammetry remote sensing geospatial earth observation "
            "conference workshop call for papers 2026"
        ),
        entity_hint="event",
        refresh_interval_minutes=1440,
    ),
    DiscoveryQuery(
        query=(
            "official geospatial earth observation remote sensing research project "
            "funding call programme"
        ),
        entity_hint="project",
        refresh_interval_minutes=4320,
    ),
)


@dataclass(frozen=True)
class ExaSettings:
    api_key: str
    enabled: bool
    interval_minutes: int
    retry_minutes: int
    lease_minutes: int
    max_queries: int
    results_per_query: int
    max_characters: int
    timeout_seconds: float
    search_type: str
    include_domains: tuple[str, ...]
    exclude_domains: tuple[str, ...]

    @classmethod
    def from_environment(cls) -> "ExaSettings":
        search_type = os.getenv("EXA_DISCOVERY_TYPE", "auto").strip().lower()
        if search_type not in ALLOWED_SEARCH_TYPES:
            search_type = "auto"

        return cls(
            api_key=os.getenv("EXA_API_KEY", "").strip(),
            enabled=_environment_flag("EXA_DISCOVERY_ENABLED", False),
            interval_minutes=_bounded_int("EXA_DISCOVERY_INTERVAL_MINUTES", 720, 30, 10080),
            retry_minutes=_bounded_int("EXA_DISCOVERY_RETRY_MINUTES", 60, 5, 1440),
            lease_minutes=_bounded_int("EXA_DISCOVERY_LEASE_MINUTES", 20, 5, 120),
            max_queries=_bounded_int("EXA_DISCOVERY_MAX_QUERIES", 3, 1, len(DEFAULT_QUERIES)),
            results_per_query=_bounded_int("EXA_DISCOVERY_RESULTS_PER_QUERY", 8, 1, 25),
            max_characters=_bounded_int("EXA_DISCOVERY_MAX_CHARACTERS", 800, 0, 4000),
            timeout_seconds=_bounded_float("EXA_DISCOVERY_TIMEOUT_SECONDS", 20, 5, 60),
            search_type=search_type,
            include_domains=_domain_list("EXA_DISCOVERY_INCLUDE_DOMAINS"),
            exclude_domains=_domain_list("EXA_DISCOVERY_EXCLUDE_DOMAINS"),
        )


@dataclass(frozen=True)
class ExaCandidate:
    url: str
    title: str
    entity_hint: str
    refresh_interval_minutes: int


@dataclass(frozen=True)
class ExaDiscoveryResult:
    status: str
    reason: str | None = None
    queries: int = 0
    results_received: int = 0
    candidates_registered: int = 0

    def as_log_fields(self) -> dict[str, Any]:
        return {
            "provider": PROVIDER_NAME,
            "status": self.status,
            "reason": self.reason,
            "queries": self.queries,
            "results_received": self.results_received,
            "candidates_registered": self.candidates_registered,
        }


class ExaRequestError(RuntimeError):
    """A sanitized Exa request failure that never includes credentials."""

    def __init__(self, message: str, retry_after_minutes: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_minutes = retry_after_minutes


def _environment_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def _bounded_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def _domain_list(name: str) -> tuple[str, ...]:
    values: list[str] = []
    for raw_value in os.getenv(name, "").split(","):
        value = raw_value.strip().lower().lstrip(".")
        if value and re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?", value):
            values.append(value)
    return tuple(dict.fromkeys(values))[:50]


def canonicalize_url(value: object) -> str | None:
    """Return a safe, stable public HTTP(S) URL or ``None``.

    DNS-level SSRF protection remains the fetch worker's responsibility. This
    early filter rejects malformed, credentialed, local, and literal-private
    targets before they enter the durable source registry.
    """

    if not isinstance(value, str) or not value.strip():
        return None

    try:
        parsed = urlsplit(value.strip())
        port = parsed.port
    except ValueError:
        return None

    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        return None
    if parsed.username or parsed.password:
        return None

    host = parsed.hostname.rstrip(".").lower()
    if (
        not host
        or host in BLOCKED_HOSTS
        or host.endswith((".local", ".localhost", ".internal", ".test"))
    ):
        return None

    try:
        if not ipaddress.ip_address(host).is_global:
            return None
    except ValueError:
        pass

    netloc = f"[{host}]" if ":" in host else host
    if port and port not in {80, 443}:
        netloc = f"{netloc}:{port}"

    filtered_query = [
        (key, item)
        for key, item in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMETERS and not key.lower().startswith("utm_")
    ]
    return urlunsplit(
        (
            parsed.scheme.lower(),
            netloc,
            parsed.path or "/",
            urlencode(filtered_query, doseq=True),
            "",
        )
    )


def _title_for_result(result: Mapping[str, Any], canonical_url: str) -> str:
    raw_title = result.get("title")
    if isinstance(raw_title, str):
        title = " ".join(raw_title.split())
        if title:
            return title[:300]
    return urlsplit(canonical_url).hostname or canonical_url


def candidate_from_result(result: Mapping[str, Any], query: DiscoveryQuery) -> ExaCandidate | None:
    canonical_url = canonicalize_url(result.get("url"))
    if not canonical_url:
        return None
    return ExaCandidate(
        url=canonical_url,
        title=_title_for_result(result, canonical_url),
        entity_hint=query.entity_hint,
        refresh_interval_minutes=query.refresh_interval_minutes,
    )


def build_search_payload(settings: ExaSettings, query: DiscoveryQuery) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "query": query.query,
        "type": settings.search_type,
        "numResults": settings.results_per_query,
        "contents": {"text": {"maxCharacters": settings.max_characters}},
    }
    if settings.include_domains:
        payload["includeDomains"] = list(settings.include_domains)
    if settings.exclude_domains:
        payload["excludeDomains"] = list(settings.exclude_domains)
    return payload


def _retry_after_minutes(response: httpx.Response) -> int | None:
    value = response.headers.get("retry-after", "").strip()
    if value.isdigit():
        return max(1, min(1440, (int(value) + 59) // 60))
    return None


async def _search(
    client: httpx.AsyncClient,
    settings: ExaSettings,
    query: DiscoveryQuery,
) -> list[Mapping[str, Any]]:
    try:
        response = await client.post(EXA_API_URL, json=build_search_payload(settings, query))
    except httpx.HTTPError as error:
        raise ExaRequestError(f"Exa request failed: {type(error).__name__}") from error

    if not response.is_success:
        raise ExaRequestError(
            f"Exa search returned HTTP {response.status_code}",
            retry_after_minutes=_retry_after_minutes(response),
        )

    try:
        payload: Any = response.json()
    except ValueError as error:
        raise ExaRequestError("Exa search returned invalid JSON") from error

    results = payload.get("results") if isinstance(payload, Mapping) else None
    if not isinstance(results, list):
        raise ExaRequestError("Exa search returned an invalid response shape")
    return [item for item in results if isinstance(item, Mapping)]


async def _claim_provider_run(
    pool: asyncpg.Pool,
    settings: ExaSettings,
    *,
    force: bool,
) -> bool:
    async with pool.acquire() as connection:
        await connection.execute(
            """
            INSERT INTO ingestion_provider_state (provider, next_run_at)
            VALUES ($1, now() - interval '1 second')
            ON CONFLICT (provider) DO NOTHING
            """,
            PROVIDER_NAME,
        )
        due_clause = "TRUE" if force else "(next_run_at IS NULL OR next_run_at <= now())"
        row = await connection.fetchrow(
            f"""
            UPDATE ingestion_provider_state
            SET
                status = 'RUNNING',
                last_started_at = now(),
                lease_expires_at = now() + make_interval(mins => $2::int),
                next_run_at = now() + make_interval(mins => $3::int),
                last_error = NULL,
                updated_at = now()
            WHERE provider = $1
              AND {due_clause}
              AND (status <> 'RUNNING' OR lease_expires_at IS NULL OR lease_expires_at <= now())
            RETURNING provider
            """,
            PROVIDER_NAME,
            settings.lease_minutes,
            settings.interval_minutes,
        )
    return row is not None


async def _finish_provider_run(
    pool: asyncpg.Pool,
    settings: ExaSettings,
    *,
    status: str,
    metadata: Mapping[str, Any],
    error: str | None = None,
    retry_minutes: int | None = None,
) -> None:
    next_run_minutes = retry_minutes if retry_minutes is not None else settings.interval_minutes
    async with pool.acquire() as connection:
        await connection.execute(
            """
            UPDATE ingestion_provider_state
            SET
                status = $2,
                last_finished_at = now(),
                lease_expires_at = NULL,
                next_run_at = now() + make_interval(mins => $3::int),
                last_error = $4,
                metadata = $5::jsonb,
                updated_at = now()
            WHERE provider = $1
            """,
            PROVIDER_NAME,
            status,
            next_run_minutes,
            error[:500] if error else None,
            json.dumps(dict(metadata), sort_keys=True),
        )


async def _register_candidates(pool: asyncpg.Pool, candidates: list[ExaCandidate]) -> int:
    registered = 0
    async with pool.acquire() as connection:
        for candidate in candidates:
            await connection.execute(
                """
                INSERT INTO source_registry (
                    name,
                    url,
                    source_type,
                    entity_hint,
                    trust_level,
                    refresh_interval_minutes,
                    active,
                    next_check_at
                )
                VALUES ($1, $2, 'exa_discovery', $3, 'candidate', $4, true, now())
                ON CONFLICT (url) DO UPDATE
                SET
                    name = CASE
                        WHEN source_registry.name IS NULL OR source_registry.name = ''
                            THEN EXCLUDED.name
                        ELSE source_registry.name
                    END,
                    entity_hint = COALESCE(source_registry.entity_hint, EXCLUDED.entity_hint),
                    source_type = CASE
                        WHEN source_registry.source_type = 'web' THEN EXCLUDED.source_type
                        ELSE source_registry.source_type
                    END,
                    active = true,
                    updated_at = now()
                """,
                candidate.title,
                candidate.url,
                candidate.entity_hint,
                candidate.refresh_interval_minutes,
            )
            registered += 1
    return registered


async def discover_and_register(
    pool: asyncpg.Pool,
    *,
    force: bool = False,
) -> ExaDiscoveryResult:
    """Search Exa within fixed budgets and register safe candidate sources.

    Failures are deliberately contained: Exa is an optional discovery provider
    and must never prevent the normal source scheduler from operating.
    """

    settings = ExaSettings.from_environment()
    if not settings.enabled:
        return ExaDiscoveryResult(status="DISABLED", reason="EXA_DISCOVERY_ENABLED is false")
    if not settings.api_key:
        return ExaDiscoveryResult(status="DISABLED", reason="EXA_API_KEY is not configured")

    try:
        claimed = await _claim_provider_run(pool, settings, force=force)
    except asyncpg.UndefinedTableError:
        return ExaDiscoveryResult(
            status="UNAVAILABLE",
            reason="Open Engine migration 005_exa_discovery.sql has not been applied",
        )

    if not claimed:
        return ExaDiscoveryResult(status="SKIPPED", reason="provider cadence or lease is active")

    queries = DEFAULT_QUERIES[: settings.max_queries]
    results_received = 0
    candidates_by_url: dict[str, ExaCandidate] = {}
    try:
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "GeoAcademicOpenEngine/1.0",
            "x-api-key": settings.api_key,
        }
        timeout = httpx.Timeout(settings.timeout_seconds)
        async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=False) as client:
            for query in queries:
                results = await _search(client, settings, query)
                results_received += len(results)
                for result in results:
                    candidate = candidate_from_result(result, query)
                    if candidate:
                        candidates_by_url.setdefault(candidate.url, candidate)

        registered = await _register_candidates(pool, list(candidates_by_url.values()))
        metadata = {
            "queries": len(queries),
            "results_received": results_received,
            "candidates_registered": registered,
        }
        await _finish_provider_run(pool, settings, status="SUCCESS", metadata=metadata)
        return ExaDiscoveryResult(status="SUCCESS", **metadata)
    except ExaRequestError as error:
        retry_minutes = error.retry_after_minutes or settings.retry_minutes
        metadata = {"queries": len(queries), "results_received": results_received, "candidates_registered": 0}
        await _finish_provider_run(
            pool,
            settings,
            status="FAILED",
            metadata=metadata,
            error=str(error),
            retry_minutes=retry_minutes,
        )
        return ExaDiscoveryResult(status="FAILED", reason=str(error), **metadata)
    except Exception as error:  # Provider failures must not stop core ingestion.
        metadata = {"queries": len(queries), "results_received": results_received, "candidates_registered": 0}
        safe_error = f"{type(error).__name__}: {str(error)[:400]}"
        await _finish_provider_run(
            pool,
            settings,
            status="FAILED",
            metadata=metadata,
            error=safe_error,
            retry_minutes=settings.retry_minutes,
        )
        return ExaDiscoveryResult(status="FAILED", reason=safe_error, **metadata)