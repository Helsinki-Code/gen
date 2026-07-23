from __future__ import annotations

import base64
import os

from app.config import get_settings

settings = get_settings()


def _get_fernet():
    from cryptography.fernet import Fernet

    key = settings.local_encryption_key
    # Fernet needs a 32-byte URL-safe base64-encoded key
    padded = key.encode()[:32].ljust(32, b"\x00")
    fernet_key = base64.urlsafe_b64encode(padded)
    return Fernet(fernet_key)


def encrypt_text(plaintext: str) -> str:
    if settings.kms_key_resource_name:
        return _kms_encrypt(plaintext)
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_text(ciphertext: str) -> str:
    if settings.kms_key_resource_name:
        return _kms_decrypt(ciphertext)
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()


def _kms_encrypt(plaintext: str) -> str:
    from google.cloud import kms

    client = kms.KeyManagementServiceClient()
    response = client.encrypt(
        request={
            "name": settings.kms_key_resource_name,
            "plaintext": plaintext.encode(),
        }
    )
    return base64.urlsafe_b64encode(response.ciphertext).decode()


def _kms_decrypt(ciphertext_b64: str) -> str:
    from google.cloud import kms

    client = kms.KeyManagementServiceClient()
    ciphertext = base64.urlsafe_b64decode(ciphertext_b64)
    response = client.decrypt(
        request={
            "name": settings.kms_key_resource_name,
            "ciphertext": ciphertext,
        }
    )
    return response.plaintext.decode()
