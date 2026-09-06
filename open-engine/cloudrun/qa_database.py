import asyncio
import os
import re
from pathlib import Path

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")


def validate_identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise SystemExit(f"Unsafe PostgreSQL schema name: {value!r}")
    return value


async def scalar(conn: asyncpg.Connection, sql: str) -> int:
    return int(await conn.fetchval(sql) or 0)


async def main() -> None:
    schema = validate_identifier(DB_SCHEMA)
    failures: list[str] = []
    warnings: list[str] = []

    conn = await asyncpg.connect(DATABASE_URL, command_timeout=60)
    try:
        await conn.execute(f'SET search_path TO "{schema}", extensions, public')

        canonical = await scalar(conn, "SELECT count(*) FROM canonical_entities")
        public = await scalar(conn, "SELECT count(*) FROM latest_public_entities")
        signals = await scalar(conn, "SELECT count(*) FROM signals")
        sources = await scalar(conn, "SELECT count(*) FROM record_sources")
        snapshots = await scalar(conn, "SELECT count(*) FROM source_snapshots")
        events = await scalar(conn, "SELECT count(*) FROM latest_public_entities WHERE entity_type='event'")
        opportunities = await scalar(conn, "SELECT count(*) FROM latest_public_entities WHERE entity_type='opportunity'")

        missing_titles = await scalar(
            conn,
            "SELECT count(*) FROM canonical_entities WHERE title IS NULL OR btrim(title)=''",
        )
        missing_source_urls = await scalar(
            conn,
            "SELECT count(*) FROM canonical_entities WHERE source_url IS NULL OR btrim(source_url)=''",
        )
        duplicate_external_keys = await scalar(
            conn,
            """
            SELECT count(*) FROM (
              SELECT entity_type, external_key
              FROM canonical_entities
              WHERE external_key IS NOT NULL
              GROUP BY entity_type, external_key
              HAVING count(*) > 1
            ) d
            """,
        )
        duplicate_title_sources = await scalar(
            conn,
            """
            SELECT count(*) FROM (
              SELECT entity_type, lower(btrim(title)), source_url
              FROM canonical_entities
              WHERE source_url IS NOT NULL
              GROUP BY entity_type, lower(btrim(title)), source_url
              HAVING count(*) > 1
            ) d
            """,
        )
        missing_slugs = await scalar(
            conn,
            "SELECT count(*) FROM latest_public_entities WHERE slug IS NULL OR btrim(slug)=''",
        )
        duplicate_slugs = await scalar(
            conn,
            """
            SELECT count(*) FROM (
              SELECT entity_type, slug
              FROM latest_public_entities
              WHERE slug IS NOT NULL AND btrim(slug)<>''
              GROUP BY entity_type, slug
              HAVING count(*) > 1
            ) d
            """,
        )
        deterministic_events_missing_dates = await scalar(
            conn,
            """
            SELECT count(*)
            FROM canonical_entities
            WHERE entity_type='event'
              AND data->>'deterministic_extracted'='true'
              AND (
                coalesce(btrim(data->>'date_text'),'')=''
                OR coalesce(btrim(data->>'start_date'),'')=''
                OR coalesce(btrim(data->>'end_date'),'')=''
              )
            """,
        )
        bad_canonical_json = await scalar(
            conn,
            "SELECT count(*) FROM canonical_entities WHERE coalesce(jsonb_typeof(data),'null') <> 'object'",
        )
        bad_signal_json = await scalar(
            conn,
            "SELECT count(*) FROM signals WHERE coalesce(jsonb_typeof(data),'null') <> 'object'",
        )
        bad_evidence_json = await scalar(
            conn,
            "SELECT count(*) FROM record_sources WHERE coalesce(jsonb_typeof(evidence),'null') <> 'object'",
        )
        off_scope_public = await scalar(
            conn,
            """
            SELECT count(*)
            FROM latest_public_entities
            WHERE entity_type='opportunity'
              AND coalesce(source_url,'') ~* '^https?://(www[.])?egu[.]eu/g/jobs/?'
              AND NOT geoacademic_scope_text_matches(title, data)
            """,
        )
        needs_review = await scalar(
            conn,
            "SELECT count(*) FROM canonical_entities WHERE verification_status='needs_review'",
        )
        verified = await scalar(
            conn,
            "SELECT count(*) FROM canonical_entities WHERE verification_status='verified'",
        )
    finally:
        await conn.close()

    required_nonzero = {
        "canonical_entities": canonical,
        "public_entities": public,
        "record_sources": sources,
        "source_snapshots": snapshots,
        "events": events,
        "opportunities": opportunities,
    }
    for name, value in required_nonzero.items():
        if value < 1:
            failures.append(f"{name} is empty")

    exact_zero = {
        "missing_titles": missing_titles,
        "missing_source_urls": missing_source_urls,
        "duplicate_external_key_groups": duplicate_external_keys,
        "duplicate_title_source_groups": duplicate_title_sources,
        "missing_public_slugs": missing_slugs,
        "duplicate_public_slug_groups": duplicate_slugs,
        "deterministic_events_missing_dates": deterministic_events_missing_dates,
        "non_object_canonical_json": bad_canonical_json,
        "non_object_signal_json": bad_signal_json,
        "non_object_record_source_evidence": bad_evidence_json,
        "off_scope_public_opportunities": off_scope_public,
    }
    for name, value in exact_zero.items():
        if value:
            failures.append(f"{name}={value}, expected 0")

    if verified < 1:
        warnings.append("No verified canonical entities are present")

    print(
        "QA_DATABASE "
        f"canonical={canonical} public={public} signals={signals} sources={sources} snapshots={snapshots} "
        f"events={events} opportunities={opportunities} verified={verified} needs_review={needs_review}"
    )
    print(
        "QA_DATABASE_QUALITY "
        f"missing_titles={missing_titles} missing_source_urls={missing_source_urls} "
        f"duplicate_external={duplicate_external_keys} duplicate_title_source={duplicate_title_sources} "
        f"missing_slugs={missing_slugs} duplicate_slugs={duplicate_slugs} "
        f"missing_dates={deterministic_events_missing_dates} bad_canonical_json={bad_canonical_json} "
        f"bad_signal_json={bad_signal_json} bad_evidence_json={bad_evidence_json} off_scope={off_scope_public}"
    )

    summary_path = os.getenv("GITHUB_STEP_SUMMARY", "").strip()
    if summary_path:
        lines = [
            "",
            "## GeoAcademic database QA",
            "",
            "| Metric | Value |",
            "|---|---:|",
            f"| Canonical entities | {canonical} |",
            f"| Public entities | {public} |",
            f"| Signals | {signals} |",
            f"| Record sources | {sources} |",
            f"| Source snapshots | {snapshots} |",
            f"| Public events | {events} |",
            f"| Public opportunities | {opportunities} |",
            f"| Exact title/source duplicate groups | {duplicate_title_sources} |",
            f"| Non-object canonical JSONB rows | {bad_canonical_json} |",
            f"| Non-object signal JSONB rows | {bad_signal_json} |",
            f"| Non-object provenance JSONB rows | {bad_evidence_json} |",
            f"| Off-scope public opportunities | {off_scope_public} |",
        ]
        Path(summary_path).open("a", encoding="utf-8").write("\n".join(lines) + "\n")

    for warning in warnings:
        print(f"QA_WARNING {warning}")
    if failures:
        for failure in failures:
            print(f"QA_FAILURE {failure}")
        raise SystemExit(1)

    print("QA_DATABASE_OK")


if __name__ == "__main__":
    asyncio.run(main())
