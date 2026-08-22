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
    "event", "events", "events list", "event list", "calendar", "filters",
}
GENERIC_JOB_HEADINGS = {
    "jobs", "job", "job opportunities", "employment opportunities",
    "employment opportunities archive", "about egu",
}


def _clean(value: str) -> str:
    return " ".join(value.split()).strip()


def _country_from_location(location: str | None) -> str | None:
    if not location:
        return None
    value = _clean(location).strip(" ,|-")
    if not value or value.lower() in {"online", "virtual", "hybrid"}:
        return None
    if "," in value:
        tail = _clean(value.rsplit(",", 1)[-1])
        if 2 <= len(tail) <= 80 and len(tail.split()) <= 6:
            return tail
    return None


def _looks_like_event_page(soup: BeautifulSoup, source_url: str) -> bool:
    parsed = urlparse(source_url)
    if "event" in parsed.path.lower():
        return True
    title = _clean(soup.title.get_text(" ", strip=True)) if soup.title else ""
    h1 = soup.find("h1")
    h1_text = _clean(h1.get_text(" ", strip=True)) if h1 else ""
    return "event" in title.lower() or "event" in h1_text.lower()


def _looks_like_job_page(soup: BeautifulSoup, source_url: str) -> bool:
    parsed = urlparse(source_url)
    if "job" in parsed.path.lower():
        return True
    title = _clean(soup.title.get_text(" ", strip=True)) if soup.title else ""
    return "job" in title.lower() or "employment opportunit" in title.lower()


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
    return location, _country_from_location(location)


def _title_from_cell(cell) -> str | None:
    for heading in cell.find_all(["h1", "h2", "h3", "h4", "strong", "b"]):
        text = _clean(heading.get_text(" ", strip=True))
        if 4 <= len(text) <= 500 and text.lower() not in GENERIC_EVENT_HEADINGS | GENERIC_JOB_HEADINGS:
            return text
    for raw in cell.stripped_strings:
        text = _clean(raw)
        low = text.lower()
        if len(text) < 4:
            continue
        if low in {"website", "read more", "more detailed information", "new"}:
            continue
        if low.startswith("image:") or low.startswith("isprs logo"):
            continue
        if re.fullmatch(r"isprs\s+(?:i?c?wg|tc)\s+[ivx0-9/.-]+", text, re.IGNORECASE):
            continue
        return text[:500]
    return None


def _site_from_cell(cell) -> tuple[str | None, str | None]:
    parts = []
    for raw in cell.stripped_strings:
        text = _clean(raw)
        if text and text not in parts:
            parts.append(text)
    if not parts:
        return None, None
    location = ", ".join(parts)[:240]
    country = parts[-1] if 2 <= len(parts[-1]) <= 80 and len(parts[-1].split()) <= 6 else None
    return location, country


def _header_indexes(table) -> tuple[dict[str, int], list]:
    rows = table.find_all("tr")
    for row in rows[:5]:
        cells = row.find_all(["th", "td"], recursive=False)
        headers = [_clean(cell.get_text(" ", strip=True)).lower() for cell in cells]
        indexes = {value: idx for idx, value in enumerate(headers) if value}
        if indexes:
            return indexes, rows
    return {}, rows


def extract_event_list_candidates(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    if not _looks_like_event_page(soup, source_url):
        return []
    root = soup.find("main") or soup.body or soup
    results: list[dict] = []
    seen: set[str] = set()
    for heading in root.find_all(["h1", "h2", "h3", "h4"]):
        title = _clean(heading.get_text(" ", strip=True))
        if len(title) < 4 or title.lower() in GENERIC_EVENT_HEADINGS:
            continue
        container, container_text = _small_dated_container(heading)
        if container is None:
            continue
        remainder = container_text
        if remainder.startswith(title):
            remainder = remainder[len(title):].strip()
        else:
            remainder = remainder.replace(title, "", 1).strip()
        date_match = DATE_RE.search(remainder)
        if not date_match:
            continue
        date_text = _clean(date_match.group(0))
        location, country = _location_and_country(remainder, date_match)
        key = f"{title.lower()}|{date_text.lower()}"
        if key in seen:
            continue
        seen.add(key)
        external_key = hashlib.sha256(f"event|{source_url}|{title}|{date_text}".encode("utf-8")).hexdigest()
        evidence = " | ".join(part for part in (title, location, date_text) if part)[:240]
        results.append({
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
                "evidence": evidence,
            },
        })
        if len(results) >= 40:
            break
    return results


