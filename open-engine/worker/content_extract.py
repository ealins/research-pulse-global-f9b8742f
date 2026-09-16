from __future__ import annotations

from bs4 import BeautifulSoup

try:
    from trafilatura import extract as trafilatura_extract
except Exception:  # pragma: no cover - deployment fallback
    trafilatura_extract = None


def visible_text(html: str, *, max_chars: int = 24_000) -> str:
    """Return clean page text for classification/LLM extraction.

    Trafilatura removes navigation, boilerplate and repeated chrome far more
    reliably than raw ``BeautifulSoup.get_text``. The BeautifulSoup path stays
    as a deterministic fallback so ingestion remains available if Trafilatura
    cannot parse a particular document.
    """

    if trafilatura_extract is not None:
        try:
            text = trafilatura_extract(
                html,
                output_format="txt",
                include_comments=False,
                include_tables=True,
            )
            if isinstance(text, str):
                cleaned = " ".join(text.split())
                if cleaned:
                    return cleaned[:max_chars]
        except Exception:
            pass

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
        tag.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())[:max_chars]
