import asyncio
import os
import re
from pathlib import Path
from urllib.parse import quote

import asyncpg
import httpx

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")
API_URL = os.getenv(
    "GEOACADEMIC_API_URL",
    "https://geoacademic-api-xjh4s3mvyq-ey.a.run.app",
).rstrip("/")

if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", DB_SCHEMA):
    raise SystemExit(f"Invalid DB_SCHEMA: {DB_SCHEMA!r}")

DB_SEARCH_PATH = f"{DB_SCHEMA},extensions,public"


def _counts(rows, key: str) -> dict[str, int]:
    return {str(row[key]): int(row["count"]) for row in rows}


async def _get_json(client: httpx.AsyncClient, path: str) -> dict:
    response = await client.get(path)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{path} did not return a JSON object")
    return payload


def _write_summary(summary: dict, failures: list[str], warnings: list[str]) -> None:
    target = os.getenv("GITHUB_STEP_SUMMARY", "").strip()
    if not target:
        return

    lines = [
        "# GeoAcademic API QA",
        "",
        f"API: `{API_URL}`",
        "",
        "## API checks",
        "",
        "| Metric | Value |",
        "|---|---:|",
        f"| Health | {summary['api_health']} |",
        f"| API events returned | {summary['api_events']} |",
        f"| API opportunities returned | {summary['api_opportunities']} |",
        f"| Pulse items returned | {summary['api_pulse_items']} |",
        f"| Pulse summary total | {summary['api_pulse_total']} |",
        f"| Search probe results | {summary['api_search_items']} |",
        "",
        "## Database checks",
        "",
        "| Metric | Value |",
        "|---|---:|",
        f"| Canonical entities | {summary['canonical_total']} |",
        f"| Public entities | {summary['public_total']} |",
        f"| Signals | {summary['signals_total']} |",
        f"| Registered sources | {summary['sources_total']} |",
        f"| Stored snapshots | {summary['snapshots_total']} |",
        f"| Missing titles | {summary['missing_titles']} |",
        f"| Missing source URLs | {summary['missing_source_urls']} |",
        f"| Duplicate external keys | {summary['duplicate_external_keys']} |",
        f"| Duplicate title/source groups | {summary['duplicate_title_source_groups']} |",
        f"| Deterministic events missing date text | {summary['deterministic_events_missing_dates']} |",
        "",
        "### Public entities by type",
        "",
    ]
    for entity_type, count in sorted(summary["public_by_type"].items()):
        lines.append(f"- **{entity_type}**: {count}")

    lines.extend(["", "### Verification statuses", ""])
    for status, count in sorted(summary["verification_by_status"].items()):
        lines.append(f"- **{status}**: {count}")

    if warnings:
        lines.extend(["", "## Warnings", ""])
        lines.extend(f"- {warning}" for warning in warnings)
    if failures:
        lines.extend(["", "## Failures", ""])
        lines.extend(f"- {failure}" for failure in failures)
    else:
        lines.extend(["", "## Result", "", "✅ QA passed"])

    Path(target).open("a", encoding="utf-8").write("\n".join(lines) + "\n")


