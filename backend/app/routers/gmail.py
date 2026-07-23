from __future__ import annotations

import html
import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.gmail_connection import GmailConnection
from app.schemas.gmail import GmailAuthUrl, GmailStatus
from app.services import gmail as svc

router = APIRouter(prefix="/gmail", tags=["gmail"])


def _frontend_origin() -> str:
    settings = get_settings()
    raw = (settings.frontend_url or "https://amrogen.com").split(",")[0].strip()
    return raw.rstrip("/")


def _oauth_success_html(*, gmail_email: str, frontend_origin: str) -> str:
    """Close popup via postMessage; fall back to redirect if opened as top window."""
    payload = json.dumps({"type": "amrogen-gmail-oauth", "ok": True, "email": gmail_email or ""})
    safe_email = html.escape(gmail_email or "")
    safe_origin = json.dumps(frontend_origin)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Gmail connected — AmroGen</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background: #0f1923; color: #e2e8f0;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ text-align: center; padding: 2rem; }}
  </style>
</head>
<body>
  <div class="card">
    <p>Gmail connected{(' as <strong>' + safe_email + '</strong>') if safe_email else ''}.</p>
    <p style="color:#94a3b8;font-size:14px">You can close this window.</p>
  </div>
  <script>
    (function () {{
      var payload = {payload};
      var origin = {safe_origin};
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, origin);
          window.close();
          return;
        }}
      }} catch (e) {{}}
      window.location.replace(origin + "/settings/gmail?gmail=connected");
    }})();
  </script>
</body>
</html>
"""


def _oauth_error_html(*, detail: str, frontend_origin: str) -> str:
    payload = json.dumps({"type": "amrogen-gmail-oauth", "ok": False, "error": detail})
    safe_detail = html.escape(detail)
    safe_origin = json.dumps(frontend_origin)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Gmail connection failed — AmroGen</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background: #0f1923; color: #e2e8f0;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
    .card {{ text-align: center; padding: 2rem; max-width: 28rem; }}
  </style>
</head>
<body>
  <div class="card">
    <p>Could not connect Gmail.</p>
    <p style="color:#f87171;font-size:14px">{safe_detail}</p>
  </div>
  <script>
    (function () {{
      var payload = {payload};
      var origin = {safe_origin};
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, origin);
          setTimeout(function () {{ window.close(); }}, 1500);
          return;
        }}
      }} catch (e) {{}}
      window.location.replace(origin + "/settings/gmail?gmail=error");
    }})();
  </script>
</body>
</html>
"""


@router.get("/auth-url", response_model=GmailAuthUrl)
async def get_auth_url(current_user: CurrentUser):
    state = str(current_user.id)
    auth_url = svc.build_auth_url(state=state)
    return GmailAuthUrl(auth_url=auth_url)


@router.get("/callback")
async def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    origin = _frontend_origin()
    if error:
        return HTMLResponse(
            content=_oauth_error_html(detail=error, frontend_origin=origin),
            status_code=400,
        )
    if not code or not state:
        return HTMLResponse(
            content=_oauth_error_html(detail="Missing OAuth code or state", frontend_origin=origin),
            status_code=400,
        )
    try:
        user_id = uuid.UUID(state)
        conn = await svc.handle_oauth_callback(db, user_id, code)
    except Exception as exc:  # noqa: BLE001
        return HTMLResponse(
            content=_oauth_error_html(detail=str(exc)[:200], frontend_origin=origin),
            status_code=400,
        )
    return HTMLResponse(
        content=_oauth_success_html(gmail_email=conn.gmail_email or "", frontend_origin=origin)
    )


@router.get("/status", response_model=GmailStatus)
async def gmail_status(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    conn = await svc.get_connection(db, current_user.id)
    return GmailStatus(connected=conn is not None, gmail_email=conn.gmail_email if conn else None)


@router.delete("/disconnect", status_code=204)
async def disconnect_gmail(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(GmailConnection).where(GmailConnection.user_id == current_user.id)
    )
    await db.commit()
