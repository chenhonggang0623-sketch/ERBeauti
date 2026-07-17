"""Tests for the FastAPI service."""

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from erbeauti.api import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dialects(client: TestClient) -> None:
    response = client.get("/dialects")
    data = response.json()
    assert data["success"] is True
    assert "sqlite" in data["supported_dialects"]
    assert "postgresql" in data["supported_dialects"]


def test_reverse_engineer_sqlite(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "api_test.db"
    url = f"sqlite:///{db_path}"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products(id));
        """
    )
    conn.close()

    response = client.post(
        "/reverse-engineer",
        json={"connection_url": url, "schema_name": "shop", "infer_relationships": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    schema = data["schema"]
    assert schema["name"] == "shop"
    assert any(t["name"] == "products" for t in schema["tables"])
    assert any(t["name"] == "orders" for t in schema["tables"])


def test_reverse_engineer_with_connection_fields(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "fields_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);")
    conn.close()

    response = client.post(
        "/reverse-engineer",
        json={
            "connection_fields": {
                "dialect": "sqlite",
                "database": str(db_path),
            },
            "schema_name": "fields_shop",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    schema = data["schema"]
    assert schema["name"] == "fields_shop"
    assert any(t["name"] == "users" for t in schema["tables"])


def test_reverse_engineer_mutual_exclusion(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "mutex.db"
    response = client.post(
        "/reverse-engineer",
        json={
            "connection_url": f"sqlite:///{db_path}",
            "connection_fields": {"dialect": "sqlite", "database": str(db_path)},
        },
    )
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"


def test_reverse_engineer_missing_connection(client: TestClient) -> None:
    response = client.post("/reverse-engineer", json={})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"


def test_reverse_engineer_invalid_dialect(client: TestClient) -> None:
    response = client.post(
        "/reverse-engineer",
        json={"connection_url": "mongodb://example.com/db"},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "UNSUPPORTED_DIALECT"


def test_reverse_engineer_ssrf_localhost(client: TestClient) -> None:
    response = client.post(
        "/reverse-engineer",
        json={"connection_url": "postgresql://user:pass@localhost/db"},
    )
    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "UPSTREAM_CONNECTION_ERROR"
    assert "pass" not in response.text


def test_test_connection_sqlite(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "conn_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("CREATE TABLE t (id INTEGER PRIMARY KEY);")
    conn.close()

    response = client.post(
        "/test-connection",
        json={"connection_fields": {"dialect": "sqlite", "database": str(db_path)}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["dialect"] == "sqlite"
    assert "SQLite" in (data["server_version"] or "")
    assert data["elapsed_ms"] >= 0


def test_test_connection_mutual_exclusion(client: TestClient) -> None:
    response = client.post(
        "/test-connection",
        json={
            "connection_url": "sqlite:///a.db",
            "connection_fields": {"dialect": "sqlite", "database": "b.db"},
        },
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_test_connection_ssrf_metadata_ip(client: TestClient) -> None:
    response = client.post(
        "/test-connection",
        json={"connection_url": "postgresql://user:pass@169.254.169.254/db"},
    )
    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "UPSTREAM_CONNECTION_ERROR"
    assert "pass" not in response.text


def test_test_connection_sqlite_system_path(client: TestClient) -> None:
    response = client.post(
        "/test-connection",
        json={"connection_fields": {"dialect": "sqlite", "database": "/etc/passwd"}},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"


def test_list_tables_sqlite(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "list_tables.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER);
        CREATE TABLE comments (id INTEGER PRIMARY KEY, body TEXT, post_id INTEGER);
        """
    )
    conn.close()

    response = client.post(
        "/tables",
        json={"connection_url": f"sqlite:///{db_path}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    table_names = {t["name"] for t in data["tables"]}
    assert table_names == {"users", "posts", "comments"}
    for table in data["tables"]:
        assert table["column_count"] >= 2


def test_reverse_engineer_table_names_filter(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "filter_test.db"
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER REFERENCES users(id));
        CREATE TABLE comments (id INTEGER PRIMARY KEY, body TEXT, post_id INTEGER REFERENCES posts(id));
        """
    )
    conn.close()

    response = client.post(
        "/reverse-engineer",
        json={
            "connection_url": f"sqlite:///{db_path}",
            "table_names": ["users", "posts"],
            "infer_relationships": False,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    schema = data["schema"]
    table_ids = {t["id"] for t in schema["tables"]}
    assert {t["name"] for t in schema["tables"]} == {"users", "posts"}
    for rel in schema["relationships"]:
        assert rel["sourceTableId"] in table_ids
        assert rel["targetTableId"] in table_ids


def test_list_tables_empty_database(client: TestClient, tmp_path: Path) -> None:
    db_path = tmp_path / "empty.db"
    conn = sqlite3.connect(str(db_path))
    conn.close()

    response = client.post(
        "/tables",
        json={"connection_url": f"sqlite:///{db_path}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["tables"] == []
