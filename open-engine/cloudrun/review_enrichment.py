from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

import httpx

BASE_URL = os.getenv("GEOACADEMIC_BASE_URL", "https://geoacademic.app").rstrip("/")
HOOK_SECRET = os.getenv("INGESTION_HOOK_SECRET", "").strip()
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b").strip()
NVIDIA_URL = os.getenv("NVIDIA_URL", "https://integrate.api.nvidia.com/v1/chat/completions").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "").strip()
OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions").strip()

SYSTEM_PROMPT = """You extract job facts for GeoAcademic, which covers photogrammetry, remote sensing, geodesy, geoinformatics, GIS, GeoAI, Earth observation, LiDAR, SAR, point clouds and spatial data science.

Absolute rules:
1. Use only the supplied page. Never infer or invent facts.
2. Use null for unstated fields.
3. Every evidence item must be a verbatim continuous snippet from PAGE TEXT.
4. Return one JSON object only. No prose and no markdown.
5. Reject career hubs, vacancy lists, marketing pages, employee stories and product pages.
6. geospatial_relevance is true only when the role itself genuinely concerns the listed geospatial fields. Generic software/AI roles are false.

Return exactly:
{"is_single_real_position":boolean,"rejection_reason":string|null,"title":string|null,"opportunity_type":"phd"|"doctoral_researcher"|"research_assistant"|"postdoc"|"other"|null,"sector":"academic"|"industry"|null,"department":string|null,"supervisor_name":string|null,"city":string|null,"country":string|null,"funding_type":string|null,"salary_text":string|null,"contract_type":string|null,"start_date":string|null,"application_deadline":string|null,"application_url":string|null,"requirements":string|null,"summary":string|null,"geospatial_relevance":boolean,"topics":string[],"confidence":number,"evidence":string[]}

Dates are YYYY-MM-DD or null. confidence is 0..1."""


def _compact_error(response: httpx.Response) -> str:
    return " ".join(response.text.split())[:900]


def _providers() -> list[tuple[str, str, str, str]]:
    providers: list[tuple[str, str, str, str]] = []
    if NVIDIA_API_KEY and NVIDIA_MODEL:
        providers.append(("nvidia", NVIDIA_URL, NVIDIA_API_KEY, NVIDIA_MODEL))
    if OPENROUTER_API_KEY and OPENROUTER_MODEL:
        providers.append(("openrouter", OPENROUTER_URL, OPENROUTER_API_KEY, OPENROUTER_MODEL))
    return providers


