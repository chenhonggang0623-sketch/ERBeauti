"""Application settings loaded from environment variables."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """ERBeauti runtime configuration.

    All fields can be overridden via environment variables with the prefix
    ``ERBEAUTI_`` (e.g. ``ERBEAUTI_API_PORT=8080``).
    """

    model_config = SettingsConfigDict(
        env_prefix="ERBEAUTI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cors_allow_origins: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_headers: list[str] = Field(default_factory=lambda: ["*"])

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    test_connection_timeout: int = 10
    reverse_engineer_timeout: int = 60

    allow_private_networks: bool = Field(
        default=True,
        description="When False, reject connections to localhost/private networks. Enable for local development only.",
    )

    sqlite_data_dir: str = Field(
        default="",
        description="Directory to resolve bare SQLite filenames against. If empty, bare filenames are "
        "resolved relative to the current working directory.",
    )

    secret_key: str = Field(
        default="",
        description="Optional 32-byte base64-encoded key for Fernet encryption. "
        "If empty, a key is auto-generated and persisted to data_dir/secret.key.",
    )

    data_dir: str = Field(
        default="",
        description="Directory for system data (databases, keys, etc). "
        "If empty, defaults to ../data relative to the app working directory.",
    )


settings = Settings()
