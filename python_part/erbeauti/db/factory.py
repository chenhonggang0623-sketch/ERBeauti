"""Factory for resolving a database URL to a dialect adapter."""

from __future__ import annotations

from urllib.parse import urlparse

from erbeauti.db.base import DatabaseDialect
from erbeauti.db.mysql import MySQLDialect
from erbeauti.db.oracle import OracleDialect
from erbeauti.db.postgres import PostgresDialect
from erbeauti.db.sqlite import SQLiteDialect
from erbeauti.db.sqlserver import SQLServerDialect
from erbeauti.exceptions import UnsupportedDialectError

_DIALECTS: dict[str, type[DatabaseDialect]] = {
    "postgresql": PostgresDialect,
    "postgres": PostgresDialect,
    "mysql": MySQLDialect,
    "mysql+pymysql": MySQLDialect,
    "mariadb": MySQLDialect,
    "mariadb+pymysql": MySQLDialect,
    "sqlite": SQLiteDialect,
    "sqlite+pysqlite": SQLiteDialect,
    "mssql": SQLServerDialect,
    "mssql+pyodbc": SQLServerDialect,
    "oracle": OracleDialect,
    "oracle+oracledb": OracleDialect,
}


def get_supported_dialects() -> list[str]:
    """Return the list of supported database dialect prefixes."""
    return sorted(set(_DIALECTS.keys()))


def dialect_for_url(url: str) -> DatabaseDialect:
    """Return a dialect adapter instance for the given connection URL."""
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()

    if scheme not in _DIALECTS:
        supported = ", ".join(get_supported_dialects())
        raise UnsupportedDialectError(
            f"Unsupported database dialect '{scheme}'. Supported: {supported}"
        )

    dialect_class = _DIALECTS[scheme]
    return dialect_class(url)
