"""FastAPI service for ERBeauti reverse engineering."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import sqlite3

import sqlalchemy.exc
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from starlette.middleware.cors import CORSMiddleware

from erbeauti.api_models import (
    ApiError,
    DataSourceCreate,
    DataSourceDetailResponse,
    DataSourceListResponse,
    DataSourceResponse,
    DataSourceUpdate,
    DialectsResponse,
    ListTablesRequest,
    ListTablesResponse,
    ReverseEngineerRequest,
    ReverseEngineerResponse,
    TableInfo,
    TestConnectionRequest,
    TestConnectionResponse,
    CanvaNodeCreate,
    CanvaNodeUpdate,
    CanvaTreeListResponse,
    CanvaNodeDetailResponse,
)
from erbeauti.config import settings
from erbeauti.db.factory import dialect_for_url, get_supported_dialects
from erbeauti.db.url_builder import (
    build_connection_url,
    redact_url_in_message,
    sanitize_url,
    validate_url_target,
)
from erbeauti.exceptions import (
    AuthenticationFailedError,
    ConnectionTimeoutError,
    DatabaseNotFoundError,
    ErbeautiError,
    InternalError,
    InvalidConnectionUrlError,
    SchemaExtractionFailedError,
    UpstreamConnectionError,
    ValidationError,
)
from erbeauti.extract import extract_schema, infer_relationships
from erbeauti.system_db import (
    init_db,
    list_datasources as sys_list_datasources,
    get_datasource as sys_get_datasource,
    create_datasource as sys_create_datasource,
    update_datasource as sys_update_datasource,
    delete_datasource as sys_delete_datasource,
    list_canva_tree as sys_list_canva_tree,
    get_canva_node as sys_get_canva_node,
    create_canva_node as sys_create_canva_node,
    update_canva_node as sys_update_canva_node,
    delete_canva_node as sys_delete_canva_node,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan handler."""
    init_db()
    yield


