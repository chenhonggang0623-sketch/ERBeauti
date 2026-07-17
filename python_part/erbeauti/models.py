"""Pydantic models for the unified ERSchema format."""

from typing import Literal

from pydantic import BaseModel, Field


class ERField(BaseModel):
    """A column/field inside a table."""

    id: str
    name: str
    type: str
    nullable: bool
    isPrimaryKey: bool
    isForeignKey: bool
    isUnique: bool
    isAutoIncrement: bool
    defaultValue: str | None = None
    comment: str | None = None


class ERTable(BaseModel):
    """A database table."""

    id: str
    name: str
    comment: str | None = None
    fields: list[ERField] = Field(default_factory=list)
    position: dict[str, float] | None = None
    group: str | None = None


class ERRelationship(BaseModel):
    """A relationship between two table fields."""

    id: str
    sourceTableId: str
    sourceFieldId: str
    targetTableId: str
    targetFieldId: str
    type: Literal["1:1", "1:N", "N:1", "N:M"]


class EREnum(BaseModel):
    """An enum type (currently used as a placeholder for PG enums)."""

    id: str
    name: str
    values: list[str] = Field(default_factory=list)


class ERSchema(BaseModel):
    """Unified schema returned to the ERBeauti frontend."""

    id: str
    name: str
    tables: list[ERTable] = Field(default_factory=list)
    relationships: list[ERRelationship] = Field(default_factory=list)
    enums: list[EREnum] | None = None
