import argparse
import asyncio
import json
import os
import pathlib
import sys

import asyncpg

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "worker"))

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.getenv("DB_SCHEMA", "geoacademic_engine")
DB_SEARCH_PATH = f"{DB_SCHEMA},extensions,public"


async def init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "json",
        schema="pg_catalog",
        encoder=json.dumps,
        decoder=json.loads,
        format="text",
    )
    await conn.set_type_codec(
        "jsonb",
        schema="pg_catalog",
        encoder=json.dumps,
        decoder=json.loads,
        format="text",
    )


def pool_kwargs(max_size: int) -> dict:
    return {
        "dsn": DATABASE_URL,
        "min_size": 1,
        "max_size": max_size,
        "command_timeout": 60,
        "server_settings": {"search_path": DB_SEARCH_PATH},
        "init": init_connection,
    }


async def run_schedule() -> None:
    import scheduler

    pool = await asyncpg.create_pool(**pool_kwargs(3))
    try:
        recovered = await scheduler.recover_stale(pool)
        queued = await scheduler.enqueue_due(pool)
        print(f"BATCH_SCHEDULE queued={queued} recovered={recovered}")
    finally:
        await pool.close()


async def run_fetch(max_tasks: int) -> None:
    import httpx
    import worker as fetcher

    await fetcher.ensure_bucket()
    concurrency = max(1, min(fetcher.WORKER_CONCURRENCY, max_tasks))
    pool = await asyncpg.create_pool(**pool_kwargs(concurrency + 2))
    limits = httpx.Limits(
        max_connections=concurrency * 2,
        max_keepalive_connections=concurrency,
    )
    timeout = httpx.Timeout(fetcher.FETCH_TIMEOUT)
    processed = 0
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            limits=limits,
            timeout=timeout,
        ) as client:
            while processed < max_tasks:
                claims = []
                for _ in range(min(concurrency, max_tasks - processed)):
                    task = await fetcher.claim_task(pool)
                    if task:
                        claims.append(task)
                if not claims:
                    break
                await asyncio.gather(
                    *(fetcher.process_fetch(pool, client, task) for task in claims)
                )
                processed += len(claims)
    finally:
        await pool.close()
    print(f"BATCH_FETCH processed={processed}")


async def run_process(max_tasks: int) -> None:
    import processor

    pool = await asyncpg.create_pool(**pool_kwargs(4))
    processed = 0
    try:
        while processed < max_tasks:
            task = await processor.claim(pool)
            if not task:
                break
            await processor.materialize(pool, task)
            processed += 1
    finally:
        await pool.close()
    print(f"BATCH_PROCESS processed={processed}")


async def run_verify() -> None:
    import verifier

    pool = await asyncpg.create_pool(**pool_kwargs(3))
    try:
        promoted = await verifier.promote(pool)
        print(f"BATCH_VERIFY promoted={promoted}")
    finally:
        await pool.close()


async def run_public() -> None:
    from public_enrichment_bridge import run_public_enrichment

    await run_public_enrichment()


async def run_publications(max_institutions: int) -> None:
    from publication_enrichment import run_publication_enrichment

    pool = await asyncpg.create_pool(**pool_kwargs(4))
    try:
        await run_publication_enrichment(
            pool,
            max_institutions=max(1, max_institutions),
        )
    finally:
        await pool.close()


async def run_ats(max_sources: int) -> None:
    from ats_enrichment import run_ats_enrichment

    pool = await asyncpg.create_pool(**pool_kwargs(3))
    try:
        await run_ats_enrichment(pool, max_sources=max_sources)
    finally:
        await pool.close()


async def run_all(
    max_fetch: int,
    max_process: int,
    max_ats_sources: int,
    max_publication_institutions: int,
) -> None:
    await run_schedule()
    await run_fetch(max_fetch)
    await run_process(max_process)
    await run_verify()
    # Cloud Run owns the production cadence. This bridge reuses the app's
    # authenticated canonical writers and now performs vacancy review here,
    # where the NVIDIA secret is actually configured.
    await run_public()
    # OpenAIRE publication citation indicators are often absent. A bounded
    # exact-ROR recovery pass prevents unknown citation metadata from yielding
    # a permanently empty canonical publication table.
    await run_publications(max_publication_institutions)
    # ATS adapters are deliberately bounded and complementary. Unsupported
    # university career sites remain on the generic HTML extraction path.
    await run_ats(max_ats_sources)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run bounded GeoAcademic ingestion work")
    parser.add_argument(
        "mode",
        choices=(
            "schedule",
            "fetch",
            "process",
            "verify",
            "public",
            "publications",
            "ats",
            "all",
        ),
    )
    parser.add_argument("--max-fetch", type=int, default=40)
    parser.add_argument("--max-process", type=int, default=40)
    parser.add_argument("--max-ats-sources", type=int, default=5)
    parser.add_argument("--max-publication-institutions", type=int, default=6)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if args.mode == "schedule":
        await run_schedule()
    elif args.mode == "fetch":
        await run_fetch(max(1, args.max_fetch))
    elif args.mode == "process":
        await run_process(max(1, args.max_process))
    elif args.mode == "verify":
        await run_verify()
    elif args.mode == "public":
        await run_public()
    elif args.mode == "publications":
        await run_publications(max(1, args.max_publication_institutions))
    elif args.mode == "ats":
        await run_ats(max(1, args.max_ats_sources))
    else:
        await run_all(
            max(1, args.max_fetch),
            max(1, args.max_process),
            max(1, args.max_ats_sources),
            max(1, args.max_publication_institutions),
        )


if __name__ == "__main__":
    asyncio.run(main())
