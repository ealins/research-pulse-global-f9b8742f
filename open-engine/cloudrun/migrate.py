import asyncio
import os
import pathlib
import re

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")
ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "db" / "init"


def validate_identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise SystemExit(f"Unsafe PostgreSQL schema name: {value!r}")
    return value


async def main() -> None:
    schema = validate_identifier(DB_SCHEMA)
    conn = await asyncpg.connect(DATABASE_URL, command_timeout=120)
    try:
        # Supabase already uses public for the production application. Keep the
        # open engine isolated so similarly named provenance tables never collide.
        await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')

        # Supabase conventionally exposes supported extensions through the
        # extensions schema. These statements are idempotent on existing projects.
        await conn.execute("CREATE SCHEMA IF NOT EXISTS extensions")
        for extension in ("pgcrypto", "pg_trgm", "postgis"):
            await conn.execute(f"CREATE EXTENSION IF NOT EXISTS {extension} WITH SCHEMA extensions")

        await conn.execute(f'SET search_path TO "{schema}", extensions, public')
        for path in sorted(MIGRATIONS.glob("*.sql")):
            sql = path.read_text(encoding="utf-8")
            await conn.execute(sql)
            print(f"MIGRATION_APPLIED {path.name}")

        schema_ok = await conn.fetchval(
            "SELECT to_regclass($1) IS NOT NULL",
            f"{schema}.canonical_entities",
        )
        if not schema_ok:
            raise RuntimeError("canonical_entities was not created in the isolated schema")
        print(f"MIGRATIONS_OK schema={schema}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
