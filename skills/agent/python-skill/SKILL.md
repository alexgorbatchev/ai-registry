---
name: python-skill
description: MUST USE whenever using Python.
author: alexgorbatchev
metadata:
  created_on: 2026-08-13 18:24
  last_modified: 2026-08-13 18:35
  status: current
---

## Mandatory Tooling Rules

1. **ALWAYS use `uv`**: All Python execution, dependency management, Python version installation, virtual environment creation, and tool invocations MUST go through `uv`.
2. **NEVER install packages globally**: Global package installs (e.g. `pip install`, `sudo pip`, `uv pip install --system`, `pip install --user`) are strictly prohibited. Never modify system or global site-packages.
3. **ALWAYS use project-local `.venv`**: Virtual environments MUST be project-local, located strictly at `.venv` in the root of the project directory.
4. **Task Automation (`just` & `justfile`)**: Use `just` for project task automation, builds, tests, and recipes via a `justfile` (e.g., `just test`, `just lint`, `just run`). Recipes inside the `justfile` must invoke `uv run ...` for Python actions.

---

## Workflow & Command Reference

### Virtual Environment Management

- **Create local virtual environment**:
  ```bash
  uv venv
  ```
  Creates a `.venv` folder in the project root using the appropriate Python version.

- **Sync project dependencies**:
  ```bash
  uv sync
  ```
  Creates `.venv` if missing and syncs dependencies strictly according to `pyproject.toml` and `uv.lock`.

### Managing Dependencies

- **Add production dependency**:
  ```bash
  uv add <package>
  ```
- **Add development dependency**:
  ```bash
  uv add --dev <package>
  ```
- **Remove dependency**:
  ```bash
  uv remove <package>
  ```
- **Legacy `requirements.txt` projects**:
  ```bash
  uv venv
  uv pip install -r requirements.txt
  ```
  *Note: `uv pip install` installs strictly into the project-local `.venv` when active or when `.venv` is present in current working directory.*

### Running Code & Executables

- **Execute Python scripts**:
  ```bash
  uv run python script.py
  ```
- **Run tests**:
  ```bash
  uv run pytest
  ```
- **Run linters / formatters / typecheckers**:
  ```bash
  uv run ruff check .
  uv run mypy .
  ```
- **Run isolated CLI tools without installing in project**:
  ```bash
  uvx ruff check .
  uvx black .
  ```

---

## Prohibited Actions & Negative Guardrails

- **PROHIBITED**: `pip install <package>` or `python -m pip install` without `uv`.
- **PROHIBITED**: `uv pip install --system` or `--user`.
- **PROHIBITED**: Creating virtual environments anywhere other than project-root `.venv` (e.g. `python -m venv myenv` or global virtualenvs).
- **PROHIBITED**: Executing `python`, `pip`, `pytest`, or CLI entrypoints directly against system Python without `uv run` or an activated project-local `.venv`.
- **PROHIBITED**: Using system package managers (`apt`, `brew`, `pacman`) to install Python library dependencies globally.

---

## Environment Bootstrapping

If `uv` is not installed on the system:
1. Install `uv` using its official standalone installer:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
2. Verify `uv` availability with `uv --version`.
3. NEVER fall back to global `pip` or system Python as a workaround for a missing `uv` installation.
