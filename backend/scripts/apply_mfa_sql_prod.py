"""Apply sql/mfa-admin.sql using Amrogen backend/.env.production only. No secrets printed."""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg2
from urllib.parse import quote_plus, urlparse

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROD_ENV = BACKEND_ROOT / ".env.production"
SQL_PATH = BACKEND_ROOT / "sql" / "mfa-admin.sql"
LABEL = "amrogen/backend"


def load_prod_dsn() -> tuple[str, str, str]:
    if not PROD_ENV.exists():
        raise FileNotFoundError(".env.production missing")
    vals: dict[str, str] = {}
    for line in PROD_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        vals[key.strip()] = value.strip().strip('"').strip("'")

    if vals.get("DATABASE_URL"):
        raw = vals["DATABASE_URL"]
        # strip +asyncpg for psycopg2
        dsn = raw.replace("postgresql+asyncpg://", "postgresql://").replace(
            "postgres+asyncpg://", "postgresql://"
        )
        parsed = urlparse(dsn)
        return dsn, parsed.path.lstrip("/") or "(url)", parsed.hostname or "(url)"

    ssl = vals.get("DB_SSL", "false").lower() in ("1", "true", "yes", "require")
    password = quote_plus(vals.get("DB_PASSWORD", ""))
    host = vals["DB_HOST"]
    db = vals["DB_NAME"]
    user = vals["DB_USER"]
    port = vals.get("DB_PORT", "5432")
    query = "?sslmode=require" if ssl else ""
    dsn = f"postgresql://{user}:{password}@{host}:{port}/{db}{query}"
    return dsn, db, host


def main() -> int:
    if not SQL_PATH.is_file():
        print(f"{LABEL}: SKIP (sql missing)")
        return 1
    try:
        dsn, db_name, host = load_prod_dsn()
    except Exception as e:
        print(f"{LABEL}: FAIL {e}")
        return 1

    sql = SQL_PATH.read_text(encoding="utf-8")
    try:
        conn = psycopg2.connect(dsn)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                "SELECT to_regclass('public.user_mfa'), to_regclass('public.otp_codes')"
            )
            um, oc = cur.fetchone()
        conn.close()
        print(f"{LABEL}: OK db={db_name} host={host} user_mfa={um} otp_codes={oc}")
        return 0
    except Exception as e:
        print(f"{LABEL}: FAIL {type(e).__name__}: {str(e)[:180]}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
