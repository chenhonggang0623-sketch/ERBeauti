"""High-level schema extraction and normalization to ERSchema."""

from __future__ import annotations

import uuid
from typing import Literal

from erbeauti.db.base import RawSchema
from erbeauti.db.factory import dialect_for_url
from erbeauti.models import EREnum, ERField, ERRelationship, ERSchema, ERTable


def _make_id(prefix: str, *parts: str) -> str:
    """Generate a deterministic, URL-safe id."""
    base = "_".join(parts)
    return f"{prefix}_{uuid.uuid5(uuid.NAMESPACE_URL, base).hex[:12]}"


def normalize_schema(raw: RawSchema, schema_name: str = "extracted", table_names: list[str] | None = None) -> ERSchema:
    """Convert a RawSchema into the frontend-compatible ERSchema.

    Args:
        raw: Raw schema metadata extracted from a database.
        schema_name: Name for the returned schema.
        table_names: Optional list of table names to include. If provided,
            only tables in this list are included, and relationships involving
            tables outside this list are filtered out.
    """
    selected_tables = set(table_names) if table_names else None
    schema_id = _make_id("schema", schema_name)
    schema = ERSchema(id=schema_id, name=schema_name, tables=[], relationships=[], enums=[])

    table_ids: dict[str, str] = {}
    field_ids: dict[tuple[str, str], str] = {}
    field_lookup: dict[tuple[str, str], ERField] = {}

    for table_name, columns in raw.tables.items():
        if selected_tables is not None and table_name not in selected_tables:
            continue
        table_id = _make_id("table", table_name)
        table_ids[table_name] = table_id

        fields: list[ERField] = []
        for col in columns:
            field_id = _make_id("field", table_name, col.name)
            field_ids[(table_name, col.name)] = field_id
            field = ERField(
                id=field_id,
                name=col.name,
                type=col.data_type.upper(),
                nullable=col.nullable,
                isPrimaryKey=col.is_primary_key,
                isForeignKey=col.is_foreign_key,
                isUnique=col.is_unique,
                isAutoIncrement=col.is_auto_increment,
                defaultValue=col.default_value,
                comment=col.comment,
            )
            fields.append(field)
            field_lookup[(table_name, col.name)] = field

        schema.tables.append(
            ERTable(
                id=table_id,
                name=table_name,
                comment=None,
                fields=fields,
            )
        )

    for fk in raw.foreign_keys:
        source_table = fk.table_name
        source_col = fk.column_name
        target_table = fk.referenced_table
        target_col = fk.referenced_column

        if selected_tables is not None and (
            source_table not in selected_tables or target_table not in selected_tables
        ):
            continue
        if (source_table, source_col) not in field_ids:
            continue
        if (target_table, target_col) not in field_ids:
            continue

        target_field = field_lookup[(target_table, target_col)]
        relationship_type: Literal["1:1", "1:N", "N:1", "N:M"] = "1:N"
        if target_field.isUnique or target_field.isPrimaryKey:
            relationship_type = "N:1"

        schema.relationships.append(
            ERRelationship(
                id=_make_id("rel", source_table, source_col, target_table, target_col),
                sourceTableId=table_ids[source_table],
                sourceFieldId=field_ids[(source_table, source_col)],
                targetTableId=table_ids[target_table],
                targetFieldId=field_ids[(target_table, target_col)],
                type=relationship_type,
            )
        )

    for enum in raw.enums:
        schema.enums = schema.enums or []
        schema.enums.append(
            EREnum(
                id=_make_id("enum", enum["name"]),
                name=enum["name"],
                values=enum.get("values", []),
            )
        )

    return schema


def extract_schema(
    connection_url: str,
    schema_name: str | None = None,
    table_names: list[str] | None = None,
) -> ERSchema:
    """Extract an ERSchema from a database connection URL."""
    dialect = dialect_for_url(connection_url)
    raw = dialect.extract()
    name = schema_name or f"schema_{uuid.uuid4().hex[:8]}"
    return normalize_schema(raw, name, table_names)


def infer_relationships(schema: ERSchema) -> ERSchema:
    """Infer missing foreign-key relationships from naming conventions.

    Rules:
    1. field named `<table>_id` -> target table's primary key.
    2. field name matches a target table's primary key column name.
    """
    table_by_name = {t.name: t for t in schema.tables}
    pk_columns: dict[str, str] = {}
    for table in schema.tables:
        for field in table.fields:
            if field.isPrimaryKey:
                pk_columns[table.name] = field.name

    existing = {
        (r.sourceTableId, r.sourceFieldId, r.targetTableId, r.targetFieldId)
        for r in schema.relationships
    }

    for table in schema.tables:
        for field in table.fields:
            if field.isForeignKey or field.isPrimaryKey:
                continue

            target_table: str | None = None
            target_column: str | None = None

            # Rule 1: user_id -> users.id
            lower_name = field.name.lower()
            if lower_name.endswith("_id"):
                base = lower_name[:-3]
                candidates = {base}
                # simple pluralization attempts
                if not base.endswith("s"):
                    candidates.add(base + "s")
                if base.endswith("y"):
                    candidates.add(base[:-1] + "ies")
                if base.endswith("es"):
                    candidates.add(base[:-2])
                for candidate in candidates:
                    if candidate in table_by_name and candidate != table.name:
                        target_table = candidate
                        target_column = pk_columns.get(target_table)
                        if target_column:
                            break

            # Rule 2: field name equals PK column of another table
            if target_table is None:
                for other_name, other_pk in pk_columns.items():
                    if other_name != table.name and field.name.lower() == other_pk.lower():
                        target_table = other_name
                        target_column = other_pk
                        break

            if target_table and target_column:
                target = table_by_name[target_table]
                source_field_id = field.id
                target_field = next(
                    (f for f in target.fields if f.name.lower() == target_column.lower()), None
                )
                if target_field is None:
                    continue

                key = (table.id, source_field_id, target.id, target_field.id)
                if key in existing:
                    continue

                schema.relationships.append(
                    ERRelationship(
                        id=_make_id("rel", table.name, field.name, target_table, target_column),
                        sourceTableId=table.id,
                        sourceFieldId=source_field_id,
                        targetTableId=target.id,
                        targetFieldId=target_field.id,
                        type="N:1",
                    )
                )
                existing.add(key)

    return schema
