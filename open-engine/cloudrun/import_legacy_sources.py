import asyncio
import os

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")
SEARCH_PATH = f"{DB_SCHEMA},extensions,public"


async def main() -> None:
    conn = await asyncpg.connect(
        DATABASE_URL,
        command_timeout=60,
        server_settings={"search_path": SEARCH_PATH},
    )
    try:
        exists = await conn.fetchval("SELECT to_regclass('public.sources') IS NOT NULL")
        if not exists:
            print("LEGACY_IMPORT skipped=no_public_sources_table")
            return

        result = await conn.execute(
            """
            INSERT INTO source_registry(
                name,
                url,
                source_type,
                entity_hint,
                trust_level,
                refresh_interval_minutes,
                active,
                last_checked_at,
                next_check_at,
                updated_at
            )
            SELECT
                coalesce(nullif(name, ''), url),
                url,
                coalesce(source_type::text, 'web'),
                category,
                'standard',
                greatest(60, coalesce(refresh_frequency_hours, 24) * 60),
                active,
                last_success_at,
                now(),
                now()
            FROM public.sources
            WHERE url IS NOT NULL
              AND btrim(url) <> ''
            ON CONFLICT(url) DO UPDATE SET
                name=excluded.name,
                source_type=excluded.source_type,
                entity_hint=coalesce(excluded.entity_hint, source_registry.entity_hint),
                refresh_interval_minutes=excluded.refresh_interval_minutes,
                active=excluded.active,
                updated_at=now()
            """
        )
        count = await conn.fetchval("SELECT count(*) FROM source_registry")
        print(f"LEGACY_IMPORT result={result} source_registry_total={count}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
