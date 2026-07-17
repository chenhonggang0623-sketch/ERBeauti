"""Command-line interface for ERBeauti reverse engineering."""

from __future__ import annotations

import json

import typer
from rich.console import Console
from rich.json import JSON

from erbeauti.db.factory import get_supported_dialects
from erbeauti.extract import extract_schema, infer_relationships

app = typer.Typer(
    name="erbeauti-cli",
    help="ERBeauti database reverse-engineering CLI",
    no_args_is_help=True,
)
console = Console()


@app.command()
def extract(
    connection_url: str = typer.Argument(
        ...,
        help="SQLAlchemy-style database URL (e.g. sqlite:///app.db)",
    ),
    output: str | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output JSON file path. Prints to stdout if omitted.",
    ),
    schema_name: str | None = typer.Option(
        None,
        "--name",
        "-n",
        help="Optional schema name.",
    ),
    infer: bool = typer.Option(
        True,
        "--infer/--no-infer",
        help="Infer missing relationships from naming conventions.",
    ),
    pretty: bool = typer.Option(
        True,
        "--pretty/--compact",
        help="Pretty-print JSON output.",
    ),
) -> None:
    """Extract database schema and output ERSchema JSON."""
    try:
        schema = extract_schema(connection_url, schema_name)
        if infer:
            schema = infer_relationships(schema)
    except ValueError as exc:
        console.print(f"[red]Error:[/red] {exc}")
        raise typer.Exit(code=2) from exc
    except Exception as exc:
        console.print(f"[red]Failed to extract schema:[/red] {exc}")
        raise typer.Exit(code=1) from exc

    indent = 2 if pretty else None
    json_text = json.dumps(schema.model_dump(mode="json"), indent=indent, ensure_ascii=False)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(json_text)
        console.print(f"[green]Schema written to[/green] {output}")
    else:
        if pretty:
            console.print(JSON(json_text))
        else:
            console.print(json_text)


@app.command()
def dialects() -> None:
    """List supported database dialects."""
    for dialect in get_supported_dialects():
        console.print(dialect)


if __name__ == "__main__":
    app()
