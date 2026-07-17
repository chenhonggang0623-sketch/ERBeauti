"""Utilities for building, validating and sanitizing database connection URLs."""

from __future__ import annotations

import ipaddress
import os
import re
import socket
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urlunparse

from erbeauti.config import settings

from erbeauti.api_models import ConnectionFields
from erbeauti.config import settings
from erbeauti.exceptions import (
    InvalidConnectionUrlError,
    UnsupportedDialectError,
    UpstreamConnectionError,
    ValidationError,
)

DRIVER_MAP: dict[str, str] = {
    "mysql": "pymysql",
    "mariadb": "pymysql",
}

DEFAULT_PORTS: dict[str, int | None] = {
    "postgresql": 5432,
    "postgres": 5432,
    "mysql": 3306,
    "mariadb": 3306,
    "sqlite": None,
    "sqlite+pysqlite": None,
    "mssql": 1433,
    "mssql+pyodbc": 1433,
    "oracle": 1521,
    "oracle+oracledb": 1521,
}

# Cloud metadata endpoint and private IPv4 ranges that must be rejected.
_METADATA_IP = ipaddress.ip_address("169.254.169.254")
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local (covers metadata)
]

# Filesystem prefixes that SQLite must never be asked to open.
_BLOCKED_SQLITE_PREFIXES = frozenset(
    {
        "/etc",
        "/proc",
        "/sys",
        "/dev",
        "/boot",
        "/bin",
        "/sbin",
        "/lib",
        "/lib64",
        "/usr/bin",
        "/usr/sbin",
        "/var/log",
    }
)
_BLOCKED_SQLITE_WINDOWS_PREFIXES = frozenset(
    {
        "C:\\\\Windows",
        "C:/Windows",
        "\\\\Windows",
        "/Windows",
        "C:\\\\Program Files",
        "C:/Program Files",
    }
)


def _normalize_dialect(dialect: str) -> str:
    normalized = dialect.lower().strip()
    # Map common aliases to the canonical scheme used by SQLAlchemy / factory.
    aliases = {
        "pg": "postgresql",
        "pgsql": "postgresql",
        "psql": "postgresql",
        "maria": "mariadb",
    }
    return aliases.get(normalized, normalized)


def build_connection_url(fields: ConnectionFields) -> str:
    """Build a SQLAlchemy connection URL from structured connection fields."""
    if not isinstance(fields, ConnectionFields):
        raise TypeError("fields must be a ConnectionFields instance")

    # Local import to avoid a circular dependency with erbeauti.db.factory.
    from erbeauti.db.factory import get_supported_dialects

    dialect = _normalize_dialect(fields.dialect)
    supported = get_supported_dialects()
    if dialect not in supported:
        raise UnsupportedDialectError(
            f"Unsupported database dialect '{fields.dialect}'. "
            f"Supported: {', '.join(sorted(set(supported)))}"
        )

    if dialect in ("sqlite", "sqlite+pysqlite"):
        return _build_sqlite_url(fields)
    return _build_network_url(fields, dialect)


def _build_network_url(fields: ConnectionFields, dialect: str) -> str:
    """Assemble a network database URL."""
    if not fields.host:
        raise ValidationError(f"host is required for dialect '{dialect}'")

    port = fields.port or DEFAULT_PORTS.get(dialect)

    driver = DRIVER_MAP.get(dialect)
    scheme = f"{dialect}+{driver}" if driver else dialect
    parts: list[str] = [f"{scheme}://"]

    if fields.username:
        parts.append(quote_plus(fields.username))
        if fields.password:
            parts.append(":")
            parts.append(quote_plus(fields.password))
        parts.append("@")

    parts.append(fields.host)

    if port is not None:
        parts.append(f":{port}")

    if fields.database:
        # Preserve forward slashes for Oracle service-name style values while
        # encoding other special characters.
        parts.append("/")
        parts.append(quote_plus(fields.database, safe="/"))

    if fields.options:
        parts.append("?")
        # options is passed as a raw query string from the client; prepend with
        # '?' if the caller omitted it for convenience.
        options = fields.options
        if options.startswith("?"):
            options = options[1:]
        parts.append(options)

    return "".join(parts)


def _build_sqlite_url(fields: ConnectionFields) -> str:
    """Assemble a SQLite connection URL."""
    database = fields.database or ""

    if database == ":memory:":
        return "sqlite:///:memory:"

    if not database:
        raise ValidationError("database (file path) is required for SQLite")

    validate_sqlite_path(database)

    # Per SQLAlchemy convention:
    # - sqlite:///absolute/path (3 slashes) -> /absolute/path
    # - sqlite://relative/path (2 slashes) -> relative/path
    path = database.replace("\\", "/")
    if os.path.isabs(path):
        return f"sqlite:///{path.lstrip('/')}"
    return f"sqlite://{path}"


def validate_sqlite_path(database: str) -> None:
    """Reject SQLite database paths that point to system files."""
    if database == ":memory:":
        return

    # Reject path traversal that escapes the intended location.
    normalized = os.path.normpath(database)
    if ".." in Path(normalized).parts:
        raise ValidationError(
            f"SQLite path contains unsafe traversal: {database}"
        )

    lower_path = normalized.lower()
    for prefix in _BLOCKED_SQLITE_PREFIXES:
        lower_prefix = prefix.lower()
        if lower_path == lower_prefix or lower_path.startswith(lower_prefix + "/"):
            raise ValidationError(
                f"SQLite path points to a restricted system location: {database}"
            )
    for prefix in _BLOCKED_SQLITE_WINDOWS_PREFIXES:
        lower_prefix = prefix.lower().rstrip("/")
        if lower_path == lower_prefix or lower_path.startswith(lower_prefix + "\\") or lower_path.startswith(lower_prefix + "/"):
            raise ValidationError(
                f"SQLite path points to a restricted system location: {database}"
            )


