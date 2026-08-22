import hashlib
import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

MONTHS = (
    "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    "Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)
DATE_RE = re.compile(
    rf"\b(?:\d{{1,2}}(?:\s*[-–]\s*\d{{1,2}})?\s+)?(?:{MONTHS})"
    rf"(?:\s*[-–]\s*\d{{1,2}}\s+(?:{MONTHS}))?\s+20\d{{2}}\b",
    re.IGNORECASE,
)
STATUS_RE = re.compile(r"\b(?:upcoming|past|ongoing|cancelled|canceled)\b", re.IGNORECASE)
GENERIC_EVENT_HEADINGS = {
    "event",
    "events",
    "events list",
    "event list",
    "calendar",
    "filters",
}


def _clean(value: str) -> str:
    return " ".join(value.split()).strip()


def _looks_like_event_page(soup: BeautifulSoup, source_url: str) -> bool:
    parsed = urlparse(source_url)
    if "event" in parsed.path.lower():
        return True
    title = _clean(soup.title.get_text(" ", strip=True)) if soup.title else ""
    h1 = soup.find("h1")
    h1_text = _clean(h1.get_text(" ", strip=True)) if h1 else ""
    return "event" in title.lower() or "event" in h1_text.lower()


def _small_dated_container(heading):
    for parent in heading.parents:
        if getattr(parent, "name", None) in {"main", "body", "html"}:
            break
        text = _clean(parent.get_text(" ", strip=True))
        if len(text) > 1400:
            break
        if DATE_RE.search(text):
            return parent, text
    return None, ""


def _location_and_country(remainder: str, date_match) -> tuple[str | None, str | None]:
    before_date = _clean(remainder[: date_match.start()]).strip("-|• ")
    if not before_date:
        return None, None
    before_date = STATUS_RE.sub("", before_date).strip("-|• ")
    if not before_date or before_date.lower() in {"online", "virtual", "hybrid"}:
        return before_date or None, None

    location = before_date[:240]
    country = None
    if "," in location:
        tail = _clean(location.rsplit(",", 1)[-1])
        if 2 <= len(tail) <= 80 and len(tail.split()) <= 5:
            country = tail
    elif len(location.split()) <= 4 and len(location) <= 80:
        country = location
    return location, country


def extract_event_list_candidates(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    if not _looks_like_event_page(soup, source_url):
        return []

    root = soup.find("main") or soup.body or soup
    results: list[dict] = []
    seen: set[str] = set()

    # Some official event-list sites (including GEO) use h1 for each event card,
    # so scan h1 as well as lower-level headings and filter generic page headings.
    for heading in root.find_all(["h1", "h2", "h3", "h4"]):
        title = _clean(heading.get_text(" ", strip=True))
        if len(title) < 4 or title.lower() in GENERIC_EVENT_HEADINGS:
            continue

        container, container_text = _small_dated_container(heading)
        if container is None:
            continue

        date_match = DATE_RE.search(container_text)
        if not date_match:
            continue

        remainder = container_text
        if remainder.startswith(title):
            remainder = remainder[len(title) :].strip()
        else:
            remainder = remainder.replace(title, "", 1).strip()

        local_date_match = DATE_RE.search(remainder)
        if not local_date_match:
            continue

        date_text = _clean(local_date_match.group(0))
        location, country = _location_and_country(remainder, local_date_match)
        dedupe_key = f"{title.lower()}|{date_text.lower()}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        external_key = hashlib.sha256(
            f"event|{source_url}|{title}|{date_text}".encode("utf-8")
        ).hexdigest()
        evidence_parts = [part for part in (title, location, date_text) if part]
        results.append(
            {
                "entity_type": "event",
                "external_key": external_key,
                "title": title[:500],
                "country": country,
                "confidence": 0.84,
                "source_url": source_url,
                "verification_status": "auto_discovered",
                "data": {
                    "deterministic_extracted": True,
                    "extractor": "dated_event_list_v2",
                    "location": location,
                    "date_text": date_text,
                    "evidence": " | ".join(evidence_parts)[:240],
                },
            }
        )
        if len(results) >= 40:
            break

    return results
