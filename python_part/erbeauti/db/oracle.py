"""Oracle reverse-engineering adapter."""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from erbeauti.db.base import DatabaseDialect, RawColumn, RawForeignKey, RawSchema


class OracleDialect(DatabaseDialect):
    """Extract schema metadata from Oracle."""

    name = "oracle"
    default_port = 1521
    driver = "oracledb"

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
                version = conn.execute(
                    text("SELECT banner FROM v$version WHERE ROWNUM = 1")
                ).scalar()
                return str(version) if version else ""
        finally:
            engine.dispose()

    def list_tables(self) -> list[tuple[str, int]]:
        engine = self._get_engine()
        with engine.connect() as conn:
            owner = self._current_user(conn)
            sql = text("""
                SELECT t.table_name, COUNT(c.column_name) AS column_count
                FROM all_tables t
                LEFT JOIN all_tab_columns c
                  ON c.table_name = t.table_name
                 AND c.owner = t.owner
                WHERE t.owner = :owner
                GROUP BY t.table_name
                ORDER BY t.table_name
            """)
            rows = conn.execute(sql, {"owner": owner}).mappings().all()
            return [(r["table_name"], int(r["column_count"])) for r in rows]

    def _current_user(self, conn: Connection) -> str:
        return str(conn.execute(text("SELECT USER FROM DUAL")).scalar()).upper()

    def extract(self) -> RawSchema:
        engine = self._get_engine()
        raw = RawSchema()

        with engine.connect() as conn:
            owner = self._current_user(conn)

            column_sql = text("""
                SELECT
                    t.table_name,
                    c.column_name,
                    c.data_type,
                    c.nullable,
                    c.data_default,
                    c.comments AS column_comment,
                    t.comments AS table_comment
                FROM all_tab_columns c
                JOIN all_tables tbl ON tbl.table_name = c.table_name AND tbl.owner = c.owner
                LEFT JOIN all_col_comments t
                  ON t.table_name = c.table_name
                 AND t.column_name = c.column_name
                 AND t.owner = c.owner
                WHERE c.owner = :owner
                ORDER BY c.table_name, c.column_id
            """)
            columns = conn.execute(column_sql, {"owner": owner}).mappings().all()

            pk_sql = text("""
                SELECT cc.table_name, cc.column_name
                FROM all_constraints c
                JOIN all_cons_columns cc
                  ON c.constraint_name = cc.constraint_name
                 AND c.owner = cc.owner
                WHERE c.constraint_type = 'P'
                  AND c.owner = :owner
            """)
            pk_rows = conn.execute(pk_sql, {"owner": owner}).mappings().all()
            pks = {(r["table_name"], r["column_name"]) for r in pk_rows}

            unique_sql = text("""
                SELECT cc.table_name, cc.column_name
                FROM all_constraints c
                JOIN all_cons_columns cc
                  ON c.constraint_name = cc.constraint_name
                 AND c.owner = cc.owner
                WHERE c.constraint_type = 'U'
                  AND c.owner = :owner
            """)
            unique_rows = conn.execute(unique_sql, {"owner": owner}).mappings().all()
            uniques = {(r["table_name"], r["column_name"]) for r in unique_rows}

            identity_sql = text("""
                SELECT table_name, column_name
                FROM all_tab_identity_cols
                WHERE owner = :owner
            """)
            identity_rows = conn.execute(identity_sql, {"owner": owner}).mappings().all()
            identities = {(r["table_name"], r["column_name"]) for r in identity_rows}

            fk_sql = text("""
                SELECT
                    c.constraint_name,
                    cc.table_name,
                    cc.column_name,
                    rcc.table_name AS referenced_table,
                    rcc.column_name AS referenced_column
                FROM all_constraints c
                JOIN all_cons_columns cc
                  ON c.constraint_name = cc.constraint_name
                 AND c.owner = cc.owner
                JOIN all_constraints rc
                  ON c.r_constraint_name = rc.constraint_name
                 AND c.r_owner = rc.owner
                JOIN all_cons_columns rcc
                  ON rc.constraint_name = rcc.constraint_name
                 AND rc.owner = rcc.owner
                 AND cc.position = rcc.position
                WHERE c.constraint_type = 'R'
                  AND c.owner = :owner
            """)
            fk_rows = conn.execute(fk_sql, {"owner": owner}).mappings().all()
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
                default = row["data_default"]
                if isinstance(default, str):
                    default = default.strip()
                raw.tables.setdefault(table, []).append(
                    RawColumn(
                        name=column,
                        data_type=row["data_type"],
                        nullable=row["nullable"] == "Y",
                        default_value=default,
                        comment=row["column_comment"],
                        is_primary_key=(table, column) in pks,
                        is_foreign_key=(table, column) in fks,
                        is_unique=(table, column) in uniques,
                        is_auto_increment=(table, column) in identities,
                    )
                )

        return raw
