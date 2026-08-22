import re
from datetime import date

MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _month(value: str) -> int | None:
    return MONTHS.get(value.strip().lower()[:3])


def _iso(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def normalize_date_range(value: object) -> tuple[str | None, str | None]:
    if not isinstance(value, str):
        return None, None
    text = " ".join(value.replace("–", "-").replace("—", "-").split()).strip()
    if not text:
        return None, None

    iso = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text)
    if iso:
        single = _iso(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        return single, single

    cross_month = re.search(
        r"\b(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b",
        text,
        re.IGNORECASE,
    )
    if cross_month:
        d1, m1_raw, d2, m2_raw, year_raw = cross_month.groups()
        m1, m2, year = _month(m1_raw), _month(m2_raw), int(year_raw)
        if m1 and m2:
            start_year = year - 1 if m1 > m2 else year
            return _iso(start_year, m1, int(d1)), _iso(year, m2, int(d2))

    same_month = re.search(
        r"\b(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b",
        text,
        re.IGNORECASE,
    )
    if same_month:
        d1, d2, month_raw, year_raw = same_month.groups()
        month = _month(month_raw)
        if month:
            year = int(year_raw)
            return _iso(year, month, int(d1)), _iso(year, month, int(d2))

    single = re.search(
        r"\b(\d{1,2})\s*[- ]\s*([A-Za-z]+)\s*[- ]\s*(20\d{2})\b",
        text,
        re.IGNORECASE,
    )
    if single:
        day_raw, month_raw, year_raw = single.groups()
        month = _month(month_raw)
        if month:
            normalized = _iso(int(year_raw), month, int(day_raw))
            return normalized, normalized

    month_first = re.search(
        r"\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b",
        text,
        re.IGNORECASE,
    )
    if month_first:
        month_raw, day_raw, year_raw = month_first.groups()
        month = _month(month_raw)
        if month:
            normalized = _iso(int(year_raw), month, int(day_raw))
            return normalized, normalized

    return None, None


def normalize_single_date(value: object) -> str | None:
    start, _ = normalize_date_range(value)
    return start


def normalize_candidate_dates(candidate: dict) -> dict:
    data = candidate.get("data")
    if not isinstance(data, dict):
        return candidate

    entity_type = str(candidate.get("entity_type") or "").lower()
    if entity_type == "event":
        source_start = data.get("startDate") or data.get("date_text")
        source_end = data.get("endDate")
        start_date, inferred_end = normalize_date_range(source_start)
        end_date = normalize_single_date(source_end) if source_end else inferred_end
        if start_date:
            data["start_date"] = start_date
        if end_date:
            data["end_date"] = end_date

    elif entity_type == "opportunity":
        posted = data.get("datePosted") or data.get("posted_date_text") or data.get("published_at")
        deadline = data.get("validThrough") or data.get("deadline_text")
        posted_date = normalize_single_date(posted)
        deadline_date = normalize_single_date(deadline)
        if posted_date:
            data["posted_date"] = posted_date
        if deadline_date:
            data["deadline_date"] = deadline_date

    candidate["data"] = data
    return candidate
