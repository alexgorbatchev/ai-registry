# Python CLI

Python implementation of [CLI best practices](../cli/best-practices.md). Read that reference first; this file covers only the Python framework choice and output patterns. Run everything through `uv` as described in [Python tooling](tooling.md).

## Argument Parsing: Typer or Click

Use `typer` or `click`. Never use `getopt` or parse `sys.argv` manually. Query terminal width with `shutil.get_terminal_size()`.

### Typer

```python
import typer

app = typer.Typer(help="Process and manage project datasets")

@app.command()
def sync(
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite existing local files without prompting",
    )
):
    """Synchronize local files with remote storage."""
    pass

if __name__ == "__main__":
    app()
```

### Click

```python
import click

@click.group()
def cli():
    """Process and manage project datasets."""
    pass

@cli.command()
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Overwrite existing local files without prompting",
)
def sync(force: bool):
    """Synchronize local files with remote storage."""
    pass

if __name__ == "__main__":
    cli()
```

## Mode Detection & Helpers

```python
import os
import shutil

def is_agent_mode() -> bool:
    val = os.environ.get("AGENT", "").strip().lower()
    return val in ("1", "true", "yes")

def render_divider(char: str = "-") -> None:
    if is_agent_mode():
        return
    cols, _ = shutil.get_terminal_size(fallback=(80, 24))
    print(char * cols)
```

## Table Output Pattern

```python
from typing import List, Dict
from rich.console import Console
from rich.table import Table

def render_records(records: List[Dict[str, str]]) -> None:
    if is_agent_mode():
        for r in records:
            print(" ".join(f"{k}:{v}" for k, v in r.items()))
        return

    if not records:
        return
    console = Console()
    table = Table(show_header=True, header_style="bold cyan")
    for k in records[0].keys():
        table.add_column(k.capitalize())
    for r in records:
        table.add_row(*r.values())
    console.print(table)
```