def validate_url_target(url: str) -> None:
    """Verify that a connection URL does not target internal/reserved hosts.

    SQLite file URLs are validated via :func:`validate_sqlite_path`.
    """
    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise InvalidConnectionUrlError(f"Malformed connection URL: {exc}") from exc

    scheme = parsed.scheme.lower()
    if scheme in ("sqlite", "sqlite+pysqlite"):
        # Extract the filesystem path and validate it.
        path = _sqlite_path_from_url(url)
        validate_sqlite_path(path)
        return

    hostname = parsed.hostname
    if not hostname:
        raise InvalidConnectionUrlError("Connection URL is missing a hostname")

    _validate_hostname(hostname)


def _resolve_sqlite_path(raw_path: str) -> str:
    """Resolve a SQLite path to an absolute filesystem path."""
    if raw_path == ":memory:":
        return raw_path
    if "/" not in raw_path and "\\" not in raw_path:
        data_dir = settings.sqlite_data_dir
        if data_dir:
            return os.path.abspath(os.path.join(data_dir, raw_path))
        return os.path.abspath(raw_path)
    return os.path.abspath(raw_path)


def _sqlite_path_from_url(url: str) -> str:
    """Return the filesystem path portion of a sqlite URL."""
    parsed = urlparse(url)
    if parsed.scheme not in ("sqlite", "sqlite+pysqlite"):
        raise InvalidConnectionUrlError(f"Not a SQLite URL: {url}")
    if url.startswith("sqlite:///:memory:"):
        return ":memory:"
    # Handle URL formats:
    # - sqlite:////absolute/path (4 slashes) -> //absolute/path -> /absolute/path
    # - sqlite:///absolute/path (3 slashes with nested /) -> /absolute/path
    # - sqlite:///filename.db (3 slashes, no nested /) -> filename.db (relative)
    # - sqlite://relative/path (2 slashes) -> relative/path
    path = url.split("sqlite://", 1)[-1]
    if path.startswith("//"):
        path = path[1:]
    elif path.startswith("/"):
        remaining = path[1:]
        if "/" not in remaining and "\\" not in remaining:
            path = remaining
    return _resolve_sqlite_path(path)


def _validate_hostname(hostname: str) -> None:
    """Resolve and validate a hostname against SSRF blocklists."""
    # Fast path: literal IPv4/IPv6 addresses.
    try:
        ip = ipaddress.ip_address(hostname)
        _check_ip_allowed(ip)
        return
    except ValueError:
        pass

    # Hostname resolution. Block obvious local names only when private networks
    # are disabled (e.g. production deployments).
    lower_host = hostname.lower()
    if not settings.allow_private_networks and lower_host in {"localhost", "localhost.localdomain"}:
        raise UpstreamConnectionError(
            f"Connections to '{hostname}' are not allowed."
        )

    # When private networks are allowed (local dev), skip DNS resolution to
    # avoid intermittent failures from slow/flaky DNS that would produce false
    # negatives before the actual database connection attempt.  Only the cloud
    # metadata IP is blocked, and that check only applies to literal IPs (handled
    # above) — hostnames pointing to it are an acceptable trade-off in dev mode.
    if settings.allow_private_networks:
        return

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UpstreamConnectionError(
            f"Unable to resolve hostname '{hostname}': {exc}"
        ) from exc

    seen: set[str] = set()
    for info in infos:
        ip_str = str(info[4][0])
        if ip_str in seen:
            continue
        seen.add(ip_str)
        try:
            _check_ip_allowed(ipaddress.ip_address(ip_str))
        except UpstreamConnectionError as exc:
            raise UpstreamConnectionError(
                f"Resolved '{hostname}' to {ip_str}, which is not allowed."
            ) from exc


def _check_ip_allowed(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    """Raise UpstreamConnectionError if *ip* targets forbidden addresses.

    The cloud metadata endpoint is always blocked. Private/loopback networks are
    blocked only when ``allow_private_networks`` is disabled.
    """
    if ip == _METADATA_IP:
        raise UpstreamConnectionError(
            "Connections to cloud metadata endpoint are not allowed."
        )
    if not settings.allow_private_networks:
        if ip.is_loopback:
            raise UpstreamConnectionError("Connections to loopback addresses are not allowed.")
        if ip.is_link_local:
            raise UpstreamConnectionError("Connections to link-local addresses are not allowed.")
        for network in _PRIVATE_NETWORKS:
            if ip in network:
                raise UpstreamConnectionError(
                    "Connections to private/internal networks are not allowed."
                )


def sanitize_url(url: str) -> str:
    """Return a copy of *url* with the password replaced by '***'.

    If the URL cannot be parsed, the original string is returned unchanged.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return url

    if not parsed.password:
        return url

    username = parsed.username or ""
    credentials = f"{username}:***" if username else "***"
    netloc_parts = [credentials, "@"]

    hostname = parsed.hostname or ""
    netloc_parts.append(hostname)

    if parsed.port is not None:
        netloc_parts.append(f":{parsed.port}")

    sanitized_netloc = "".join(netloc_parts)
    return urlunparse(parsed._replace(netloc=sanitized_netloc))


def redact_url_in_message(message: str) -> str:
    """Best-effort removal of credentials from error messages containing URLs."""
    # Match common URL forms with user:pass@ and replace with user:***@
    pattern = re.compile(r"([a-zA-Z][a-zA-Z0-9+.-]*://)([^@:]+):([^@]+)@")
    return pattern.sub(r"\1\2:***@", message)
