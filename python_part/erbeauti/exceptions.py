"""Domain exceptions and error codes for the ERBeauti API."""

from __future__ import annotations


class ErbeautiError(Exception):
    """Base class for all application errors."""

    code: str = "INTERNAL_ERROR"
    retryable: bool = False

    def __init__(self, message: str | None = None, *, retryable: bool | None = None) -> None:
        super().__init__(message)
        self.message = message or self.code
        if retryable is not None:
            self.retryable = retryable


class ValidationError(ErbeautiError):
    """Request payload failed validation or business rule checks."""

    code = "VALIDATION_ERROR"


class UnsupportedDialectError(ErbeautiError):
    """The requested database dialect is not supported."""

    code = "UNSUPPORTED_DIALECT"


class InvalidConnectionUrlError(ErbeautiError):
    """The connection URL is malformed or cannot be parsed."""

    code = "INVALID_CONNECTION_URL"


class AuthenticationFailedError(ErbeautiError):
    """The database rejected the supplied credentials."""

    code = "AUTHENTICATION_FAILED"


class DatabaseNotFoundError(ErbeautiError):
    """The requested database does not exist or is not accessible."""

    code = "DATABASE_NOT_FOUND"


class ConnectionTimeoutError(ErbeautiError):
    """The connection attempt exceeded the configured timeout."""

    code = "CONNECTION_TIMEOUT"
    retryable = True


class UpstreamConnectionError(ErbeautiError):
    """The database host is unreachable or refused the connection."""

    code = "UPSTREAM_CONNECTION_ERROR"
    retryable = True


class SchemaExtractionFailedError(ErbeautiError):
    """Schema extraction failed after a successful connection."""

    code = "SCHEMA_EXTRACTION_FAILED"


class InternalError(ErbeautiError):
    """An unexpected internal server error occurred."""

    code = "INTERNAL_ERROR"
