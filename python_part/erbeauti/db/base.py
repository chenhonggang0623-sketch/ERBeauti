"""Abstract base class for database dialect adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawColumn:
    """Raw column metadata extracted from a database."""

    name: str
    data_type: str
    nullable: bool
    default_value: str | None = None
    comment: str | None = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_unique: bool = False
    is_auto_increment: bool = False


@dataclass
class RawForeignKey:
    """Raw foreign key constraint metadata."""

    constraint_name: str
    table_name: str
    column_name: str
    referenced_table: str
    referenced_column: str


@dataclass
class RawSchema:
    """Raw schema extracted from a database before normalization."""

    tables: dict[str, list[RawColumn]] = field(default_factory=dict)
    foreign_keys: list[RawForeignKey] = field(default_factory=list)
    enums: list[dict[str, Any]] = field(default_factory=list)


class DatabaseDialect(ABC):
    """Base class for reverse-engineering a database dialect."""

    name: str = ""
    default_port: int | None = None
    driver: str = ""

    def __init__(self, connection_url: str) -> None:
        self.connection_url = connection_url

    @abstractmethod
    def extract(self) -> RawSchema:
        """Connect to the database and extract raw schema metadata."""

    @abstractmethod
    def list_tables(self) -> list[tuple[str, int]]:
        """Return a list of table names with their column counts.

        Implementations should connect to the database, query the data
        dictionary, and return a sorted list of (table_name, column_count).
        The returned list should not include internal/system tables.
        """

    @abstractmethod
    def test_connection(self, url: str, timeout: int) -> str:
        """Connect to the database, verify reachability and return a version string.

        Implementations must not read schema metadata. They should create a
        short-lived engine, connect, retrieve the server version and dispose of
        the engine before returning.

        Args:
            url: SQLAlchemy connection URL.
            timeout: Maximum time in seconds to wait for a connection.

        Returns:
            A human-readable server version string.

        Raises:
            ErbeautiError: On validation, authentication or connectivity issues.
        """

    def normalize_type(self, raw_type: str) -> str:
        """Normalize a database-specific type name for frontend display."""
        return raw_type.upper()
