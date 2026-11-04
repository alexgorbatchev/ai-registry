# Python justfile

Python implementation of the [task automation contract](../cli/best-practices.md#task-automation-justfile). Read that contract first for the required recipes and the read-only `check` rule. Recipes invoke every Python action through `uv run`, as required by [Python tooling](tooling.md).

Drop `run` and `run-ai` for libraries without an executable. Replace `mytool` with the actual package name.

```justfile
set dotenv-load := false

# Run the CLI in human mode
run *args:
    uv run python -m mytool {{args}}

# Run the CLI in agent-facing mode
run-ai *args:
    AGENT=1 uv run python -m mytool {{args}}

# Run the pytest suite
test:
    uv run pytest

# Apply formatting
fmt:
    uv run ruff format .

# Fail on unformatted files without rewriting them
fmt-check:
    uv run ruff format --check .

# Lint
lint:
    uv run ruff check .

# Type check
typecheck:
    uv run mypy mytool

# Validate without modifying files
check: fmt-check lint typecheck test
```