async def _hook(
    client: httpx.AsyncClient,
    action: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    response = await client.post(
        f"{BASE_URL}/api/public/hooks/ingest-batch",
        headers={
            "authorization": f"Bearer {HOOK_SECRET}",
            "content-type": "application/json",
        },
        json={
            "action": action,
            "trigger": "cloud-run-review",
            **(payload or {}),
        },
    )
    if response.is_error:
        raise RuntimeError(f"{action} HTTP {response.status_code}: {_compact_error(response)}")
    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError(f"unexpected {action} response")
    return body


def _parse_json_object(value: str) -> dict[str, Any]:
    text = re.sub(r"^```(?:json)?", "", value.strip(), flags=re.IGNORECASE)
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("review response has no JSON object")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("review extraction is not an object")
    return parsed


def _validate_basic(value: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(value.get("is_single_real_position"), bool):
        raise ValueError("is_single_real_position must be boolean")
    confidence = value.get("confidence")
    if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
        raise ValueError("confidence must be between 0 and 1")
    if value["is_single_real_position"] and not isinstance(value.get("title"), str):
        raise ValueError("accepted extraction has no title")
    if not isinstance(value.get("evidence"), list) or not isinstance(value.get("topics"), list):
        raise ValueError("evidence and topics must be arrays")
    return value


async def _extract(
    client: httpx.AsyncClient,
    lease: dict[str, Any],
) -> tuple[dict[str, Any], int, int, int, str, str]:
    providers = _providers()
    if not providers:
        raise RuntimeError("No semantic-review model provider is configured")

    page_text = str(lease.get("text_content") or "")[:8000]
    if len(page_text) < 120:
        raise ValueError("Page text too short for review")
    source_url = str(lease.get("url") or "")
    page_title = str(lease.get("title") or "")
    user_content = (
        f"SOURCE URL: {source_url}\n"
        f"PAGE TITLE: {page_title}\n"
        f"PAGE TEXT:\n{page_text}"
    )

    errors: list[str] = []
    for provider, url, api_key, model in providers:
        headers = {
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
            "accept": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://geoacademic.app"
            headers["X-Title"] = "GeoAcademic"

        request_body: dict[str, Any] = {
            "model": model,
            "temperature": 0.1,
            "max_tokens": 1800,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        }
        if provider == "nvidia":
            request_body["chat_template_kwargs"] = {"enable_thinking": False}

        started = time.monotonic()
        try:
            response = await client.post(
                url,
                headers=headers,
                json=request_body,
                timeout=55.0,
            )
            latency_ms = round((time.monotonic() - started) * 1000)
            if response.is_error:
                raise RuntimeError(
                    f"{provider} HTTP {response.status_code}: {_compact_error(response)}"
                )
            payload = response.json()
            content = (((payload.get("choices") or [{}])[0].get("message") or {}).get("content"))
            if not isinstance(content, str) or not content.strip():
                raise ValueError(f"{provider} returned no content")
            extraction = _validate_basic(_parse_json_object(content))
            return extraction, latency_ms, len(user_content), len(content), provider, model
        except Exception as exc:
            errors.append(f"{provider}: {str(exc)[:500]}")
            print(f"PUBLIC_REVIEW_PROVIDER_FAILED provider={provider} error={str(exc)[:500]}")

    raise RuntimeError("; ".join(errors)[:900])


async def _complete_failure(
    client: httpx.AsyncClient,
    lease: dict[str, Any],
    message: str,
    model: str,
) -> dict[str, Any]:
    return await _hook(
        client,
        "complete-review",
        {
            "completion": {
                "task_id": lease.get("task_id"),
                "source_id": lease.get("source_id"),
                "raw_record_id": lease.get("raw_record_id"),
                "lease_started_at": lease.get("lease_started_at"),
                "success": False,
                "model": model,
                "error": message[:900],
            }
        },
    )


async def _process_lease(client: httpx.AsyncClient, lease: dict[str, Any]) -> dict[str, Any]:
    provider_name = "deterministic"
    model_name = "deterministic"
    try:
        if lease.get("requires_model"):
            (
                extraction,
                latency_ms,
                input_chars,
                output_chars,
                provider_name,
                model_name,
            ) = await _extract(client, lease)
        else:
            extraction = None
            latency_ms = 0
            input_chars = 0
            output_chars = 0
        result = await _hook(
            client,
            "complete-review",
            {
                "completion": {
                    "task_id": lease.get("task_id"),
                    "source_id": lease.get("source_id"),
                    "raw_record_id": lease.get("raw_record_id"),
                    "lease_started_at": lease.get("lease_started_at"),
                    "success": True,
                    "model": model_name,
                    "extraction": extraction,
                    "latency_ms": latency_ms,
                    "input_characters": input_chars,
                    "output_characters": output_chars,
                }
            },
        )
        result["provider"] = provider_name
        result["model"] = model_name
        return result
    except Exception as exc:
        message = str(exc)
        providers = _providers()
        failure_model = providers[0][3] if providers else "unconfigured"
        try:
            return await _complete_failure(client, lease, message, failure_model)
        except Exception as completion_exc:
            raise RuntimeError(f"{message}; completion failed: {completion_exc}") from completion_exc


async def run_review_enrichment(
    *,
    max_rounds: int = 3,
    lease_limit: int = 4,
    concurrency: int = 2,
) -> dict[str, int | str | bool]:
    """Consume vacancy review leases inside the production Cloud Run job."""
    if not HOOK_SECRET:
        print("PUBLIC_REVIEW skipped=missing_ingestion_hook_secret")
        return {"skipped": True, "reason": "missing_ingestion_hook_secret", "processed": 0}

    providers = _providers()
    if not providers:
        print(
            "PUBLIC_REVIEW skipped=missing_model_provider_credentials "
            "nvidia_configured=false openrouter_configured=false"
        )
        return {
            "skipped": True,
            "reason": "missing_model_provider_credentials",
            "processed": 0,
        }

    processed = 0
    complete = 0
    retry = 0
    dead = 0
    stale = 0
    leased_total = 0
    provider_counts: dict[str, int] = {}
    timeout = httpx.Timeout(65.0, connect=20.0)
    limits = httpx.Limits(max_connections=max(4, concurrency * 2), max_keepalive_connections=4)

    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True) as client:
        for _ in range(max(1, max_rounds)):
            leased = await _hook(
                client,
                "lease-review",
                {"limit": max(1, lease_limit), "model_available": True},
            )
            leases = leased.get("leases")
            if not isinstance(leases, list) or not leases:
                break
            leased_total += len(leases)
            for offset in range(0, len(leases), max(1, concurrency)):
                batch = leases[offset : offset + max(1, concurrency)]
                results = await asyncio.gather(
                    *(_process_lease(client, lease) for lease in batch),
                    return_exceptions=True,
                )
                for result in results:
                    processed += 1
                    if isinstance(result, Exception):
                        retry += 1
                        print(f"PUBLIC_REVIEW_TASK_FAILED error={str(result)[:500]}")
                        continue
                    provider = str(result.get("provider") or "unknown")
                    provider_counts[provider] = provider_counts.get(provider, 0) + 1
                    status = str(result.get("status") or "")
                    if status == "COMPLETE":
                        complete += 1
                    elif status == "DEAD":
                        dead += 1
                    elif status == "STALE":
                        stale += 1
                    else:
                        retry += 1

    provider_summary = ",".join(
        f"{name}:{count}" for name, count in sorted(provider_counts.items())
    ) or "none"
    configured_summary = ",".join(provider for provider, *_ in providers)
    print(
        "PUBLIC_REVIEW "
        f"leased={leased_total} processed={processed} complete={complete} "
        f"retry={retry} dead={dead} stale={stale} "
        f"providers={provider_summary} configured={configured_summary}"
    )
    return {
        "processed": processed,
        "leased": leased_total,
        "complete": complete,
        "retry": retry,
        "dead": dead,
        "stale": stale,
        "providers": provider_summary,
        "configured": configured_summary,
        "capacity": max(1, max_rounds) * max(1, lease_limit),
    }
