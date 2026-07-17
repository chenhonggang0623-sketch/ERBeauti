"""Tests for system database and crypto modules."""

import pytest

from erbeauti import crypto
from erbeauti.system_db import (
    create_datasource,
    delete_datasource,
    get_datasource,
    init_db,
    list_datasources,
    update_datasource,
)


class TestCrypto:
    def test_encrypt_decrypt_roundtrip(self):
        plain = "my_secret_password_123!@#"
        encrypted = crypto.encrypt_password(plain)
        assert encrypted != plain
        assert crypto.decrypt_password(encrypted) == plain

    def test_empty_string_returns_empty(self):
        assert crypto.encrypt_password("") == ""
        assert crypto.decrypt_password("") == ""

    def test_fernet_is_singleton(self):
        assert crypto.get_fernet() is crypto.get_fernet()

    def test_different_inputs_produce_different_ciphertexts(self):
        c1 = crypto.encrypt_password("hello")
        c2 = crypto.encrypt_password("hello")
        assert c1 != c2

    def test_long_password(self):
        plain = "a" * 1000
        assert crypto.decrypt_password(crypto.encrypt_password(plain)) == plain


class TestSystemDB:
    @pytest.fixture(autouse=True)
    def clean_db(self):
        init_db()
        yield
        from erbeauti.system_db import get_db
        conn = get_db()
        conn.execute("DELETE FROM datasources")
        conn.commit()

    def test_create_and_list(self):
        d = create_datasource({
            "name": "测试库", "dialect": "mysql",
            "host": "10.0.0.1", "port": 3306,
            "database": "mydb", "username": "root",
            "password": "secret123",
        })
        assert d["name"] == "测试库"
        assert d["password_encrypted"] == "__ENCRYPTED__"
        all_ds = list_datasources()
        assert len(all_ds) == 1
        assert all_ds[0]["password_encrypted"] == "__ENCRYPTED__"

    def test_get_with_decrypt(self):
        d = create_datasource({"name": "pwtest", "dialect": "postgresql", "password": "open-sesame"})
        masked = get_datasource(d["id"], decrypt_pw=False)
        assert masked["password_encrypted"] == "__ENCRYPTED__"
        decrypted = get_datasource(d["id"], decrypt_pw=True)
        assert decrypted["password_encrypted"] == "open-sesame"

    def test_get_nonexistent(self):
        assert get_datasource("nonexistent-id") is None

    def test_update_name(self):
        d = create_datasource({"name": "old-name", "dialect": "mysql"})
        update_datasource(d["id"], {"name": "new-name"})
        updated = get_datasource(d["id"])
        assert updated["name"] == "new-name"

    def test_update_password(self):
        d = create_datasource({"name": "pw-update", "dialect": "mysql", "password": "old-pass"})
        update_datasource(d["id"], {"password": "new-pass"})
        updated = get_datasource(d["id"], decrypt_pw=True)
        assert updated["password_encrypted"] == "new-pass"

    def test_update_password_unchanged_when_omitted(self):
        d = create_datasource({"name": "pw-keep", "dialect": "mysql", "password": "keep-me"})
        update_datasource(d["id"], {"name": "new-name"})
        updated = get_datasource(d["id"], decrypt_pw=True)
        assert updated["password_encrypted"] == "keep-me"
        assert updated["name"] == "new-name"

    def test_update_password_cleared_when_empty(self):
        d = create_datasource({"name": "pw-clear", "dialect": "mysql", "password": "clear-me"})
        update_datasource(d["id"], {"password": ""})
        updated = get_datasource(d["id"])
        assert updated["password_encrypted"] == ""

    def test_delete(self):
        d = create_datasource({"name": "to-delete", "dialect": "mysql"})
        assert delete_datasource(d["id"]) is True
        assert get_datasource(d["id"]) is None

    def test_delete_nonexistent(self):
        assert delete_datasource("nonexistent") is False

    def test_list_order(self):
        d1 = create_datasource({"name": "first", "dialect": "mysql"})  # noqa: F841
        d2 = create_datasource({"name": "second", "dialect": "postgresql"})  # noqa: F841
        all_ds = list_datasources()
        assert all_ds[0]["name"] == "second"
        assert all_ds[1]["name"] == "first"
