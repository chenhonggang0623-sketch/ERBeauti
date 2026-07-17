"""Mock-based tests for PostgreSQL reverse engineering."""

from unittest.mock import MagicMock, patch

from erbeauti.db.postgres import PostgresDialect


def test_postgres_dialect_extracts_schema() -> None:
    url = "postgresql://user:pass@localhost/db"
    dialect = PostgresDialect(url)

    # Mock connection and engine
    mock_conn = MagicMock()
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.side_effect = [
        # columns
        [
            {
                "table_name": "users",
                "column_name": "id",
                "data_type": "integer",
                "is_nullable": "NO",
                "column_default": "nextval('users_id_seq')",
                "column_comment": "Primary key",
                "table_comment": None,
            },
            {
                "table_name": "users",
                "column_name": "email",
                "data_type": "character varying",
                "is_nullable": "YES",
                "column_default": None,
                "column_comment": None,
                "table_comment": None,
            },
            {
                "table_name": "orders",
                "column_name": "id",
                "data_type": "integer",
                "is_nullable": "NO",
                "column_default": None,
                "column_comment": None,
                "table_comment": None,
            },
            {
                "table_name": "orders",
                "column_name": "user_id",
                "data_type": "integer",
                "is_nullable": "NO",
                "column_default": None,
                "column_comment": None,
                "table_comment": None,
            },
        ],
        # primary keys
        [
            {"table_name": "users", "column_name": "id"},
            {"table_name": "orders", "column_name": "id"},
        ],
        # unique constraints
        [{"table_name": "users", "column_name": "email"}],
        # foreign keys
        [
            {
                "constraint_name": "fk_orders_user_id",
                "table_name": "orders",
                "column_name": "user_id",
                "referenced_table": "users",
                "referenced_column": "id",
            }
        ],
        # enums (empty)
        [],
    ]
    mock_conn.execute.return_value = mock_result
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    with patch("erbeauti.db.postgres.create_engine", return_value=mock_engine):
        raw = dialect.extract()

    assert "users" in raw.tables
    assert "orders" in raw.tables

    users_cols = {c.name: c for c in raw.tables["users"]}
    assert users_cols["id"].is_primary_key
    assert users_cols["id"].is_auto_increment
    assert users_cols["email"].is_unique

    orders_cols = {c.name: c for c in raw.tables["orders"]}
    assert orders_cols["user_id"].is_foreign_key
    assert len(raw.foreign_keys) == 1
    assert raw.foreign_keys[0].referenced_table == "users"
