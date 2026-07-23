#!/usr/bin/env python3
"""
Generate blog images from docs/latest/image-generation-prompts.json.

Default behavior is dry-run only. Add --execute to call the image API.

Examples:
  python3 scripts/generate_latest_blog_images.py
  python3 scripts/generate_latest_blog_images.py --article 14
  python3 scripts/generate_latest_blog_images.py --plan /path/to/image-generation-prompts.json --execute --mirror-public --update-markdown
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PLAN = ROOT / "docs/latest/image-generation-prompts.json"
OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate AmroGen blog images from a JSON prompt plan.")
    parser.add_argument("--plan", default=str(DEFAULT_PLAN), help="Path to prompt plan JSON.")
    parser.add_argument("--article", action="append", help="Article id or slug to process. Can be repeated.")
    parser.add_argument("--asset", action="append", help="Asset id or filename to process. Can be repeated.")
    parser.add_argument("--execute", action="store_true", help="Actually call the image API. Default is dry-run.")
    parser.add_argument("--skip-existing", action="store_true", help="Skip image files that already exist.")
    parser.add_argument("--mirror-public", action="store_true", help="Copy generated images to frontend/public/assets/blog.")
    parser.add_argument("--update-markdown", action="store_true", help="Insert markdown image tags after configured headings.")
    parser.add_argument("--sleep", type=float, default=1.0, help="Seconds to sleep between API calls.")
    parser.add_argument("--batch-size", type=int, default=10, help="Images per generation batch (default: 10).")
    parser.add_argument("--batch-pause", type=float, default=10.0, help="Seconds to pause between batches.")
    parser.add_argument("--retries", type=int, default=3, help="Attempts per image after transient failures.")
    parser.add_argument("--retry-backoff", type=float, default=5.0, help="Base seconds for exponential retry backoff.")
    parser.add_argument("--timeout", type=float, default=300.0, help="Timeout in seconds for each API/download request.")
    parser.add_argument("--model", help="Override model for all assets. Defaults to JSON or OPENAI_IMAGE_MODEL.")
    parser.add_argument("--size", help="Override size for all assets, for example 1536x1024.")
    parser.add_argument("--api-key-env", default="OPENAI_API_KEY", help="Environment variable containing API key.")
    return parser.parse_args()


def load_plan(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def selected_article(article: dict[str, Any], filters: list[str] | None) -> bool:
    if not filters:
        return True
    values = {str(article.get("article_id", "")), str(article.get("slug", ""))}
    return any(item in values for item in filters)


def selected_asset(asset: dict[str, Any], filters: list[str] | None) -> bool:
    if not filters:
        return True
    values = {str(asset.get("id", "")), str(asset.get("filename", ""))}
    return any(item in values for item in filters)


def build_prompt(plan: dict[str, Any], article: dict[str, Any], asset: dict[str, Any]) -> str:
    defaults = plan.get("defaults", {})
    brand = defaults.get("brand", {})
    style_rules = defaults.get("style_rules", [])
    prompt_parts = [
        asset["prompt"].strip(),
        "",
        "Brand context:",
        f"- Brand: {brand.get('name', 'AmroGen')}",
        f"- Dark background: {brand.get('dark_background', '#0B1118')}",
        f"- Primary accent: {brand.get('primary_accent', '#22D3C5')}",
        f"- Secondary accent: {brand.get('secondary_accent', '#38BDF8')}",
        f"- Article title: {article.get('title', '')}",
        f"- Primary keyword: {article.get('primary_keyword', '')}",
        "",
        "Global style rules:",
        *[f"- {rule}" for rule in style_rules],
        "",
        "SEO output intent:",
        f"- Alt text to satisfy: {asset.get('alt_text', '')}",
        f"- Caption context: {asset.get('caption', '')}",
    ]
    return "\n".join(prompt_parts)


def generate_image(*, api_key: str, model: str, size: str, prompt: str, timeout: float) -> bytes:
    body = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "n": 1,
    }
    request = urllib.request.Request(
        OPENAI_IMAGE_ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Image API failed with HTTP {exc.code}: {details}") from exc

    data = payload.get("data") or []
    if not data:
        raise RuntimeError("Image API response did not include data.")

    first = data[0]
    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])
    if first.get("url"):
        with urllib.request.urlopen(first["url"], timeout=timeout) as image_response:
            return image_response.read()
    raise RuntimeError("Image API response did not include b64_json or url.")


def generate_with_retries(
    *,
    api_key: str,
    model: str,
    size: str,
    prompt: str,
    timeout: float,
    attempts: int,
    backoff: float,
) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return generate_image(api_key=api_key, model=model, size=size, prompt=prompt, timeout=timeout)
        except Exception as exc:
            last_error = exc
            if attempt >= attempts:
                break
            delay = backoff * (2 ** (attempt - 1))
            print(f"    ! attempt {attempt}/{attempts} failed: {exc}")
            print(f"    retrying in {delay:.1f}s")
            time.sleep(delay)
    raise RuntimeError(f"Image generation failed after {attempts} attempts: {last_error}") from last_error


def write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def mirror_to_public(source: Path, public_dir: Path) -> Path:
    destination = public_dir / source.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def image_markdown(asset: dict[str, Any]) -> str:
    return f"![{asset['alt_text']}](./assets/{asset['filename']})"


def update_markdown_file(markdown_path: Path, asset: dict[str, Any]) -> bool:
    if not markdown_path.exists():
        print(f"  ! Markdown missing: {markdown_path}")
        return False

    text = markdown_path.read_text(encoding="utf-8")
    if asset["filename"] in text:
        print(f"  = Markdown already references {asset['filename']}")
        return False

    marker = asset.get("insert_after_heading", "").strip()
    md = image_markdown(asset)
    if marker and marker in text:
        text = text.replace(marker, f"{marker}\n\n{md}", 1)
    else:
        first_heading_end = text.find("\n")
        if first_heading_end == -1:
            text = f"{text}\n\n{md}\n"
        else:
            text = f"{text[:first_heading_end]}\n\n{md}{text[first_heading_end:]}"
        print(f"  ! Heading marker not found, inserted after first heading: {marker}")

    markdown_path.write_text(text, encoding="utf-8")
    print(f"  + Markdown updated: {markdown_path}")
    return True


def main() -> int:
    args = parse_args()
    plan_path = Path(args.plan)
    if not plan_path.is_absolute():
        plan_path = ROOT / plan_path
    plan = load_plan(plan_path)

    defaults = plan.get("defaults", {})
    output_dir = ROOT / defaults.get("output_dir", "docs/latest/assets")
    public_dir = ROOT / defaults.get("public_mirror_dir", "frontend/public/assets/blog")
    model = args.model or os.getenv("OPENAI_IMAGE_MODEL") or defaults.get("model", "gpt-image-2")
    api_key = os.getenv(args.api_key_env, "")

    if args.batch_size < 1:
        print("--batch-size must be at least 1.", file=sys.stderr)
        return 2
    if args.retries < 1:
        print("--retries must be at least 1.", file=sys.stderr)
        return 2

    tasks: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for article in plan.get("articles", []):
        if not selected_article(article, args.article):
            continue
        for asset in article.get("assets", []):
            if selected_asset(asset, args.asset):
                tasks.append((article, asset))

    total = len(tasks)
    generated = 0
    skipped = 0

    if args.execute and not api_key:
        print(f"Missing API key. Set {args.api_key_env} before running with --execute.", file=sys.stderr)
        return 2

    if not args.execute:
        print("Dry run only. Add --execute to generate images.")

    batch_count = (total + args.batch_size - 1) // args.batch_size
    for batch_index, batch_start in enumerate(range(0, total, args.batch_size), start=1):
        batch = tasks[batch_start : batch_start + args.batch_size]
        print(f"\n=== Batch {batch_index}/{batch_count}: {len(batch)} image(s) ===")
        active_article_id = None

        for article, asset in batch:
            if article.get("article_id") != active_article_id:
                active_article_id = article.get("article_id")
                print(f"\n[{active_article_id}] {article.get('title')}")
            markdown_path = Path(article["source_markdown"])
            if not markdown_path.is_absolute():
                markdown_path = ROOT / markdown_path
            filename = asset["filename"]
            destination = output_dir / filename
            size = args.size or asset.get("size", "1536x1024")
            prompt = build_prompt(plan, article, asset)

            print(f"  - {asset.get('id')} -> {display_path(destination)}")
            print(f"    role={asset.get('role')} size={size} model={model}")
            print(f"    alt={asset.get('alt_text')}")

            if args.skip_existing and destination.exists():
                skipped += 1
                print("    skipped existing file")
                if args.update_markdown:
                    update_markdown_file(markdown_path, asset)
                continue

            if not args.execute:
                continue

            image_bytes = generate_with_retries(
                api_key=api_key,
                model=model,
                size=size,
                prompt=prompt,
                timeout=args.timeout,
                attempts=args.retries,
                backoff=args.retry_backoff,
            )
            write_bytes(destination, image_bytes)
            generated += 1
            print(f"    wrote {destination}")

            if args.mirror_public:
                mirrored = mirror_to_public(destination, public_dir)
                print(f"    mirrored {mirrored}")

            if args.update_markdown:
                update_markdown_file(markdown_path, asset)

            if args.sleep > 0:
                time.sleep(args.sleep)

        if args.execute and batch_index < batch_count and args.batch_pause > 0:
            print(f"\nBatch {batch_index} complete. Pausing {args.batch_pause:.1f}s before the next batch.")
            time.sleep(args.batch_pause)

    print(f"\nPlanned assets: {total}")
    if args.execute:
        print(f"Generated: {generated}")
        print(f"Skipped: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
