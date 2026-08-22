import asyncio
import os
import re

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")


def validate_identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise SystemExit(f"Unsafe PostgreSQL schema name: {value!r}")
    return value


async def main() -> None:
    schema = validate_identifier(DB_SCHEMA)
    conn = await asyncpg.connect(DATABASE_URL, command_timeout=60)
    try:
        await conn.execute(f'SET search_path TO "{schema}", extensions, public')
        public_off_scope = await conn.fetchval(
            """
            SELECT count(*)
            FROM latest_public_entities
            WHERE entity_type='opportunity'
              AND coalesce(source_url, '') ~* '^https?://(www\\.)?egu\\.eu/g/jobs/?'
              AND NOT geoacademic_scope_text_matches(title, data)
            """
        )
        held_for_review = await conn.fetchval(
            """
            SELECT count(*)
            FROM canonical_entities
            WHERE entity_type='opportunity'
              AND coalesce(source_url, '') ~* '^https?://(www\\.)?egu\\.eu/g/jobs/?'
              AND verification_status='needs_review'
            """
        )
        print(
            f"QA_SCOPE broad_off_scope_public={public_off_scope} "
            f"broad_held_for_review={held_for_review}"
        )
        if public_off_scope:
            raise SystemExit(
                f"Scope QA failed: {public_off_scope} broad-source opportunities are public without a GeoAcademic scope match"
            )
        print("QA_SCOPE_OK")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
