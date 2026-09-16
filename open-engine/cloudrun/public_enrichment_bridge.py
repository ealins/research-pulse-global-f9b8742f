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
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"unexpected {action} response")
    return payload


async def run_public_enrichment(
    *,
    provider_limit: int = 12,
    normalize_limit: int = 16,
) -> dict[str, object]:
    """Drain bounded website-facing enrichment work through the existing hook.

    The TypeScript application already contains the canonical ROR/OpenAIRE/
    Crossref writers and non-vacancy normalizers. Reusing that path prevents a
    second provider implementation while Cloud Run becomes the single cadence
    owner. The bridge is optional until the shared hook secret is configured.
    """

    if not HOOK_SECRET:
        print("PUBLIC_ENRICHMENT skipped=missing_ingestion_hook_secret")
        return {"skipped": True, "reason": "missing_ingestion_hook_secret"}

    timeout = httpx.Timeout(120.0, connect=20.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        try:
            providers = await _call(client, "drain-providers", provider_limit)
        except Exception as exc:
            print(f"PUBLIC_ENRICHMENT_PROVIDER_FAILED error={exc}")
            providers = {"error": str(exc)[:300]}

        try:
            canonical = await _call(client, "drain", normalize_limit)
        except Exception as exc:
            print(f"PUBLIC_ENRICHMENT_NORMALIZE_FAILED error={exc}")
            canonical = {"error": str(exc)[:300]}

    print(
        "PUBLIC_ENRICHMENT "
        f"providers={providers.get('processed', providers.get('action', 'unknown'))} "
        f"normalize={canonical.get('processed', canonical.get('action', 'unknown'))}"
    )
    return {"providers": providers, "canonical": canonical}
