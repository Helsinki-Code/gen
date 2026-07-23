from __future__ import annotations

import base64
import os
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.gmail_connection import GmailConnection
from app.services.encryption import decrypt_text, encrypt_text

settings = get_settings()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "email",
]


def get_oauth_flow(redirect_uri: str | None = None):
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=redirect_uri or settings.google_redirect_uri,
    )
    return flow


def build_auth_url(state: str) -> str:
    if settings.google_redirect_uri.startswith("http://"):
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=state,
        prompt="consent",
    )
    return auth_url


async def handle_oauth_callback(
    db: AsyncSession, user_id: uuid.UUID, code: str
) -> GmailConnection:
    if settings.google_redirect_uri.startswith("http://"):
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    import googleapiclient.discovery as discovery

    service = discovery.build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    gmail_email = user_info.get("email", "")

    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()

    encrypted_access = encrypt_text(credentials.token)
    encrypted_refresh = encrypt_text(credentials.refresh_token or "")
    expires_at = datetime.fromtimestamp(
        credentials.expiry.timestamp(), tz=timezone.utc
    ) if credentials.expiry else None

    if conn:
        conn.gmail_email = gmail_email
        conn.access_token = encrypted_access
        conn.refresh_token = encrypted_refresh
        conn.token_expires_at = expires_at
    else:
        conn = GmailConnection(
            user_id=user_id,
            gmail_email=gmail_email,
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            token_expires_at=expires_at,
        )
        db.add(conn)

    await db.commit()
    await db.refresh(conn)
    return conn


async def get_connection(db: AsyncSession, user_id: uuid.UUID) -> GmailConnection | None:
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    return result.scalar_one_or_none()


def _build_credentials(conn: GmailConnection):
    from google.oauth2.credentials import Credentials

    return Credentials(
        token=decrypt_text(conn.access_token),
        refresh_token=decrypt_text(conn.refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )


async def send_email(
    db: AsyncSession,
    user_id: uuid.UUID,
    to: str,
    subject: str,
    body: str,
) -> str:
    """Sends email via user's Gmail. Returns Gmail message ID."""
    result = await db.execute(
        select(GmailConnection).where(GmailConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise ValueError("Gmail not connected for this user")

    import googleapiclient.discovery as discovery

    credentials = _build_credentials(conn)

    if credentials.expired and credentials.refresh_token:
        from google.auth.transport.requests import Request
        credentials.refresh(Request())
        conn.access_token = encrypt_text(credentials.token)
        if credentials.expiry:
            conn.token_expires_at = datetime.fromtimestamp(
                credentials.expiry.timestamp(), tz=timezone.utc
            )
        await db.commit()

    service = discovery.build("gmail", "v1", credentials=credentials)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    result = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return result["id"]
