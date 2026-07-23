from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

import tldextract


PROHIBITED_TERMS = {
    "password", "passwd", "credential", "private key", "api key", "secret token",
    "access token", "admin login", "database dump", "email dump", "leaked database",
    "exposed camera", "webcam", "iot device", "confidential document", "pastebin",
    "shodan", "censys", "zoomeye",
}
PROHIBITED_EXTENSIONS = {".env", ".pem", ".key", ".sql", ".log"}
PROHIBITED_DOMAINS = {
    "pastebin.com", "ghostbin.com", "rentry.co", "shodan.io", "censys.io", "zoomeye.org"
}
ALLOWED_OPERATORS = {"site", "filetype", "before", "after"}
_extract = tldextract.TLDExtract(suffix_list_urls=())


class UnsafeDiscoveryInput(ValueError):
    pass


def _flat_text(value) -> str:
    if isinstance(value, dict):
        return " ".join(_flat_text(v) for v in value.values())
    if isinstance(value, (list, tuple, set)):
        return " ".join(_flat_text(v) for v in value)
    return str(value or "")


def validate_discovery_criteria(criteria: dict) -> None:
    text = _flat_text(criteria).lower()
    matches = sorted(term for term in PROHIBITED_TERMS if term in text)
    if matches:
        raise UnsafeDiscoveryInput(
            f"Account Discovery only supports public business research; prohibited intent: {', '.join(matches)}"
        )


def validate_query(query: str) -> str:
    compact = " ".join(query.split()).strip()
    if not compact or len(compact) > 600:
        raise UnsafeDiscoveryInput("Generated query is empty or too long")
    lower = compact.lower()
    if any(term in lower for term in PROHIBITED_TERMS):
        raise UnsafeDiscoveryInput("Generated query contains a prohibited research term")
    if any(ext in lower for ext in PROHIBITED_EXTENSIONS):
        raise UnsafeDiscoveryInput("Generated query requests a prohibited file type")
    for operator in re.findall(r"(?<!https)(?<!http)\b([a-zA-Z]+):", compact):
        if operator.lower() not in ALLOWED_OPERATORS:
            raise UnsafeDiscoveryInput(f"Unsupported search operator: {operator}:")
    return compact


def normalize_domain(value: str) -> str:
    raw = value.strip().lower()
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").rstrip(".")
    if not host:
        return ""
    extracted = _extract(host)
    if not extracted.domain or not extracted.suffix:
        return ""
    return f"{extracted.domain}.{extracted.suffix}"


def validate_public_url(value: str) -> tuple[str, str]:
    raw = value.strip()
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeDiscoveryInput("Evidence URL must be public HTTP or HTTPS")
    host = parsed.hostname.lower().rstrip(".")
    try:
        address = ipaddress.ip_address(host)
        if not address.is_global:
            raise UnsafeDiscoveryInput("Private, local and reserved IP targets are not allowed")
        raise UnsafeDiscoveryInput("Raw IP targets are not allowed")
    except ValueError:
        pass
    domain = normalize_domain(host)
    if not domain:
        raise UnsafeDiscoveryInput("Evidence URL does not contain a registrable domain")
    if domain in PROHIBITED_DOMAINS:
        raise UnsafeDiscoveryInput("This source is not allowed for Account Discovery")
    path_lower = parsed.path.lower()
    if any(path_lower.endswith(ext) for ext in PROHIBITED_EXTENSIONS):
        raise UnsafeDiscoveryInput("This evidence file type is not allowed")
    clean_url = parsed._replace(fragment="").geturl()
    return clean_url, domain
