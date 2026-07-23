from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[3]
BLOG_SOURCE_DIR = PROJECT_ROOT / "docs" / "latest"


@dataclass(frozen=True)
class PodcastSourceDocument:
    route: str
    slug: str
    title: str
    markdown: str
    file_path: Path


class PodcastSourceNotFoundError(ValueError):
    pass


def _slugify(value: str) -> str:
    normalized = unquote(value).strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-")


def _file_slug(path: Path) -> str:
    return re.sub(r"^\d+-", "", path.stem)


def _markdown_title(markdown: str) -> str:
    match = re.search(r"^#\s+(.+)$", markdown, flags=re.MULTILINE)
    return match.group(1).strip() if match else "AmroGen article"


def resolve_local_blog_source(source_url: str | None) -> PodcastSourceDocument | None:
    if not source_url:
        return None

    parsed = urlsplit(source_url.strip())
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/blog/"):
        return None

    requested = unquote(parsed.path.removeprefix("/blog/")).strip("/")
    requested_slug = _slugify(requested)
    if not requested_slug or "/" in requested:
        raise PodcastSourceNotFoundError("Use a local article path in the form /blog/article-slug.")
    if not BLOG_SOURCE_DIR.exists():
        raise PodcastSourceNotFoundError(f"Local article directory is unavailable: {BLOG_SOURCE_DIR}")

    for path in sorted(BLOG_SOURCE_DIR.glob("[0-9]*-*.md")):
        markdown = path.read_text(encoding="utf-8")
        title = _markdown_title(markdown)
        slug = _file_slug(path)
        if requested_slug in {slug, _slugify(title)}:
            return PodcastSourceDocument(
                route=f"/blog/{slug}",
                slug=slug,
                title=title,
                markdown=markdown,
                file_path=path,
            )

    raise PodcastSourceNotFoundError(
        f"No published local article matched '/blog/{requested}'. Check the slug shown on the blog page."
    )
