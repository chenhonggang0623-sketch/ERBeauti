"""PostgreSQL reverse-engineering adapter."""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from erbeauti.db.base import DatabaseDialect, RawColumn, RawForeignKey, RawSchema


class PostgresDialect(DatabaseDialect):
    """Extract schema metadata from PostgreSQL."""

    name = "postgresql"
    default_port = 5432
    driver = "psycopg2"

    def __init__(self, connection_url: str) -> None:
        super().__init__(connection_url)
        self._engine: Engine | None = None

    def _get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(self.connection_url, connect_args={"connect_timeout": 10})
        return self._engine

    def test_connection(self, url: str, timeout: int) -> str:
        engine = create_engine(url, connect_args={"connect_timeout": timeout})
        try:
            with engine.connect() as conn:
                version = conn.execute(text("SELECT version()")).scalar()
                return str(version) if version else ""
        finally:
            engine.dispose()

    def list_tables(self) -> list[tuple[str, int]]:
        engine = self._get_engine()
        with engine.connect() as conn:
            sql = text("""
                SELECT t.table_name, COUNT(c.column_name) AS column_count
                FROM information_schema.tables t
                LEFT JOIN information_schema.columns c
                  ON c.table_schema = t.table_schema
                 AND c.table_name = t.table_name
                WHERE t.table_schema = current_schema()
                  AND t.table_type = 'BASE TABLE'
                GROUP BY t.table_schema, t.table_name
                ORDER BY t.table_name
            """)
            rows = conn.execute(sql).mappings().all()
            return [(r["table_name"], int(r["column_count"])) for r in rows]

    def extract(self) -> RawSchema:
        engine = self._get_engine()
        raw = RawSchema()

        with engine.connect() as conn:
            # Tables and columns with comments
            column_sql = text("""
                SELECT
                    c.table_name,
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    pg_catalog.col_description(pgc.oid, c.ordinal_position) AS column_comment,
                    obj_description(pgc.oid, 'pg_class') AS table_comment
                FROM information_schema.columns c
                JOIN pg_catalog.pg_class pgc
                  ON pgc.relname = c.table_name
                JOIN pg_catalog.pg_namespace pgn
                  ON pgn.oid = pgc.relnamespace
                 AND pgn.nspname = c.table_schema
                WHERE c.table_schema = current_schema()
                ORDER BY c.table_name, c.ordinal_position
            """)
            columns = conn.execute(column_sql).mappings().all()

            # Primary keys
            pk_sql = text("""
                SELECT tc.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = current_schema()
            """)
            pk_rows = conn.execute(pk_sql).mappings().all()
            pks = {(r["table_name"], r["column_name"]) for r in pk_rows}

            # Unique constraints (excluding PK)
            unique_sql = text("""
                SELECT tc.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'UNIQUE'
                  AND tc.table_schema = current_schema()
            """)
            unique_rows = conn.execute(unique_sql).mappings().all()
            uniques = {(r["table_name"], r["column_name"]) for r in unique_rows}

            # Foreign keys
            fk_sql = text("""
                SELECT
                    tc.constraint_name,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                 AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = current_schema()
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

            # Enums
            enum_sql = text("""
                SELECT t.typname AS name, e.enumlabel AS value
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = current_schema()
                ORDER BY t.typname, e.enumsortorder
            """)
            enum_rows = conn.execute(enum_sql).mappings().all()
            enum_map: dict[str, list[str]] = {}
            for row in enum_rows:
                enum_map.setdefault(row["name"], []).append(row["value"])
            raw.enums = [{"name": k, "values": v} for k, v in enum_map.items()]

            for row in columns:
                table = row["table_name"]
                column = row["column_name"]
                raw.tables.setdefault(table, []).append(
                    RawColumn(
                        name=column,
                        data_type=row["data_type"],
                        nullable=row["is_nullable"] == "YES",
                        default_value=row["column_default"],
                        comment=row["column_comment"] or None,
                        is_primary_key=(table, column) in pks,
                        is_foreign_key=(table, column) in fks,
                        is_unique=(table, column) in uniques,
                        is_auto_increment=(row["column_default"] or "").startswith("nextval"),
                    )
                )

        return raw
