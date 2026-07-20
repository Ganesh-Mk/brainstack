"""Text extraction — PDF bytes via PyMuPDF, web pages via trafilatura.

Page numbers are preserved from the very first step: they become the
clickable citations in Phase 5 and cannot be reconstructed later.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import fitz  # PyMuPDF
import httpx
import trafilatura

from app.config import get_settings


class ExtractionError(RuntimeError):
    """User-facing extraction failure — its message lands in Document.error."""


def extract_pdf(data: bytes) -> tuple[int, list[tuple[int, str]]]:
    """PDF bytes -> (page_count, [(page_number, text)]).

    Pages with no extractable text are skipped; a document with NO text at
    all (e.g. a pure image scan) fails loudly rather than indexing nothing.
    """
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:  # corrupt / encrypted / not actually a PDF
        raise ExtractionError(f"Could not open PDF: {e}") from e

    try:
        if doc.needs_pass:
            raise ExtractionError("This PDF is password-protected.")
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            if text:
                pages.append((i + 1, text))
        page_count = doc.page_count
    finally:
        doc.close()

    if not pages:
        raise ExtractionError(
            "No extractable text found — this PDF appears to be scanned images. "
            "OCR is not supported yet."
        )
    return page_count, pages


# ── URL ingestion ────────────────────────────────────────────────────────────


def _assert_public_http_url(url: str) -> None:
    """SSRF guard: the backend fetches user-supplied URLs, so refuse anything
    that isn't plain public http(s) — no internal services, no cloud metadata
    endpoints, no localhost."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ExtractionError("Only http(s) URLs are supported.")
    host = parsed.hostname
    if not host:
        raise ExtractionError("URL has no hostname.")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise ExtractionError(f"Could not resolve host '{host}'.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ExtractionError("URL resolves to a non-public address.")


def extract_url(url: str) -> tuple[str, str]:
    """URL -> (title, main article text). Navigation, ads and boilerplate are
    stripped by trafilatura."""
    settings = get_settings()
    _assert_public_http_url(url)

    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=settings.URL_FETCH_TIMEOUT,
            headers={"User-Agent": "BrainStackBot/0.1 (+https://brainstack.space)"},
        ) as client:
            with client.stream("GET", url) as resp:
                if resp.status_code >= 400:
                    raise ExtractionError(f"URL returned HTTP {resp.status_code}.")
                content_type = resp.headers.get("content-type", "")
                if "html" not in content_type and "text" not in content_type:
                    raise ExtractionError(
                        f"URL is not a web page (content-type: {content_type.split(';')[0]})."
                    )
                body = b""
                for part in resp.iter_bytes():
                    body += part
                    if len(body) > settings.URL_FETCH_MAX_BYTES:
                        raise ExtractionError("Page is too large (over 5MB).")
    except httpx.HTTPError as e:
        raise ExtractionError(f"Could not fetch URL: {e.__class__.__name__}") from e

    html = body.decode("utf-8", errors="replace")
    text = trafilatura.extract(html, url=url, include_comments=False)
    if not text or len(text.strip()) < 80:
        raise ExtractionError(
            "No readable article content found on this page."
        )

    meta = trafilatura.extract_metadata(html)
    title = (meta.title if meta and meta.title else "") or urlparse(url).netloc
    return title[:255], text.strip()
