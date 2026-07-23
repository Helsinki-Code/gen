"""Cloud Run entrypoint — no shell script (avoids Windows CRLF shebang failures)."""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading


logging.basicConfig(level=logging.INFO, format="[entrypoint] %(message)s")
log = logging.getLogger("entrypoint")


def _run_migrations() -> None:
    log.info("Running alembic upgrade head...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            log.info("Migrations complete.")
        else:
            log.warning("alembic failed (API still serving): %s", result.stderr[-500:] if result.stderr else result.stdout)
    except Exception as exc:  # noqa: BLE001
        log.warning("alembic raised (API still serving): %s", exc)


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    # Migrations in background so PORT binds immediately via uvicorn.
    threading.Thread(target=_run_migrations, name="alembic", daemon=True).start()

    import uvicorn

    log.info("Starting uvicorn on 0.0.0.0:%s", port)
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
