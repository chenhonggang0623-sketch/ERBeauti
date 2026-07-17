"""Tests for connection URL building, SSRF protection and sanitization."""

import pytest

from erbeauti.api_models import ConnectionFields
from erbeauti.config import settings
from erbeauti.db.url_builder import (
    build_connection_url,
    redact_url_in_message,
    sanitize_url,
    validate_sqlite_path,
    validate_url_target,
)
from erbeauti.exceptions import UnsupportedDialectError, UpstreamConnectionError, ValidationError


def test_build_postgresql_url_with_all_fields() -> None:
    fields = ConnectionFields(
        dialect="postgresql",
        host="db.example.com",
        port=5432,
        database="mydb",
        username="user",
        password="p@ss w+rd",
        options="sslmode=require",
    )
    url = build_connection_url(fields)
    assert url.startswith("postgresql://")
    assert "db.example.com:5432" in url
    assert "mydb" in url
    assert "sslmode=require" in url
    # Password with special characters must be percent-encoded.
    assert "p%40ss+w%2Brd" in url
    assert "p@ss" not in url


def test_build_mysql_url_uses_default_port() -> None:
    fields = ConnectionFields(
        dialect="mysql",
        host="db.example.com",
        database="app",
        username="root",
    )
    url = build_connection_url(fields)
    assert url == "mysql+pymysql://root@db.example.com:3306/app"


def test_build_sqlite_relative_path() -> None:
    fields = ConnectionFields(dialect="sqlite", database="app.db")
    # Relative paths use 2-slash format so _sqlite_path_from_url
    # extracts them as bare filenames for data_dir resolution.
    assert build_connection_url(fields) == "sqlite://app.db"


def test_build_sqlite_absolute_path() -> None:
    fields = ConnectionFields(dialect="sqlite", database="/var/lib/app.db")
    assert build_connection_url(fields) == "sqlite:///var/lib/app.db"


def test_build_sqlite_memory() -> None:
    fields = ConnectionFields(dialect="sqlite", database=":memory:")
    assert build_connection_url(fields) == "sqlite:///:memory:"


def test_build_unsupported_dialect_raises() -> None:
    fields = ConnectionFields(dialect="mongodb", host="example.com")
    with pytest.raises(UnsupportedDialectError):
        build_connection_url(fields)


def test_sqlite_network_dialect_requires_host() -> None:
    fields = ConnectionFields(dialect="postgresql")
    with pytest.raises(ValidationError):
        build_connection_url(fields)


def test_validate_sqlite_path_blocks_system_paths() -> None:
    for bad in ("/etc/passwd", "/proc/self/environ", "/dev/null"):
        with pytest.raises(ValidationError):
            validate_sqlite_path(bad)


def test_validate_sqlite_path_allows_normal_paths() -> None:
    validate_sqlite_path("app.db")
    validate_sqlite_path("/tmp/app.db")
    validate_sqlite_path(":memory:")


def test_validate_sqlite_path_rejects_traversal() -> None:
    with pytest.raises(ValidationError):
        validate_sqlite_path("../../etc/passwd")


def test_validate_url_target_allows_private_ips_by_default() -> None:
    # Local development default allows private/loopback networks.
    for ip in ("10.0.0.1", "172.16.0.1", "192.168.1.1", "127.0.0.1"):
        validate_url_target(f"postgresql://user:pass@{ip}/db")


def test_validate_url_target_blocks_private_ips_when_disabled() -> None:
    original = settings.allow_private_networks
    settings.allow_private_networks = False
    try:
        for ip in ("10.0.0.1", "172.16.0.1", "192.168.1.1", "127.0.0.1"):
            with pytest.raises(UpstreamConnectionError):
                validate_url_target(f"postgresql://user:pass@{ip}/db")
    finally:
        settings.allow_private_networks = original


def test_validate_url_target_blocks_metadata_ip() -> None:
    # Cloud metadata endpoint is always blocked.
    with pytest.raises(UpstreamConnectionError):
        validate_url_target("postgresql://user:pass@169.254.169.254/db")


def test_validate_url_target_allows_localhost_by_default() -> None:
    # Default settings permit localhost for local development.
    validate_url_target("postgresql://user:pass@localhost/db")


def test_validate_url_target_blocks_localhost_when_disabled() -> None:
    original = settings.allow_private_networks
    settings.allow_private_networks = False
    try:
        with pytest.raises(UpstreamConnectionError):
            validate_url_target("postgresql://user:pass@localhost/db")
    finally:
        settings.allow_private_networks = original


def test_validate_url_target_allows_public_host() -> None:
    # example.com resolves to public addresses; should not raise.
    validate_url_target("postgresql://user:pass@example.com/db")


def test_validate_url_target_validates_sqlite_path() -> None:
    with pytest.raises(ValidationError):
        validate_url_target("sqlite:////etc/passwd")
    validate_url_target("sqlite:///tmp/app.db")


def test_sanitize_url_masks_password() -> None:
    url = "postgresql://user:secret@db.example.com:5432/mydb"
    sanitized = sanitize_url(url)
    assert "secret" not in sanitized
    assert "***" in sanitized
    assert sanitized == "postgresql://user:***@db.example.com:5432/mydb"


def test_sanitize_url_untouched_without_password() -> None:
    url = "postgresql://db.example.com:5432/mydb"
    assert sanitize_url(url) == url


def test_redact_url_in_message() -> None:
    message = "Failed to connect to postgresql://user:secret@db.example.com/db"
    redacted = redact_url_in_message(message)
    assert "secret" not in redacted
    assert "user:***@" in redacted
