"""Run Alembic against production using backend/.env.production only."""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROD_ENV = BACKEND_ROOT / ".env.production"


def load_prod_database_url() -> str:
    if not PROD_ENV.exists():
        raise FileNotFoundError("backend/.env.production is required for prod migrations")

    vals: dict[str, str] = {}
    for line in PROD_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        vals[key.strip()] = value.strip().strip('"').strip("'")

    if vals.get("DATABASE_URL"):
        return vals["DATABASE_URL"]

    ssl = vals.get("DB_SSL", "false").lower() in ("1", "true", "yes", "require")
    query = "?ssl=require" if ssl else ""
    password = quote_plus(vals.get("DB_PASSWORD", ""))
    return (
        f"postgresql+asyncpg://{vals['DB_USER']}:{password}"
        f"@{vals['DB_HOST']}:{vals.get('DB_PORT', '5432')}/{vals['DB_NAME']}{query}"
    )


def configure_prod_env() -> str:
    database_url = load_prod_database_url()
    os.environ["DATABASE_URL"] = database_url
    os.chdir(BACKEND_ROOT)
    sys.path.insert(0, str(BACKEND_ROOT))
    from app.config import get_settings

    get_settings.cache_clear()
    return database_url


async def get_alembic_version(database_url: str) -> str | None:
    engine = create_async_engine(database_url)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT version_num FROM alembic_version"))
        row = result.first()
    await engine.dispose()
    return row[0] if row else None


async def podcast_columns_missing(database_url: str) -> bool:
    engine = create_async_engine(database_url)
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'podcast_episodes' AND column_name = 'cover_image_path'"
            )
        )
        missing = result.first() is None
    await engine.dispose()
    return missing


async def repair_podcast_columns(database_url: str) -> None:
    statements = [
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS cover_image_path VARCHAR",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS cover_image_mime_type VARCHAR(96)",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS cover_image_alt VARCHAR(320)",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS cover_image_prompt TEXT",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS seo_title VARCHAR(180)",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS seo_description VARCHAR(320)",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS seo_content TEXT",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS seo_keywords TEXT",
        "ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS seo_faq TEXT",
    ]
    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))
    await engine.dispose()


def run_alembic_upgrade() -> None:
    python = BACKEND_ROOT / ".venv" / "Scripts" / "python.exe"
    result = subprocess.run(
        [str(python), "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=os.environ.copy(),
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)


async def main() -> None:
    database_url = configure_prod_env()
    before = await get_alembic_version(database_url)
    print(f"prod_before={before or 'none'}")

    if await podcast_columns_missing(database_url):
        print("repair=podcast_seo_columns")
        await repair_podcast_columns(database_url)

    run_alembic_upgrade()

    after = await get_alembic_version(database_url)
    print(f"prod_after={after or 'none'}")
    if after != "0011":
        raise SystemExit(f"Expected head 0011, got {after}")


if __name__ == "__main__":
    asyncio.run(main())
