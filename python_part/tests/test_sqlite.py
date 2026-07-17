"""Tests for SQLite reverse engineering."""

import sqlite3
from pathlib import Path

from erbeauti.db.sqlite import SQLiteDialect
from erbeauti.extract import extract_schema, infer_relationships


def _setup_db(url: str) -> None:
    """Create a small schema in a SQLite database."""
    conn = sqlite3.connect(url.replace("sqlite:///", ""))
    conn.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT
        );

        CREATE TABLE posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE tags (
            id INTEGER PRIMARY KEY,
            name TEXT DEFAULT 'general'
        );
        """
    )
    conn.close()


def test_sqlite_dialect_extracts_tables_and_columns(tmp_path: Path) -> None:
    db_path = tmp_path / "test.db"
    url = f"sqlite:///{db_path}"
    _setup_db(url)

    dialect = SQLiteDialect(url)
    raw = dialect.extract()

    assert "users" in raw.tables
    assert "posts" in raw.tables

    users_cols = {c.name: c for c in raw.tables["users"]}
    assert users_cols["id"].is_primary_key
    assert users_cols["id"].is_auto_increment
    assert users_cols["username"].is_unique
    assert users_cols["username"].nullable is False


def test_sqlite_extracts_foreign_keys(tmp_path: Path) -> None:
    db_path = tmp_path / "test.db"
    url = f"sqlite:///{db_path}"
    _setup_db(url)

    schema = extract_schema(url, "blog")

    posts = next(t for t in schema.tables if t.name == "posts")
    user_id_field = next(f for f in posts.fields if f.name == "user_id")
    assert user_id_field.isForeignKey

    assert len(schema.relationships) == 1
    rel = schema.relationships[0]
    assert rel.sourceTableId == posts.id
    assert rel.sourceFieldId == user_id_field.id


def test_infer_relationships_adds_missing_fk(tmp_path: Path) -> None:
    """When no physical FK exists, naming convention should infer it."""
    db_path = tmp_path / "infer_test.db"
    url = f"sqlite:///{db_path}"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE articles (id INTEGER PRIMARY KEY, user_id INTEGER);
        """
    )
    conn.close()

    schema = extract_schema(url, "memory")
    assert len(schema.relationships) == 0

    schema = infer_relationships(schema)
    assert len(schema.relationships) == 1
    assert schema.relationships[0].type == "N:1"
