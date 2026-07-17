"""SQLite reverse-engineering adapter."""

from __future__ import annotations

import sqlite3
from urllib.parse import urlparse

from erbeauti.db.base import DatabaseDialect, RawColumn, RawForeignKey, RawSchema
from erbeauti.db.url_builder import validate_sqlite_path, _resolve_sqlite_path


class SQLiteDialect(DatabaseDialect):
    """Extract schema metadata from SQLite."""

    name = "sqlite"
    driver = "sqlite3"

    def __init__(self, connection_url: str) -> None:
        super().__init__(connection_url)
        self._db_path = self._parse_path(connection_url)

    @staticmethod
    def _parse_path(url: str) -> str:
        """Convert a SQLAlchemy-style sqlite URL to a filesystem path."""
        parsed = urlparse(url)
        if parsed.scheme not in ("sqlite", "sqlite+pysqlite"):
            raise ValueError(f"Invalid SQLite URL: {url}")
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

    def test_connection(self, url: str, timeout: int) -> str:
        path = self._parse_path(url)
        validate_sqlite_path(path)
        if path == ":memory:":
            return f"SQLite {sqlite3.sqlite_version}"
        conn = sqlite3.connect(path, timeout=timeout)
        try:
            version = conn.execute("SELECT sqlite_version()").fetchone()[0]
            return f"SQLite {version}"
        finally:
            conn.close()

    def list_tables(self) -> list[tuple[str, int]]:
        conn = sqlite3.connect(self._db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            tables = []
            for row in cursor.fetchall():
                table_name = row[0]
                cursor.execute(f'PRAGMA table_info("{table_name}")')
                column_count = len(cursor.fetchall())
                tables.append((table_name, column_count))
            return tables
        finally:
            conn.close()

    def extract(self) -> RawSchema:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        raw = RawSchema()

        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = cursor.fetchall()

            for table_row in tables:
                table_name = table_row["name"]
                table_sql = table_row["sql"] or ""

                # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
                cursor.execute(f'PRAGMA table_info("{table_name}")')
                column_rows = cursor.fetchall()

                pk_columns = {r["name"] for r in column_rows if r["pk"]}

                for col in column_rows:
                    col_name = col["name"]
                    raw.tables.setdefault(table_name, []).append(
                        RawColumn(
                            name=col_name,
                            data_type=col["type"],
                            nullable=not col["notnull"],
                            default_value=col["dflt_value"],
                            comment=None,
                            is_primary_key=col_name in pk_columns,
                            is_foreign_key=False,  # filled below
                            is_unique=False,
                            is_auto_increment="AUTOINCREMENT" in table_sql.upper(),
                        )
                    )

                # Foreign keys
                cursor.execute(f'PRAGMA foreign_key_list("{table_name}")')
                for fk in cursor.fetchall():
                    from_col = fk["from"]
                    to_table = fk["table"]
                    to_col = fk["to"]
                    for col in raw.tables[table_name]:
                        if col.name == from_col:
                            col.is_foreign_key = True
                    raw.foreign_keys.append(
                        RawForeignKey(
                            constraint_name=f"fk_{table_name}_{from_col}",
                            table_name=table_name,
                            column_name=from_col,
                            referenced_table=to_table,
                            referenced_column=to_col,
                        )
                    )

                # Unique indexes
                cursor.execute(f'PRAGMA index_list("{table_name}")')
                for idx in cursor.fetchall():
                    if idx["unique"]:
                        idx_name = idx["name"]
                        cursor.execute(f'PRAGMA index_info("{idx_name}")')
                        for info in cursor.fetchall():
                            col_name = info["name"]
                            for col in raw.tables[table_name]:
                                if col.name == col_name and not col.is_primary_key:
                                    col.is_unique = True
        finally:
            conn.close()

        return raw