def extract_calendar_table_candidates(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen: set[str] = set()
    for table in soup.find_all("table"):
        indexes, rows = _header_indexes(table)
        if not {"date", "event", "site"}.issubset(indexes):
            continue
        date_idx, event_idx, site_idx = indexes["date"], indexes["event"], indexes["site"]
        max_idx = max(date_idx, event_idx, site_idx)
        for row in rows[1:]:
            cells = row.find_all(["th", "td"], recursive=False)
            if len(cells) <= max_idx:
                continue
            date_text = _clean(cells[date_idx].get_text(" ", strip=True))
            if not DATE_RE.search(date_text):
                continue
            title = _title_from_cell(cells[event_idx])
            if not title:
                continue
            location, country = _site_from_cell(cells[site_idx])
            key = f"{title.lower()}|{date_text.lower()}"
            if key in seen:
                continue
            seen.add(key)
            external_key = hashlib.sha256(f"event|{source_url}|{title}|{date_text}".encode("utf-8")).hexdigest()
            evidence = " | ".join(part for part in (title, location, date_text) if part)[:240]
            results.append({
                "entity_type": "event",
                "external_key": external_key,
                "title": title,
                "country": country,
                "confidence": 0.88,
                "source_url": source_url,
                "verification_status": "auto_discovered",
                "data": {
                    "deterministic_extracted": True,
                    "extractor": "calendar_table_v1",
                    "location": location,
                    "date_text": date_text,
                    "evidence": evidence,
                },
            })
            if len(results) >= 40:
                return results
    return results


def extract_job_table_candidates(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    if not _looks_like_job_page(soup, source_url):
        return []
    results: list[dict] = []
    seen: set[str] = set()
    for table in soup.find_all("table"):
        indexes, rows = _header_indexes(table)
        if not {"date", "contact", "job"}.issubset(indexes):
            continue
        date_idx, contact_idx, job_idx = indexes["date"], indexes["contact"], indexes["job"]
        max_idx = max(date_idx, contact_idx, job_idx)
        for row in rows[1:]:
            cells = row.find_all(["th", "td"], recursive=False)
            if len(cells) <= max_idx:
                continue
            title = _title_from_cell(cells[job_idx])
            if not title:
                continue
            date_text = _clean(cells[date_idx].get_text(" ", strip=True))
            contact = _clean(cells[contact_idx].get_text(" ", strip=True))[:240] or None
            job_text = _clean(cells[job_idx].get_text(" ", strip=True))
            deadline_match = re.search(r"\bDeadline:\s*([^|]{3,80})", job_text, re.IGNORECASE)
            deadline = _clean(deadline_match.group(1))[:80] if deadline_match else None
            location_match = re.search(r"\bLocation:\s*([^.;]{2,160})", job_text, re.IGNORECASE)
            location = _clean(location_match.group(1))[:160] if location_match else None
            country = _country_from_location(location)
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            external_key = hashlib.sha256(f"opportunity|{source_url}|{title}".encode("utf-8")).hexdigest()
            evidence = " | ".join(part for part in (title, location, deadline or date_text, contact) if part)[:240]
            results.append({
                "entity_type": "opportunity",
                "external_key": external_key,
                "title": title,
                "country": country,
                "confidence": 0.86,
                "source_url": source_url,
                "verification_status": "auto_discovered",
                "data": {
                    "deterministic_extracted": True,
                    "extractor": "job_table_v1",
                    "posted_date_text": date_text or None,
                    "deadline_text": deadline,
                    "location": location,
                    "contact": contact,
                    "evidence": evidence,
                },
            })
            if len(results) >= 40:
                return results
    return results


def extract_heading_job_candidates(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    if not _looks_like_job_page(soup, source_url):
        return []
    root = soup.find("main") or soup.body or soup
    results: list[dict] = []
    seen: set[str] = set()
    for heading in root.find_all(["h2", "h3"]):
        title = _clean(heading.get_text(" ", strip=True))
        if len(title) < 5 or title.lower() in GENERIC_JOB_HEADINGS:
            continue
        link = heading.find("a", href=True)
        if link is None:
            continue
        list_items: list[str] = []
        description = None
        for sibling in heading.next_siblings:
            name = getattr(sibling, "name", None)
            if name in {"h1", "h2", "h3", "hr"}:
                break
            if name in {"ul", "ol"} and not list_items:
                list_items = [_clean(li.get_text(" ", strip=True)) for li in sibling.find_all("li", recursive=False)]
            elif name == "p" and description is None:
                text = _clean(sibling.get_text(" ", strip=True))
                if len(text) >= 20:
                    description = text[:600]
        if len(list_items) < 2:
            continue
        institution = list_items[0]
        location = list_items[1]
        posted = list_items[2] if len(list_items) >= 3 else None
        country = _country_from_location(location)
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        external_key = hashlib.sha256(f"opportunity|{source_url}|{title}".encode("utf-8")).hexdigest()
        evidence = " | ".join(part for part in (title, institution, location, posted) if part)[:240]
        results.append({
            "entity_type": "opportunity",
            "external_key": external_key,
            "title": title[:500],
            "country": country,
            "confidence": 0.88,
            "source_url": source_url,
            "verification_status": "auto_discovered",
            "data": {
                "deterministic_extracted": True,
                "extractor": "heading_job_list_v1",
                "institution": institution,
                "location": location,
                "posted_date_text": posted,
                "detail_url": link.get("href"),
                "description": description,
                "evidence": evidence,
            },
        })
        if len(results) >= 40:
            break
    return results


def extract_deterministic_candidates(html: str, source_url: str) -> list[dict]:
    for extractor in (
        extract_calendar_table_candidates,
        extract_job_table_candidates,
        extract_heading_job_candidates,
        extract_event_list_candidates,
    ):
        candidates = extractor(html, source_url)
        if candidates:
            return candidates
    return []
