#!/bin/sh
# Cloud Run requires a process listening on $PORT quickly.
# Start uvicorn first; run migrations after the port is bound.
set +e

PORT="${PORT:-8000}"
echo "[start.sh] Starting uvicorn on 0.0.0.0:${PORT}..."
uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" &
UVICORN_PID=$!

# Give uvicorn a moment to bind before heavy migration work
sleep 2
if ! kill -0 "${UVICORN_PID}" 2>/dev/null; then
  echo "[start.sh] ERROR: uvicorn exited immediately ? check import/startup errors above"
  wait "${UVICORN_PID}"
  exit 1
fi

echo "[start.sh] Running alembic upgrade head (background-safe)..."
if alembic upgrade head; then
  echo "[start.sh] Migrations complete."
else
  echo "[start.sh] WARNING: alembic upgrade failed ? API is still listening on ${PORT}"
fi

wait "${UVICORN_PID}"
exit $?
