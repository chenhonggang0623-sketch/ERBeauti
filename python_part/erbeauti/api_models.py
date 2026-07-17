"""Pydantic request/response models for the ERBeauti REST API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from erbeauti.models import ERSchema


class ConnectionFields(BaseModel):
    """Structured connection parameters supplied by the client."""

    dialect: str = Field(
        ...,
        description="Database dialect prefix (e.g. postgresql, mysql, sqlite).",
        examples=["postgresql", "mysql", "sqlite"],
    )
    host: str | None = Field(
        default=None,
        description="Database server hostname or IP address.",
        examples=["localhost", "db.example.com"],
    )
    port: int | None = Field(
        default=None,
        description="Database server port (optional, defaults are provided).",
        examples=[5432, 3306],
    )
    database: str | None = Field(
        default=None,
        description="Database name or, for SQLite, the file path.",
        examples=["mydb", "app.db"],
    )
    username: str | None = Field(
        default=None,
        description="Username for authentication.",
    )
    password: str | None = Field(
        default=None,
        description="Password for authentication.",
    )
    options: str | None = Field(
        default=None,
        description="Additional dialect-specific connection options as a query string (e.g. 'sslmode=require&connect_timeout=10').",
    )


class TestConnectionRequest(BaseModel):
    """Request body for the test-connection endpoint.

    Exactly one of ``connection_url`` or ``connection_fields`` must be provided.
    """

    connection_url: str | None = Field(
        default=None,
        description="SQLAlchemy-style database connection URL.",
        examples=["postgresql://user:pass@localhost/db", "sqlite:///app.db"],
    )
    connection_fields: ConnectionFields | None = Field(
        default=None,
        description="Structured connection parameters.",
    )

    @model_validator(mode="after")
    def _check_exclusive_connection(self) -> TestConnectionRequest:
        has_url = self.connection_url is not None and self.connection_url != ""
        has_fields = self.connection_fields is not None
        if has_url and has_fields:
            raise ValueError(
                "connection_url and connection_fields are mutually exclusive."
            )
        if not has_url and not has_fields:
            raise ValueError(
                "Either connection_url or connection_fields must be provided."
            )
        return self


class TestConnectionResponse(BaseModel):
    """Response payload for the test-connection endpoint."""

    success: bool
    elapsed_ms: float
    dialect: str
    server_version: str | None = None


class DialectsResponse(BaseModel):
    """Response payload for the dialects endpoint."""

    success: bool
    supported_dialects: list[str]


class ApiError(BaseModel):
    """Unified error response body returned by the API."""

    code: str
    message: str
    detail: str | None = None
    retryable: bool = False


class ReverseEngineerRequest(BaseModel):
    """Request body for the reverse-engineer endpoint.

    Exactly one of ``connection_url`` or ``connection_fields`` must be provided.
    """

    connection_url: str | None = Field(
        default=None,
        description="SQLAlchemy-style database connection URL.",
        examples=["postgresql://user:pass@localhost/db", "sqlite:///app.db"],
    )
    connection_fields: ConnectionFields | None = Field(
        default=None,
        description="Structured connection parameters.",
    )
    schema_name: str | None = Field(
        default=None,
        description="Optional name for the returned schema.",
    )
    table_names: list[str] | None = Field(
        default=None,
        description="Optional list of table names to extract. If omitted, all tables are extracted.",
    )
    infer_relationships: bool = Field(
        default=True,
        description="Infer missing relationships from naming conventions.",
    )

    @model_validator(mode="after")
    def _check_exclusive_connection(self) -> ReverseEngineerRequest:
        has_url = self.connection_url is not None and self.connection_url != ""
        has_fields = self.connection_fields is not None
        if has_url and has_fields:
            raise ValueError(
                "connection_url and connection_fields are mutually exclusive."
            )
        if not has_url and not has_fields:
            raise ValueError(
                "Either connection_url or connection_fields must be provided."
            )
        return self


class TableInfo(BaseModel):
    """Metadata for a single database table."""

    name: str = Field(..., description="Table name.")
    column_count: int | None = Field(
        default=None,
        description="Number of columns in the table.",
    )


class ListTablesRequest(BaseModel):
    """Request body for the list-tables endpoint.

    Exactly one of ``connection_url`` or ``connection_fields`` must be provided.
    """

    connection_url: str | None = Field(
        default=None,
        description="SQLAlchemy-style database connection URL.",
    )
    connection_fields: ConnectionFields | None = Field(
        default=None,
        description="Structured connection parameters.",
    )
    schema_name: str | None = Field(
        default=None,
        description="Optional schema/database name to filter tables.",
    )

    @model_validator(mode="after")
    def _check_exclusive_connection(self) -> ListTablesRequest:
        has_url = self.connection_url is not None and self.connection_url != ""
        has_fields = self.connection_fields is not None
        if has_url and has_fields:
            raise ValueError(
                "connection_url and connection_fields are mutually exclusive."
            )
        if not has_url and not has_fields:
            raise ValueError(
                "Either connection_url or connection_fields must be provided."
            )
        return self


class ListTablesResponse(BaseModel):
    """Response wrapper for the list-tables endpoint."""

    success: bool
    tables: list[TableInfo]


class ReverseEngineerResponse(BaseModel):
    """Response wrapper for the reverse-engineer endpoint."""

    success: bool
    schema_data: ERSchema | None = Field(
        default=None,
        serialization_alias="schema",
        description="Extracted ERSchema (serialized as 'schema' in JSON).",
    )
    error: ApiError | None = None
    supported_dialects: list[str] | None = None


class DataSourceFieldBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    dialect: str = Field(..., min_length=1)
    input_mode: str = Field(default="fields", pattern=r"^(url|fields)$")
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database_: str | None = Field(None, alias="database")
    schema_name: str | None = None
    options: str | None = None


class DataSourceCreate(DataSourceFieldBase):
    id: str | None = None
    password: str | None = None


class DataSourceUpdate(BaseModel):
    name: str | None = None
    dialect: str | None = None
    input_mode: str | None = None
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database_: str | None = Field(None, alias="database")
    schema_name: str | None = None
    options: str | None = None
    password: str | None = None


class DataSourceResponse(DataSourceFieldBase):
    id: str
    password_encrypted: str
    created_at: int
    updated_at: int

    model_config = ConfigDict(populate_by_name=True)


class DataSourceListResponse(BaseModel):
    success: bool = True
    data: list[DataSourceResponse]


class DataSourceDetailResponse(BaseModel):
    success: bool = True
    data: DataSourceResponse


class CanvaNode(BaseModel):
    id: str
    name: str
    parent_id: str | None = None
    type: str = "canvas"
    schema_data: str | None = None
    position: int = 0
    created_at: int
    updated_at: int


class CanvaTreeListResponse(BaseModel):
    success: bool = True
    data: list[CanvaNode]


class CanvaNodeCreate(BaseModel):
    id: str | None = None
    name: str
    parent_id: str | None = None
    type: str = "canvas"
    schema_data: str | None = None
    position: int = 0


class CanvaNodeUpdate(BaseModel):
    name: str | None = None
    parent_id: str | None = None
    schema_data: str | None = None
    position: int | None = None


class CanvaNodeDetailResponse(BaseModel):
    success: bool = True
    data: CanvaNode
