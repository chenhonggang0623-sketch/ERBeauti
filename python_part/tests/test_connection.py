"""Tests for dialect test_connection implementations."""

import sqlite3
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from erbeauti.db.mysql import MySQLDialect
from erbeauti.db.oracle import OracleDialect
from erbeauti.db.postgres import PostgresDialect
from erbeauti.db.sqlite import SQLiteDialect
from erbeauti.db.sqlserver import SQLServerDialect
from erbeauti.exceptions import ValidationError


def test_sqlite_test_connection(tmp_path: Path) -> None:
    db_path = tmp_path / "conn.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("CREATE TABLE t (id INTEGER PRIMARY KEY);")
    conn.close()

    dialect = SQLiteDialect(f"sqlite:///{db_path}")
    version = dialect.test_connection(f"sqlite:///{db_path}", timeout=5)
    assert "SQLite" in version


def test_sqlite_test_connection_blocks_system_path() -> None:
    dialect = SQLiteDialect("sqlite:////etc/passwd")
    with pytest.raises(ValidationError):
        dialect.test_connection("sqlite:////etc/passwd", timeout=5)


def test_postgres_test_connection() -> None:
    dialect = PostgresDialect("postgresql://user:pass@example.com/db")

    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = "PostgreSQL 15.2"
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    with patch("erbeauti.db.postgres.create_engine", return_value=mock_engine):
        version = dialect.test_connection("postgresql://user:pass@example.com/db", timeout=5)

    assert "PostgreSQL" in version
    mock_engine.dispose.assert_called_once()


def test_mysql_test_connection() -> None:
    dialect = MySQLDialect("mysql://user:pass@example.com/db")

    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = "8.0.33"
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    with patch("erbeauti.db.mysql.create_engine", return_value=mock_engine):
        version = dialect.test_connection("mysql://user:pass@example.com/db", timeout=5)

    assert "MySQL" in version
    mock_engine.dispose.assert_called_once()


def test_sqlserver_test_connection() -> None:
    dialect = SQLServerDialect("mssql+pyodbc://user:pass@example.com/db")

    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = "Microsoft SQL Server 2019"
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    with patch("erbeauti.db.sqlserver.create_engine", return_value=mock_engine):
        version = dialect.test_connection("mssql+pyodbc://user:pass@example.com/db", timeout=5)

    assert "Microsoft SQL Server" in version
    mock_engine.dispose.assert_called_once()


def test_oracle_test_connection() -> None:
    dialect = OracleDialect("oracle+oracledb://user:pass@example.com/db")

    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = "Oracle Database 19c"
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    with patch("erbeauti.db.oracle.create_engine", return_value=mock_engine):
        version = dialect.test_connection("oracle+oracledb://user:pass@example.com/db", timeout=5)

    assert "Oracle" in version
    mock_engine.dispose.assert_called_once()
