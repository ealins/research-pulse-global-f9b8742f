import hashlib
import json
import os
import re

import httpx
from bs4 import BeautifulSoup

ALLOWED_ENTITY_TYPES = {
    "institution",
    "researcher",
    "publication",
    "project",
    "programme",
    "opportunity",
    "event",
}

OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")
NVIDIA_URL = os.getenv("NVIDIA_URL", "https://integrate.api.nvidia.com/v1/chat/completions")


def _visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ", strip=True).split())
    return text[:24000]


def _parse_json(content: str):
    content = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", content, re.DOTALL | re.IGNORECASE)
    if fenced:
        content = fenced.group(1).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])
        raise


async def _chat(client: httpx.AsyncClient, *, provider: str, url: str, api_key: str, model: str, text: str, source_url: str):
    system = (
        "You extract structured GeoAcademic records from official academic/research webpages. "
        "Return JSON only. Do not infer facts that are not supported by the supplied page text."
    )
    user = f"""Source URL: {source_url}

Extract at most 10 clearly supported records relevant to academic/research activity.
Allowed entity_type values: institution, researcher, publication, project, programme, opportunity, event.

Return exactly this JSON shape:
{{
  "items": [
    {{
      "entity_type": "publication",
      "title": "...",
      "country": null,
      "published_at": null,
      "confidence": 0.0,
      "evidence": "short source-supported phrase"
    }}
  ]
}}

Rules:
- Skip navigation, generic landing pages, unsupported guesses and duplicate items.
- confidence must be between 0 and 1.
- Use null when a field is not explicitly supported.
- Keep evidence under 240 characters.

PAGE TEXT:
{text}
"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://geoacademic.app"
        headers["X-Title"] = "GeoAcademic"
    response = await client.post(
        url,
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
            "max_tokens": 1800,
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return _parse_json(content)


def _validated_candidates(payload, source_url: str, provider: str, model: str):
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return []
    results = []
    for item in items[:10]:
        if not isinstance(item, dict):
            continue
        entity_type = str(item.get("entity_type") or "").strip().lower()
        title = " ".join(str(item.get("title") or "").split())[:500]
        if entity_type not in ALLOWED_ENTITY_TYPES or len(title) < 3:
            continue
        try:
            confidence = float(item.get("confidence", 0.65))
        except (TypeError, ValueError):
            confidence = 0.65
        confidence = max(0.60, min(0.84, confidence))
        evidence = " ".join(str(item.get("evidence") or "").split())[:240]
        country = item.get("country")
        if not isinstance(country, str) or not country.strip():
            country = None
        external_key = hashlib.sha256(
            f"ai|{entity_type}|{source_url}|{title}".encode("utf-8")
        ).hexdigest()
        results.append(
            {
                "entity_type": entity_type,
                "external_key": external_key,
                "title": title,
                "country": country,
                "confidence": confidence,
                "source_url": source_url,
                "verification_status": "auto_discovered" if confidence >= 0.78 and evidence else "needs_review",
                "data": {
                    "ai_extracted": True,
                    "ai_provider": provider,
                    "ai_model": model,
                    "published_at": item.get("published_at"),
                    "evidence": evidence,
                },
            }
        )
    return results


async def extract_with_ai(html: str, source_url: str):
    text = _visible_text(html)
    if len(text) < 200:
        return []

    providers = []
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    openrouter_model = os.getenv("OPENROUTER_MODEL", "").strip()
    if openrouter_key and openrouter_model:
        providers.append(("openrouter", OPENROUTER_URL, openrouter_key, openrouter_model))

    nvidia_key = os.getenv("NVIDIA_API_KEY", "").strip()
    nvidia_model = os.getenv("NVIDIA_MODEL", "").strip()
    if nvidia_key and nvidia_model:
        providers.append(("nvidia", NVIDIA_URL, nvidia_key, nvidia_model))

    if not providers:
        return []

    async with httpx.AsyncClient() as client:
        for provider, url, api_key, model in providers:
            try:
                payload = await _chat(
                    client,
                    provider=provider,
                    url=url,
                    api_key=api_key,
                    model=model,
                    text=text,
                    source_url=source_url,
                )
                candidates = _validated_candidates(payload, source_url, provider, model)
                if candidates:
                    return candidates
            except Exception as exc:
                print(f"AI_FALLBACK_FAILED provider={provider} error={exc}")
    return []
