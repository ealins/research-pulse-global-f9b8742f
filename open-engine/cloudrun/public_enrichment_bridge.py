from __future__ import annotations

import os

import httpx

BASE_URL = os.getenv("GEOACADEMIC_BASE_URL", "https://geoacademic.app").rstrip("/")
HOOK_SECRET = os.getenv("INGESTION_HOOK_SECRET", "").strip()


async def _call(client: httpx.AsyncClient, action: str, limit: int) -> dict:
    response = await client.post(
        f"{BASE_URL}/api/public/hooks/ingest-batch",
        headers={
            "authorization": f"Bearer {HOOK_SECRET}",
            "content-type": "application/json",
        },
        json={
            "action": action,
            "limit": limit,
            "trigger": "cloud-run-enrichment-bridge",
        },
    )
    if response.is_error:
        body = " ".join(response.text.split())[:1000]
        raise RuntimeError(f"{action} HTTP {response.status_code}: {body}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"unexpected {action} response")
    return payload


def _round_complete(payload: dict) -> bool:
    reason = str(payload.get("reason", "")).lower()
    return (
        payload.get("skipped") is True
        or reason == "queue empty"
        or payload.get("processed") == 0
    )


async def _run_rounds(
    client: httpx.AsyncClient,
    action: str,
    limit: int,
    max_rounds: int,
) -> dict:
    results: list[dict] = []
    processed = 0
    for _ in range(max_rounds):
        payload = await _call(client, action, limit)
        results.append(payload)
        value = payload.get("processed")
        if isinstance(value, int):
            processed += value
        if _round_complete(payload):
            break
    return {"processed": processed, "rounds": results, "round_count": len(results)}


async def run_public_enrichment(
    *,
    backfill_limit: int = 8,
    provider_limit: int = 4,
    normalize_limit: int = 8,
) -> dict[str, object]:
    """Drain bounded website-facing enrichment through the existing hook.

    Cloud Run owns the production cadence. Backfill first requeues only safe
    recovery candidates. Provider work is deterministic. Vacancy semantic review
    then runs inside Cloud Run with the configured NVIDIA key. The generic
    canonical drain is allowed only when the review worker did not saturate its
    bounded capacity, which prevents Cloudflare from consuming unresolved vacancy
    tasks before the external reviewer can validate them.
    """

    if not HOOK_SECRET:
        print("PUBLIC_ENRICHMENT skipped=missing_ingestion_hook_secret")
        return {"skipped": True, "reason": "missing_ingestion_hook_secret"}

    timeout = httpx.Timeout(120.0, connect=20.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        try:
            backfill = await _call(client, "backfill-raw", backfill_limit)
        except Exception as exc:
            print(f"PUBLIC_ENRICHMENT_BACKFILL_FAILED error={exc}")
            backfill = {"error": str(exc)[:300]}

        try:
            providers = await _run_rounds(
                client, "drain-providers", provider_limit, max_rounds=3
            )
        except Exception as exc:
            print(f"PUBLIC_ENRICHMENT_PROVIDER_FAILED error={exc}")
            providers = {"error": str(exc)[:300]}

    try:
        from review_enrichment import run_review_enrichment

        review = await run_review_enrichment(
            max_rounds=3,
            lease_limit=4,
            concurrency=2,
        )
    except Exception as exc:
        print(f"PUBLIC_REVIEW_FAILED error={exc}")
        review = {"error": str(exc)[:300], "processed": 0, "skipped": True}

    review_processed = int(review.get("processed", 0) or 0)
    review_capacity = int(review.get("capacity", 12) or 12)
    review_saturated = review_processed >= review_capacity
    review_available = review.get("skipped") is not True and "error" not in review

    # If the reviewer filled its entire capacity, vacancy work may still remain.
    # Do not let the generic Cloudflare normalizer claim those tasks and turn a
    # routing problem into raw-record failures. Once the reviewer catches up,
    # the generic drain resumes for researcher/event/programme/course records.
    if review_available and not review_saturated:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            try:
                canonical = await _run_rounds(
                    client, "drain", normalize_limit, max_rounds=3
                )
            except Exception as exc:
                print(f"PUBLIC_ENRICHMENT_NORMALIZE_FAILED error={exc}")
                canonical = {"error": str(exc)[:300]}
    else:
        canonical = {
            "skipped": True,
            "reason": (
                "vacancy review backlog still active"
                if review_saturated
                else "vacancy review unavailable"
            ),
            "processed": 0,
        }

    print(
        "PUBLIC_ENRICHMENT "
        f"backfill={backfill.get('queued', backfill.get('action', 'unknown'))} "
        f"providers={providers.get('processed', providers.get('action', 'unknown'))} "
        f"review={review_processed} "
        f"normalize={canonical.get('processed', canonical.get('action', 'unknown'))}"
    )
    return {
        "backfill": backfill,
        "providers": providers,
        "review": review,
        "canonical": canonical,
    }
