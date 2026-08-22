import asyncio
import os
import re
from pathlib import Path

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


async def main() -> None:
    failures: list[str] = []
    conn = await asyncpg.connect(
        DATABASE_URL,
        server_settings={"search_path": DB_SEARCH_PATH},
    )
    try:
        missing = int(
            await conn.fetchval(
                """
                SELECT count(*)
                FROM latest_public_entities
                WHERE slug IS NULL OR btrim(slug) = ''
                """
            )
        )
        duplicate_groups = int(
            await conn.fetchval(
                """
                SELECT count(*)
                FROM (
                    SELECT entity_type, slug
                    FROM latest_public_entities
                    WHERE slug IS NOT NULL AND btrim(slug) <> ''
                    GROUP BY entity_type, slug
                    HAVING count(*) > 1
                ) d
                """
            )
        )
        samples = await conn.fetch(
            """
            SELECT DISTINCT ON (entity_type) entity_type, slug, id
            FROM latest_public_entities
            WHERE entity_type IN ('event', 'opportunity')
              AND slug IS NOT NULL
              AND btrim(slug) <> ''
            ORDER BY entity_type, last_seen_at DESC, id
            """
        )
    finally:
        await conn.close()

    if missing:
        failures.append(f"{missing} public entities are missing slugs")
    if duplicate_groups:
        failures.append(f"{duplicate_groups} duplicate entity-type/slug groups exist")

    detail_checks: dict[str, str] = {"event": "missing", "opportunity": "missing"}
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(
        base_url=API_URL,
        follow_redirects=True,
        timeout=timeout,
        headers={"User-Agent": "GeoAcademic-QA/1.0"},
    ) as client:
        for sample in samples:
            entity_type = str(sample["entity_type"])
            slug = str(sample["slug"])
            try:
                response = await client.get(f"/v1/entities/{entity_type}/{slug}")
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict) or str(payload.get("id")) != str(sample["id"]):
                    raise RuntimeError("detail response did not match sampled entity")
                detail_checks[entity_type] = "ok"
            except Exception as exc:
                detail_checks[entity_type] = "failed"
                failures.append(
                    f"detail route failed for {entity_type}/{slug}: {type(exc).__name__}: {exc}"
                )

    for entity_type in ("event", "opportunity"):
        if detail_checks[entity_type] == "missing":
            failures.append(f"no slugged {entity_type} record was available for detail-route QA")

    print(
        "QA_SLUGS "
        f"missing={missing} duplicate_groups={duplicate_groups} "
        f"event_detail={detail_checks['event']} opportunity_detail={detail_checks['opportunity']}"
    )

    summary_path = os.getenv("GITHUB_STEP_SUMMARY", "").strip()
    if summary_path:
        lines = [
            "",
            "## URL/detail-route checks",
            "",
            "| Metric | Value |",
            "|---|---:|",
            f"| Public entities missing slugs | {missing} |",
            f"| Duplicate entity-type/slug groups | {duplicate_groups} |",
            f"| Event detail route | {detail_checks['event']} |",
            f"| Opportunity detail route | {detail_checks['opportunity']} |",
        ]
        Path(summary_path).open("a", encoding="utf-8").write("\n".join(lines) + "\n")

    if failures:
        for failure in failures:
            print(f"QA_FAILURE {failure}")
        raise SystemExit(1)

    print("QA_SLUGS_OK")


if __name__ == "__main__":
    asyncio.run(main())
