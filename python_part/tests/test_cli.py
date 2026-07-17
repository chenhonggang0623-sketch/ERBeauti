"""Tests for the CLI."""

import json
import sqlite3
from pathlib import Path

from typer.testing import CliRunner

from erbeauti.cli import app

runner = CliRunner()


def test_cli_extract_sqlite(tmp_path: Path) -> None:
    db_path = tmp_path / "cli_test.db"
    url = f"sqlite:///{db_path}"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);")
    conn.close()

    result = runner.invoke(app, ["extract", url, "--compact"])
    assert result.exit_code == 0
    data = json.loads(result.output)
    assert data["name"]
    assert any(t["name"] == "users" for t in data["tables"])


def test_cli_extract_to_file(tmp_path: Path) -> None:
    db_path = tmp_path / "cli_file_test.db"
    output = tmp_path / "schema.json"
    url = f"sqlite:///{db_path}"
    conn = sqlite3.connect(str(db_path))
    conn.executescript("CREATE TABLE users (id INTEGER PRIMARY KEY);")
    conn.close()

    result = runner.invoke(app, ["extract", url, "-o", str(output), "--compact"])
    assert result.exit_code == 0
    data = json.loads(output.read_text())
    assert data["tables"][0]["name"] == "users"


def test_cli_dialects() -> None:
    result = runner.invoke(app, ["dialects"])
    assert result.exit_code == 0
    assert "sqlite" in result.output