async def main() -> None:
    failures: list[str] = []
    warnings: list[str] = []

    conn = await asyncpg.connect(
        DATABASE_URL,
        server_settings={"search_path": DB_SEARCH_PATH},
    )
    try:
        canonical_total = int(await conn.fetchval("SELECT count(*) FROM canonical_entities"))
        public_total = int(await conn.fetchval("SELECT count(*) FROM latest_public_entities"))
        signals_total = int(await conn.fetchval("SELECT count(*) FROM signals"))
        sources_total = int(await conn.fetchval("SELECT count(*) FROM source_registry"))
        snapshots_total = int(await conn.fetchval("SELECT count(*) FROM source_snapshots"))

        public_by_type = _counts(
            await conn.fetch(
                """
                SELECT entity_type, count(*)::int AS count
                FROM latest_public_entities
                GROUP BY entity_type
                ORDER BY entity_type
                """
            ),
            "entity_type",
        )
        verification_by_status = _counts(
            await conn.fetch(
                """
                SELECT verification_status, count(*)::int AS count
                FROM canonical_entities
                GROUP BY verification_status
                ORDER BY verification_status
                """
            ),
            "verification_status",
        )

        missing_titles = int(
            await conn.fetchval(
                "SELECT count(*) FROM canonical_entities WHERE title IS NULL OR btrim(title) = ''"
            )
        )
        missing_source_urls = int(
            await conn.fetchval(
                "SELECT count(*) FROM canonical_entities WHERE source_url IS NULL OR btrim(source_url) = ''"
            )
        )
        duplicate_external_keys = int(
            await conn.fetchval(
                """
                SELECT count(*)
                FROM (
                    SELECT entity_type, external_key
                    FROM canonical_entities
                    WHERE external_key IS NOT NULL
                    GROUP BY entity_type, external_key
                    HAVING count(*) > 1
                ) duplicates
                """
            )
        )
        duplicate_title_source_groups = int(
            await conn.fetchval(
                """
                SELECT count(*)
                FROM (
                    SELECT entity_type, lower(btrim(title)), source_url
                    FROM canonical_entities
                    WHERE source_url IS NOT NULL
                    GROUP BY entity_type, lower(btrim(title)), source_url
                    HAVING count(*) > 1
                ) duplicates
                """
            )
        )
        deterministic_events_missing_dates = int(
            await conn.fetchval(
                """
                SELECT count(*)
                FROM canonical_entities
                WHERE entity_type='event'
                  AND data->>'deterministic_extracted' = 'true'
                  AND coalesce(btrim(data->>'date_text'), '') = ''
                """
            )
        )
        search_probe = await conn.fetchval(
            """
            SELECT title
            FROM latest_public_entities
            WHERE length(btrim(title)) >= 3
            ORDER BY last_seen_at DESC, id
            LIMIT 1
            """
        )
    finally:
        await conn.close()

    if canonical_total == 0:
        failures.append("canonical_entities is empty")
    if public_total == 0:
        failures.append("latest_public_entities is empty")
    if sources_total == 0:
        failures.append("source_registry is empty")
    if snapshots_total == 0:
        failures.append("source_snapshots is empty")
    if missing_titles:
        failures.append(f"{missing_titles} canonical entities have missing/blank titles")
    if missing_source_urls:
        failures.append(f"{missing_source_urls} canonical entities have missing/blank source URLs")
    if duplicate_external_keys:
        failures.append(f"{duplicate_external_keys} duplicate external-key groups exist")
    if duplicate_title_source_groups:
        warnings.append(
            f"{duplicate_title_source_groups} exact title/source duplicate groups exist; review deduplication"
        )
    if deterministic_events_missing_dates:
        warnings.append(
            f"{deterministic_events_missing_dates} deterministic event records are missing date_text"
        )
    if verification_by_status.get("verified", 0) == 0:
        warnings.append("No canonical entities are verified yet; verifier promotion has not happened")

    api_health = "failed"
    api_events = 0
    api_opportunities = 0
    api_pulse_items = 0
    api_pulse_total = 0
    api_search_items = 0

    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(
        base_url=API_URL,
        follow_redirects=True,
        timeout=timeout,
        headers={"User-Agent": "GeoAcademic-QA/1.0"},
    ) as client:
        try:
            health = await _get_json(client, "/health")
            if health.get("ok") is not True:
                failures.append("/health did not report ok=true")
            elif health.get("database_schema") != DB_SCHEMA:
                failures.append(
                    f"/health database_schema={health.get('database_schema')!r}, expected {DB_SCHEMA!r}"
                )
            else:
                api_health = "ok"
        except Exception as exc:
            failures.append(f"/health failed: {type(exc).__name__}: {exc}")

        for entity_type, metric_name in (("event", "events"), ("opportunity", "opportunities")):
            try:
                payload = await _get_json(client, f"/v1/latest/{entity_type}?limit=200")
                items = payload.get("items")
                if not isinstance(items, list):
                    raise RuntimeError("items is not a list")
                actual = len(items)
                if entity_type == "event":
                    api_events = actual
                else:
                    api_opportunities = actual
                expected = public_by_type.get(entity_type, 0)
                expected_returned = min(expected, 200)
                if actual != expected_returned:
                    failures.append(
                        f"API {metric_name} returned {actual}, expected {expected_returned} from latest_public_entities"
                    )
            except Exception as exc:
                failures.append(
                    f"/v1/latest/{entity_type} failed: {type(exc).__name__}: {exc}"
                )

        try:
            pulse = await _get_json(client, "/v1/pulse/latest?limit=200&hours=720")
            items = pulse.get("items")
            if not isinstance(items, list):
                raise RuntimeError("items is not a list")
            api_pulse_items = len(items)
        except Exception as exc:
            failures.append(f"/v1/pulse/latest failed: {type(exc).__name__}: {exc}")

        try:
            pulse_summary = await _get_json(client, "/v1/pulse/summary?hours=720")
            api_pulse_total = int(pulse_summary.get("total", 0))
            if api_pulse_total < api_pulse_items:
                failures.append(
                    f"Pulse summary total {api_pulse_total} is smaller than returned pulse items {api_pulse_items}"
                )
        except Exception as exc:
            failures.append(f"/v1/pulse/summary failed: {type(exc).__name__}: {exc}")

        if search_probe:
            try:
                query = quote(str(search_probe)[:120])
                search = await _get_json(client, f"/v1/search?q={query}&limit=20")
                items = search.get("items")
                if not isinstance(items, list):
                    raise RuntimeError("items is not a list")
                api_search_items = len(items)
                if not items:
                    failures.append(
                        f"Search returned no result for known public title probe: {str(search_probe)[:100]!r}"
                    )
            except Exception as exc:
                failures.append(f"/v1/search failed: {type(exc).__name__}: {exc}")
        else:
            warnings.append("No public entity was available for the search probe")

    summary = {
        "api_health": api_health,
        "api_events": api_events,
        "api_opportunities": api_opportunities,
        "api_pulse_items": api_pulse_items,
        "api_pulse_total": api_pulse_total,
        "api_search_items": api_search_items,
        "canonical_total": canonical_total,
        "public_total": public_total,
        "signals_total": signals_total,
        "sources_total": sources_total,
        "snapshots_total": snapshots_total,
        "missing_titles": missing_titles,
        "missing_source_urls": missing_source_urls,
        "duplicate_external_keys": duplicate_external_keys,
        "duplicate_title_source_groups": duplicate_title_source_groups,
        "deterministic_events_missing_dates": deterministic_events_missing_dates,
        "public_by_type": public_by_type,
        "verification_by_status": verification_by_status,
    }

    print(
        "QA_API "
        f"health={api_health} events={api_events} opportunities={api_opportunities} "
        f"pulse_items={api_pulse_items} pulse_total={api_pulse_total} search_items={api_search_items}"
    )
    print(
        "QA_DB "
        f"canonical={canonical_total} public={public_total} signals={signals_total} "
        f"sources={sources_total} snapshots={snapshots_total}"
    )
    print(
        "QA_QUALITY "
        f"missing_titles={missing_titles} missing_source_urls={missing_source_urls} "
        f"duplicate_external_keys={duplicate_external_keys} "
        f"duplicate_title_source_groups={duplicate_title_source_groups} "
        f"deterministic_events_missing_dates={deterministic_events_missing_dates}"
    )
    print(
        "QA_TYPES "
        + " ".join(f"{key}={value}" for key, value in sorted(public_by_type.items()))
    )
    print(
        "QA_VERIFICATION "
        + " ".join(f"{key}={value}" for key, value in sorted(verification_by_status.items()))
    )
    for warning in warnings:
        print(f"QA_WARNING {warning}")
    for failure in failures:
        print(f"QA_FAILURE {failure}")

    _write_summary(summary, failures, warnings)

    if failures:
        raise SystemExit(1)
    print(f"QA_OK api={API_URL} schema={DB_SCHEMA}")


if __name__ == "__main__":
    asyncio.run(main())
