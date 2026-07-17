"""Fernet-based password encryption for stored credentials."""

from __future__ import annotations

import base64
import os
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from erbeauti.config import settings

_fernet: Fernet | None = None


def _derive_key(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=600_000)
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))


def _load_or_create_key() -> bytes:
    """Load key from env var, or create/persist one to data dir."""
    if settings.secret_key:
        # env var: raw 32-byte key, base64-encoded
        return settings.secret_key.encode() if isinstance(settings.secret_key, str) else settings.secret_key  # type: ignore[arg-type]

    key_file = Path(settings.data_dir) / "secret.key"
    key_file.parent.mkdir(parents=True, exist_ok=True)

    if key_file.exists():
        return key_file.read_bytes()

    key = Fernet.generate_key()
    key_file.write_bytes(key)
    key_file.chmod(0o600)
    return key


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = _load_or_create_key()
        _fernet = Fernet(key)
    return _fernet


def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    f = get_fernet()
    return f.encrypt(plain.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()
