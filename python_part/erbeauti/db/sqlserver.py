"""Microsoft SQL Server reverse-engineering adapter."""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from erbeauti.db.base import DatabaseDialect, RawColumn, RawForeignKey, RawSchema


class SQLServerDialect(DatabaseDialect):
    """Extract schema metadata from SQL Server."""

    name = "mssql"
    default_port = 1433
    driver = "pyodbc"

    def __init__(self, connection_url: str) -> None:
        super().__init__(connection_url)
        self._engine: Engine | None = None

    def _get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(self.connection_url, connect_args={"timeout": 10})
        return self._engine

    def test_connection(self, url: str, timeout: int) -> str:
        engine = create_engine(url, connect_args={"timeout": timeout})
        try:
            with engine.connect() as conn:
                version = conn.execute(text("SELECT @@VERSION")).scalar()
                return str(version).split("\n")[0] if version else ""
        finally:
            engine.dispose()

    def list_tables(self) -> list[tuple[str, int]]:
        engine = self._get_engine()
        with engine.connect() as conn:
            sql = text("""
                SELECT t.name AS table_name, COUNT(c.name) AS column_count
                FROM sys.tables t
                LEFT JOIN sys.columns c ON c.object_id = t.object_id
                WHERE t.is_ms_shipped = 0
                GROUP BY t.name
                ORDER BY t.name
            """)
            rows = conn.execute(sql).mappings().all()
            return [(r["table_name"], int(r["column_count"])) for r in rows]

    def extract(self) -> RawSchema:
        engine = self._get_engine()
        raw = RawSchema()

        with engine.connect() as conn:
            column_sql = text("""
                SELECT
                    t.name AS table_name,
                    c.name AS column_name,
                    ty.name AS data_type,
                    c.is_nullable,
                    dc.definition AS column_default,
                    ep.value AS column_comment
                FROM sys.tables t
                JOIN sys.columns c ON c.object_id = t.object_id
                JOIN sys.types ty ON ty.user_type_id = c.user_type_id
                LEFT JOIN sys.default_constraints dc
                  ON dc.parent_object_id = t.object_id
                 AND dc.parent_column_id = c.column_id
                LEFT JOIN sys.extended_properties ep
                  ON ep.major_id = t.object_id
                 AND ep.minor_id = c.column_id
                 AND ep.name = 'MS_Description'
                WHERE t.is_ms_shipped = 0
                ORDER BY t.name, c.column_id
            """)
            columns = conn.execute(column_sql).mappings().all()

            pk_sql = text("""
                SELECT t.name AS table_name, c.name AS column_name
                FROM sys.tables t
                JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
                JOIN sys.index_columns ic
                  ON ic.object_id = t.object_id AND ic.index_id = i.index_id
                JOIN sys.columns c
                  ON c.object_id = t.object_id AND c.column_id = ic.column_id
            """)
            pk_rows = conn.execute(pk_sql).mappings().all()
            pks = {(r["table_name"], r["column_name"]) for r in pk_rows}

            unique_sql = text("""
                SELECT t.name AS table_name, c.name AS column_name
                FROM sys.tables t
                JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_unique = 1 AND i.is_primary_key = 0
                JOIN sys.index_columns ic
                  ON ic.object_id = t.object_id AND ic.index_id = i.index_id
                JOIN sys.columns c
                  ON c.object_id = t.object_id AND c.column_id = ic.column_id
            """)
            unique_rows = conn.execute(unique_sql).mappings().all()
            uniques = {(r["table_name"], r["column_name"]) for r in unique_rows}

            identity_sql = text("""
                SELECT t.name AS table_name, c.name AS column_name
                FROM sys.tables t
                JOIN sys.columns c ON c.object_id = t.object_id
                WHERE c.is_identity = 1
            """)
            identity_rows = conn.execute(identity_sql).mappings().all()
            identities = {(r["table_name"], r["column_name"]) for r in identity_rows}

            fk_sql = text("""
                SELECT
                    fk.name AS constraint_name,
                    OBJECT_NAME(fk.parent_object_id) AS table_name,
                    c1.name AS column_name,
                    OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
                    c2.name AS referenced_column
                FROM sys.foreign_keys fk
                JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
                JOIN sys.columns c1
                  ON c1.object_id = fk.parent_object_id
                 AND c1.column_id = fkc.parent_column_id
                JOIN sys.columns c2
                  ON c2.object_id = fk.referenced_object_id
                 AND c2.column_id = fkc.referenced_column_id
            """)
            fk_rows = conn.execute(fk_sql).mappings().all()
            fks: set[tuple[str, str]] = set()
            for row in fk_rows:
                fks.add((row["table_name"], row["column_name"]))
                raw.foreign_keys.append(
                    RawForeignKey(
                        constraint_name=row["constraint_name"],
                        table_name=row["table_name"],
                        column_name=row["column_name"],
                        referenced_table=row["referenced_table"],
                        referenced_column=row["referenced_column"],
                    )
                )

            for row in columns:
                table = row["table_name"]
                column = row["column_name"]
                default = row["column_default"]
                if isinstance(default, str):
                    default = default.strip("()")
                raw.tables.setdefault(table, []).append(
                    RawColumn(
                        name=column,
                        data_type=row["data_type"],
                        nullable=row["is_nullable"],
                        default_value=default,
                        comment=row["column_comment"],
                        is_primary_key=(table, column) in pks,
                        is_foreign_key=(table, column) in fks,
                        is_unique=(table, column) in uniques,
                        is_auto_increment=(table, column) in identities,
                    )
                )

        return raw