app = FastAPI(
    title="ERBeauti Backend",
    description="Database reverse-engineering service for ERBeauti.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)


def _resolve_connection_url(payload: TestConnectionRequest | ReverseEngineerRequest) -> str:
    """Return a SQLAlchemy URL from either connection_url or connection_fields."""
    if payload.connection_url:
        return payload.connection_url
    if payload.connection_fields:
        return build_connection_url(payload.connection_fields)
    raise ValidationError("Either connection_url or connection_fields must be provided.")


def _map_sqlalchemy_error(exc: sqlalchemy.exc.SQLAlchemyError, context: str) -> ErbeautiError:
    """Convert a SQLAlchemy error into a domain ErbeautiError."""
    message = str(exc).lower()
    original_message = redact_url_in_message(str(exc))

    # OperationalError covers connectivity, auth and missing DB for most drivers.
    if isinstance(exc, sqlalchemy.exc.OperationalError):
        if "timeout" in message or "timed out" in message:
            return ConnectionTimeoutError(original_message)
        if any(keyword in message for keyword in ("authentication", "access denied", "login failed")):
            return AuthenticationFailedError(original_message)
        if any(keyword in message for keyword in ("unknown database", "database \"", "does not exist", "could not connect")):
            return DatabaseNotFoundError(original_message)
        return UpstreamConnectionError(original_message)

    if isinstance(exc, sqlalchemy.exc.ProgrammingError):
        return SchemaExtractionFailedError(original_message)

    if isinstance(exc, (sqlalchemy.exc.ArgumentError, sqlalchemy.exc.NoSuchModuleError)):
        return InvalidConnectionUrlError(original_message)

    if isinstance(exc, sqlalchemy.exc.DBAPIError):
        return UpstreamConnectionError(original_message)

    return UpstreamConnectionError(f"{context}: {original_message}")


def _build_api_error(exc: Exception) -> tuple[int, ApiError]:
    """Map an exception to an HTTP status code and a unified ApiError body."""
    if isinstance(exc, ErbeautiError):
        domain_exc = exc
    elif isinstance(exc, PydanticValidationError):
        domain_exc = ValidationError("Request validation failed")
    elif isinstance(exc, sqlalchemy.exc.SQLAlchemyError):
        domain_exc = _map_sqlalchemy_error(exc, "database operation failed")
    elif isinstance(exc, sqlite3.Error):
        message = redact_url_in_message(str(exc))
        domain_exc = UpstreamConnectionError(message)
    elif isinstance(exc, ValueError):
        domain_exc = ValidationError(redact_url_in_message(str(exc)))
    else:
        logger.exception("Unhandled exception in request handler")
        domain_exc = InternalError("An unexpected internal error occurred.")

    status_map = {
        "VALIDATION_ERROR": 400,
        "UNSUPPORTED_DIALECT": 400,
        "INVALID_CONNECTION_URL": 400,
        "AUTHENTICATION_FAILED": 401,
        "DATABASE_NOT_FOUND": 400,
        "CONNECTION_TIMEOUT": 504,
        "UPSTREAM_CONNECTION_ERROR": 502,
        "SCHEMA_EXTRACTION_FAILED": 500,
        "INTERNAL_ERROR": 500,
    }
    status_code = status_map.get(domain_exc.code, 500)

    api_error = ApiError(
        code=domain_exc.code,
        message=domain_exc.message,
        detail=None,
        retryable=domain_exc.retryable,
    )
    return status_code, api_error


def _log_error(payload_description: str, url: str | None, exc: Exception) -> None:
    """Log an error without exposing passwords or full URLs."""
    safe_url = sanitize_url(url) if url else None
    redacted_message = redact_url_in_message(str(exc))
    logger.error(
        "Request failed: %s, url=%s, error=%s",
        payload_description,
        safe_url,
        redacted_message,
    )


@app.exception_handler(RequestValidationError)
async def _handle_validation_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI request validation errors."""
    api_error = ApiError(
        code="VALIDATION_ERROR",
        message="Request validation failed",
        detail=None,
        retryable=False,
    )
    return JSONResponse(status_code=400, content=api_error.model_dump(mode="json"))


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/datasources", response_model=DataSourceListResponse)
async def list_datasources_route():
    return DataSourceListResponse(data=[DataSourceResponse(**d) for d in sys_list_datasources()])


@app.get("/datasources/{ds_id}", response_model=DataSourceDetailResponse)
async def get_datasource_route(ds_id: str):
    d = sys_get_datasource(ds_id, decrypt_pw=True)
    if d is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return DataSourceDetailResponse(data=DataSourceResponse(**d))


@app.post("/datasources", response_model=DataSourceDetailResponse, status_code=201)
async def create_datasource_route(payload: DataSourceCreate):
    data = payload.model_dump(by_alias=True, exclude_none=True)
    created = sys_create_datasource(data)
    return DataSourceDetailResponse(data=DataSourceResponse(**created))


@app.put("/datasources/{ds_id}", response_model=DataSourceDetailResponse)
async def update_datasource_route(ds_id: str, payload: DataSourceUpdate):
    data = payload.model_dump(by_alias=True, exclude_none=True)
    updated = sys_update_datasource(ds_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return DataSourceDetailResponse(data=DataSourceResponse(**updated))


@app.delete("/datasources/{ds_id}")
async def delete_datasource_route(ds_id: str):
    if not sys_delete_datasource(ds_id):
        raise HTTPException(status_code=404, detail="Data source not found")
    return {"success": True}


@app.get("/canva-tree", response_model=CanvaTreeListResponse)
async def list_canva_tree_route():
    return CanvaTreeListResponse(data=[CanvaNode(**d) for d in sys_list_canva_tree()])


@app.post("/canva-tree", response_model=CanvaNodeDetailResponse, status_code=201)
async def create_canva_node_route(payload: CanvaNodeCreate):
    data = payload.model_dump(exclude_none=True)
    created = sys_create_canva_node(data)
    return CanvaNodeDetailResponse(data=CanvaNode(**created))


@app.put("/canva-tree/{node_id}", response_model=CanvaNodeDetailResponse)
async def update_canva_node_route(node_id: str, payload: CanvaNodeUpdate):
    data = payload.model_dump(exclude_none=True)
    updated = sys_update_canva_node(node_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Canvas node not found")
    return CanvaNodeDetailResponse(data=CanvaNode(**updated))


@app.delete("/canva-tree/{node_id}")
async def delete_canva_node_route(node_id: str):
    if not sys_delete_canva_node(node_id):
        raise HTTPException(status_code=404, detail="Canvas node not found")
    return {"success": True}


@app.get("/dialects")
async def list_dialects() -> DialectsResponse:
    """List supported database dialects."""
    return DialectsResponse(
        success=True,
        supported_dialects=get_supported_dialects(),
    )


@app.get("/sample-databases")
async def list_sample_databases() -> dict:
    """List available sample SQLite databases in the data directory."""
    data_dir = Path(settings.data_dir).resolve() if settings.data_dir else (Path.cwd() / ".." / "data").resolve()
    databases = []
    if data_dir.is_dir():
        for f in sorted(data_dir.iterdir()):
            if f.suffix == ".db" and f.name != "system.db":
                name = f.stem.replace("_", " ").replace("-", " ").title()
                databases.append({
                    "id": f"sample-{f.stem}",
                    "name": name,
                    "filename": f.name,
                })
    return {"success": True, "databases": databases}


@app.post("/test-connection")
async def test_connection(payload: TestConnectionRequest) -> TestConnectionResponse:
    """Test connectivity to a database without reading its schema."""
    url: str | None = None
    try:
        url = _resolve_connection_url(payload)
        dialect = dialect_for_url(url)
        validate_url_target(url)

        timeout = settings.test_connection_timeout
        start = time.perf_counter()
        server_version = dialect.test_connection(url, timeout)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return TestConnectionResponse(
            success=True,
            elapsed_ms=round(elapsed_ms, 2),
            dialect=dialect.name,
            server_version=server_version,
        )
    except ErbeautiError:
        raise
    except sqlalchemy.exc.SQLAlchemyError as exc:
        _log_error("test-connection", url, exc)
        raise _map_sqlalchemy_error(exc, "test connection failed") from exc
    except sqlite3.Error as exc:
        _log_error("test-connection", url, exc)
        raise UpstreamConnectionError(redact_url_in_message(str(exc))) from exc
    except Exception as exc:
        _log_error("test-connection", url, exc)
        raise InternalError("Test connection failed unexpectedly.") from exc
    finally:
        # Always log the sanitized URL for audit/debugging.
        logger.info("test-connection target=%s", sanitize_url(url) if url else None)


@app.post("/tables")
async def list_tables(payload: ListTablesRequest) -> ListTablesResponse:
    """List available tables in a database without extracting full schema."""
    url: str | None = None
    try:
        url = _resolve_connection_url(payload)
        dialect = dialect_for_url(url)
        validate_url_target(url)

        tables_with_counts = dialect.list_tables()
        tables = [TableInfo(name=name, column_count=count) for name, count in tables_with_counts]
        return ListTablesResponse(success=True, tables=tables)
    except ErbeautiError:
        raise
    except sqlalchemy.exc.SQLAlchemyError as exc:
        _log_error("list-tables", url, exc)
        raise _map_sqlalchemy_error(exc, "list tables failed") from exc
    except sqlite3.Error as exc:
        _log_error("list-tables", url, exc)
        raise UpstreamConnectionError(redact_url_in_message(str(exc))) from exc
    except Exception as exc:
        _log_error("list-tables", url, exc)
        raise InternalError("Failed to list tables.") from exc
    finally:
        logger.info("list-tables target=%s", sanitize_url(url) if url else None)


@app.post("/reverse-engineer", response_model=ReverseEngineerResponse)
async def reverse_engineer(payload: ReverseEngineerRequest) -> ReverseEngineerResponse:
    """Connect to a database and return its schema as ERSchema JSON."""
    url: str | None = None
    try:
        url = _resolve_connection_url(payload)
        dialect_for_url(url)
        validate_url_target(url)

        schema = extract_schema(url, payload.schema_name, payload.table_names)
        if payload.infer_relationships:
            schema = infer_relationships(schema)
        return ReverseEngineerResponse(success=True, schema_data=schema)
    except ErbeautiError:
        raise
    except sqlalchemy.exc.SQLAlchemyError as exc:
        _log_error("reverse-engineer", url, exc)
        raise _map_sqlalchemy_error(exc, "schema extraction failed") from exc
    except sqlite3.Error as exc:
        _log_error("reverse-engineer", url, exc)
        raise UpstreamConnectionError(redact_url_in_message(str(exc))) from exc
    except Exception as exc:
        _log_error("reverse-engineer", url, exc)
        raise InternalError("Failed to extract schema.") from exc
    finally:
        logger.info("reverse-engineer target=%s", sanitize_url(url) if url else None)


@app.exception_handler(ErbeautiError)
async def _handle_domain_error(_request: Request, exc: ErbeautiError) -> JSONResponse:
    """Handle domain exceptions and return a unified ApiError response."""
    status_code, api_error = _build_api_error(exc)
    return JSONResponse(status_code=status_code, content=api_error.model_dump(mode="json"))


@app.exception_handler(Exception)
async def _handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler returning a sanitized ApiError."""
    logger.exception("Unexpected error: %s", exc)
    status_code, api_error = _build_api_error(exc)
    return JSONResponse(status_code=status_code, content=api_error.model_dump(mode="json"))


def main() -> None:
    """Entry point for running the API server."""
    import uvicorn

    uvicorn.run(
        "erbeauti.api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )


if __name__ == "__main__":
    main()
