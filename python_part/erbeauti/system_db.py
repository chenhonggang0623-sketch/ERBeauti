"""System database for persisted application state (data sources, etc)."""

from __future__ import annotations

import sqlite3
import threading
import uuid
from pathlib import Path
from time import time_ns

from erbeauti.config import settings
from erbeauti.crypto import decrypt_password, encrypt_password
from erbeauti.exceptions import ValidationError

_local = threading.local()

_DB_FILENAME = "system.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS datasources (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    dialect             TEXT NOT NULL,
    input_mode          TEXT NOT NULL,
    connection_url      TEXT,
    host                TEXT,
    port                INTEGER,
    username            TEXT,
    database            TEXT,
    schema_name         TEXT,
    options             TEXT,
    password_encrypted  TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_datasources_name ON datasources(name);

CREATE TABLE IF NOT EXISTS canva_tree (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    parent_id   TEXT,
    type        TEXT NOT NULL CHECK(type IN ('folder', 'canvas')),
    schema_data TEXT,
    position    INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canva_tree_parent ON canva_tree(parent_id);
"""


def _db_path() -> Path:
    base = Path(settings.data_dir) if settings.data_dir else Path.cwd() / ".." / "data"
    return base.resolve() / _DB_FILENAME


def get_db() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        path = _db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    conn = get_db()
    conn.executescript(SCHEMA_SQL)
    conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def _ts() -> int:
    return time_ns()


def list_datasources() -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM datasources ORDER BY created_at DESC"
    ).fetchall()
    results = []
    for row in rows:
        d = _row_to_dict(row)
        if d.get("password_encrypted"):
            d["password_encrypted"] = "__ENCRYPTED__"
        results.append(d)
    return results


def get_datasource(ds_id: str, decrypt_pw: bool = False) -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM datasources WHERE id = ?", (ds_id,)
    ).fetchone()
    if row is None:
        return None
    d = _row_to_dict(row)
    pw = d.get("password_encrypted") or ""
    if decrypt_pw and pw:
        d["password_encrypted"] = decrypt_password(pw)
    elif pw:
        d["password_encrypted"] = "__ENCRYPTED__"
    return d


def create_datasource(data: dict) -> dict:
    ds_id = data.get("id") or str(uuid.uuid4())
    now = _ts()
    password_encrypted = encrypt_password(data.get("password") or "")

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM datasources WHERE name = ?", (data["name"],)
    ).fetchone()
    if existing is not None:
        raise ValidationError(f'数据源名称 "{data["name"]}" 已存在')

    conn.execute(
        """INSERT INTO datasources
           (id, name, dialect, input_mode, connection_url,
            host, port, username, database, schema_name, options,
            password_encrypted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ds_id,
            data["name"],
            data["dialect"],
            data.get("input_mode", "fields"),
            data.get("connection_url"),
            data.get("host"),
            data.get("port"),
            data.get("username"),
            data.get("database"),
            data.get("schema_name"),
            data.get("options"),
            password_encrypted,
            now,
            now,
        ),
    )
    conn.commit()
    return get_datasource(ds_id)


def update_datasource(ds_id: str, data: dict) -> dict | None:
    existing = get_datasource(ds_id, decrypt_pw=False)
    if existing is None:
        return None

    if "name" in data and data["name"] != existing["name"]:
        conn = get_db()
        dup = conn.execute(
            "SELECT id FROM datasources WHERE name = ? AND id != ?",
            (data["name"], ds_id),
        ).fetchone()
        if dup is not None:
            raise ValidationError(f'数据源名称 "{data["name"]}" 已存在')

    now = _ts()
    fields = []
    values = []

    for key in ("name", "dialect", "input_mode", "connection_url",
                 "host", "port", "username", "database", "schema_name", "options"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if "password" in data:
        pw = data["password"]
        if pw:
            fields.append("password_encrypted = ?")
            values.append(encrypt_password(pw))
        else:
            fields.append("password_encrypted = ?")
            values.append("")

    if not fields:
        return get_datasource(ds_id)

    fields.append("updated_at = ?")
    values.append(now)
    values.append(ds_id)

    conn = get_db()
    conn.execute(
        f"UPDATE datasources SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    conn.commit()
    return get_datasource(ds_id)


def delete_datasource(ds_id: str) -> bool:
    conn = get_db()
    cur = conn.execute("DELETE FROM datasources WHERE id = ?", (ds_id,))
    conn.commit()
    return cur.rowcount > 0


# ---- canva_tree CRUD ----


def list_canva_tree() -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM canva_tree ORDER BY position ASC, created_at ASC"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_canva_node(node_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM canva_tree WHERE id = ?", (node_id,)).fetchone()
    return _row_to_dict(row) if row else None


def create_canva_node(data: dict) -> dict:
    node_id = data.get("id") or str(uuid.uuid4())
    now = _ts()
    conn = get_db()
    conn.execute(
        """INSERT INTO canva_tree
           (id, name, parent_id, type, schema_data, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            node_id,
            data["name"],
            data.get("parent_id"),
            data.get("type", "canvas"),
            data.get("schema_data"),
            data.get("position", 0),
            now,
            now,
        ),
    )
    conn.commit()
    return get_canva_node(node_id)


def update_canva_node(node_id: str, data: dict) -> dict | None:
    existing = get_canva_node(node_id)
    if existing is None:
        return None

    now = _ts()
    fields = []
    values = []

    for key in ("name", "parent_id", "schema_data", "position"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if not fields:
        return get_canva_node(node_id)

    fields.append("updated_at = ?")
    values.append(now)
    values.append(node_id)

    conn = get_db()
    conn.execute(
        f"UPDATE canva_tree SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    conn.commit()
    return get_canva_node(node_id)


def delete_canva_node(node_id: str) -> bool:
    conn = get_db()
    # Recursively delete children
    children = conn.execute(
        "SELECT id FROM canva_tree WHERE parent_id = ?", (node_id,)
    ).fetchall()
    for child in children:
        delete_canva_node(child["id"])
    cur = conn.execute("DELETE FROM canva_tree WHERE id = ?", (node_id,))
    conn.commit()
    return cur.rowcount > 0
