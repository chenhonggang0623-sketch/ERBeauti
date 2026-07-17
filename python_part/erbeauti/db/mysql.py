"""MySQL / MariaDB reverse-engineering adapter."""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from erbeauti.db.base import DatabaseDialect, RawColumn, RawForeignKey, RawSchema


class MySQLDialect(DatabaseDialect):
    """Extract schema metadata from MySQL/MariaDB."""

    name = "mysql"
    default_port = 3306
    driver = "pymysql"

    def __init__(self, connection_url: str) -> None:
        super().__init__(connection_url)
        self._engine: Engine | None = None

    def _get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(
                self.connection_url,
                connect_args={"connect_timeout": 10, "read_timeout": 30, "write_timeout": 30},
            )
        return self._engine

    def test_connection(self, url: str, timeout: int) -> str:
        engine = create_engine(
            url,
            connect_args={
                "connect_timeout": timeout,
                "read_timeout": timeout + 20,
                "write_timeout": timeout + 20,
            },
        )
        try:
            with engine.connect() as conn:
                version = conn.execute(text("SELECT VERSION()")).scalar()
                return f"MySQL {version}" if version else ""
        finally:
            engine.dispose()

    def list_tables(self) -> list[tuple[str, int]]:
        engine = self._get_engine()
        with engine.connect() as conn:
            database = conn.execute(text("SELECT DATABASE()")).scalar()
            sql = text("""
                SELECT t.table_name, COUNT(c.column_name) AS column_count
                FROM information_schema.tables t
                LEFT JOIN information_schema.columns c
                  ON c.table_schema = t.table_schema
                 AND c.table_name = t.table_name
                WHERE t.table_schema = :db
                  AND t.table_type = 'BASE TABLE'
                GROUP BY t.table_schema, t.table_name
                ORDER BY t.table_name
            """)
            rows = conn.execute(sql, {"db": database}).all()
            return [(row[0], int(row[1])) for row in rows]

    def extract(self) -> RawSchema:
        engine = self._get_engine()
        raw = RawSchema()

        with engine.connect() as conn:
            database = conn.execute(text("SELECT DATABASE()")).scalar()

            column_sql = text("""
                SELECT
                    c.table_name,
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    c.extra,
                    c.column_comment
                FROM information_schema.columns c
                WHERE c.table_schema = :db
                ORDER BY c.table_name, c.ordinal_position
            """)
            columns = conn.execute(column_sql, {"db": database}).all()

            pk_sql = text("""
                SELECT k.table_name, k.column_name
                FROM information_schema.key_column_usage k
                JOIN information_schema.table_constraints t
                  ON k.constraint_name = t.constraint_name
                 AND k.table_schema = t.table_schema
                WHERE t.constraint_type = 'PRIMARY KEY'
                  AND k.table_schema = :db
            """)
            pk_rows = conn.execute(pk_sql, {"db": database}).all()
            pks = {(row[0], row[1]) for row in pk_rows}

            unique_sql = text("""
                SELECT k.table_name, k.column_name
                FROM information_schema.key_column_usage k
                JOIN information_schema.table_constraints t
                  ON k.constraint_name = t.constraint_name
                 AND k.table_schema = t.table_schema
                WHERE t.constraint_type = 'UNIQUE'
                  AND k.table_schema = :db
            """)
            unique_rows = conn.execute(unique_sql, {"db": database}).all()
            uniques = {(row[0], row[1]) for row in unique_rows}

            fk_sql = text("""
                SELECT
                    k.constraint_name,
                    k.table_name,
                    k.column_name,
                    k.referenced_table_name AS referenced_table,
                    k.referenced_column_name AS referenced_column
                FROM information_schema.key_column_usage k
                JOIN information_schema.table_constraints t
                  ON k.constraint_name = t.constraint_name
                 AND k.table_schema = t.table_schema
                WHERE t.constraint_type = 'FOREIGN KEY'
                  AND k.table_schema = :db
            """)
            fk_rows = conn.execute(fk_sql, {"db": database}).all()
            fks: set[tuple[str, str]] = set()
            for row in fk_rows:
                fks.add((row[1], row[2]))
                raw.foreign_keys.append(
                    RawForeignKey(
                        constraint_name=row[0],
                        table_name=row[1],
                        column_name=row[2],
                        referenced_table=row[3],
                        referenced_column=row[4],
                    )
                )

            for row in columns:
                table = row[0]
                column = row[1]
                extra = (row[5] or "").lower()
                raw.tables.setdefault(table, []).append(
                    RawColumn(
                        name=column,
                        data_type=row[2],
                        nullable=row[3] == "YES",
                        default_value=row[4],
                        comment=row[6] or None,
                        is_primary_key=(table, column) in pks,
                        is_foreign_key=(table, column) in fks,
                        is_unique=(table, column) in uniques,
                        is_auto_increment="auto_increment" in extra,
                    )
                )

        return raw
