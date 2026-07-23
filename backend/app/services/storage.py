from __future__ import annotations

import asyncio
from pathlib import Path

from app.config import get_settings

settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]
LOCAL_PREFIX = "local://"


def _local_root() -> Path:
    configured = Path(settings.local_storage_dir).expanduser()
    return configured if configured.is_absolute() else BACKEND_ROOT / configured


def _local_path(storage_path: str) -> Path:
    relative_path = storage_path.removeprefix(LOCAL_PREFIX).lstrip("/")
    return _local_root() / relative_path


def _should_try_gcs() -> bool:
    if settings.storage_backend == "local":
        return False
    if settings.storage_backend == "gcs":
        return True
    credentials_path = Path(settings.google_application_credentials).expanduser()
    return bool(settings.gcs_bucket_name and credentials_path.is_file())


def _gcs_client():
    from google.cloud import storage as gcs

    credentials_path = Path(settings.google_application_credentials).expanduser()
    if credentials_path.is_file():
        from google.oauth2 import service_account

        credentials = service_account.Credentials.from_service_account_file(str(credentials_path))
        return gcs.Client(project=credentials.project_id, credentials=credentials)
    return gcs.Client()


def _write_local(data: bytes, storage_path: str) -> str:
    local_path = _local_path(storage_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    return f"{LOCAL_PREFIX}{storage_path.removeprefix(LOCAL_PREFIX).lstrip('/')}"


async def upload_bytes(data: bytes, gcs_path: str) -> str:
    """Upload bytes to GCS (or local filesystem in dev). Returns the gcs_path."""
    if _should_try_gcs():
        try:
            client = _gcs_client()
            bucket = client.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(gcs_path)
            await asyncio.to_thread(blob.upload_from_string, data)
            return gcs_path
        except Exception:
            if settings.environment == "production" or settings.storage_backend == "gcs":
                raise

    return await asyncio.to_thread(_write_local, data, gcs_path)


async def upload_text(text: str, gcs_path: str) -> str:
    return await upload_bytes(text.encode("utf-8"), gcs_path)


async def download_text(gcs_path: str) -> str:
    local_path = _local_path(gcs_path)
    if gcs_path.startswith(LOCAL_PREFIX) or local_path.exists():
        return await asyncio.to_thread(local_path.read_text, encoding="utf-8")

    if _should_try_gcs():
        client = _gcs_client()
        bucket = client.bucket(settings.gcs_bucket_name)
        blob = bucket.blob(gcs_path)
        return await asyncio.to_thread(blob.download_as_text)

    return await asyncio.to_thread(local_path.read_text, encoding="utf-8")


async def download_bytes(gcs_path: str) -> bytes:
    local_path = _local_path(gcs_path)
    if gcs_path.startswith(LOCAL_PREFIX) or local_path.exists():
        return await asyncio.to_thread(local_path.read_bytes)

    if _should_try_gcs():
        client = _gcs_client()
        bucket = client.bucket(settings.gcs_bucket_name)
        blob = bucket.blob(gcs_path)
        return await asyncio.to_thread(blob.download_as_bytes)

    return await asyncio.to_thread(local_path.read_bytes)


def make_gcs_path(user_id: str, campaign_id: str, file_type: str, extension: str) -> str:
    return f"{user_id}/{campaign_id}/{file_type}.{extension}"
