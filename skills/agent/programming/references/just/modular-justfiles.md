## Core Architecture

## Contents

- [Core Architecture](#core-architecture)
- [Naming & File Conventions](#naming--file-conventions)
- [Declaring Submodules with `mod`](#declaring-submodules-with-mod)
- [Working Directory Control](#working-directory-control)
- [Standard Submodule Recipes](#standard-submodule-recipes)
- [Root Lifecycle Orchestration](#root-lifecycle-orchestration)
- [Verification & Formatting](#verification--formatting)

In multi-package repositories, workspaces, or multi-component projects (e.g. `apps/*`, `packages/*`, `tools/*`, `modules/*`), use `just` submodules (`mod`) instead of calling nested directories, package scripts, or tooling entrypoints directly from a monolithic root `justfile`.

- **Root `justfile`**: Owns workspace orchestration, high-level lifecycle commands (`verify`, `test`, `lint`, `build`), and links submodules via `mod`. Never invokes arbitrary deeply nested scripts directly when a submodule can encapsulate them.
- **Submodule `justfile`**: Owns component-specific recipes (`run`, `run-ai`, `verify`, `test`, `fmt`, `build`) and executes within its scoped domain.

## Naming & File Conventions

Always name each submodule's task file `justfile` (lowercase) located directly inside that submodule's directory:

```
repo-root/
├── Justfile                      # Workspace root justfile
├── apps/
│   └── web/
│       └── justfile              # Submodule justfile
├── packages/
│   └── core/
│       └── justfile              # Submodule justfile
└── tools/
    └── cli/
        └── justfile              # Submodule justfile
```

- **Standard Filename**: Always use `justfile` in child directories. Do not use ad-hoc filenames such as `mod.just`, `sub.just`, or `<name>.just`.
- **Exception**: Use an alternative name (such as `mod.just`) only if `justfile` in that specific directory is already reserved for another purpose (e.g., an external symlink template).

## Declaring Submodules with `mod`

Declare submodules at the top of the parent `justfile`:

```justfile
# Workspace justfile

mod web 'apps/web/justfile'
mod core 'packages/core/justfile'
mod cli 'tools/cli/justfile'

default:
    @just --list
```

### Module Name Collisions

A `justfile` cannot define a recipe with the same name as a declared module. Doing so causes a parse failure:
`error: module <name> defined on line X is redefined as a recipe on line Y`

- Invocations like `just cli` automatically invoke the submodule's `[default]` recipe.
- Never declare a recipe `cli` when `mod cli` exists.

## Working Directory Control

By default, `just` sets the working directory of a submodule's recipes to the directory containing that submodule's `justfile`.

1. **Submodule-Local Execution (Default)**:
   When recipes run commands local to the package (e.g. `bun test`, `cargo build`, `npm run dev`), leave the default working directory intact:

   ```justfile
   # apps/web/justfile (runs inside apps/web)
   [default]
   dev:
       vite dev

   test:
       bun test
   ```

2. **Repository-Root Execution (`set working-directory`)**:
   When a tool or script expects paths anchored to the repository root (e.g. workspace-wide database directories, shared cache, or root-relative paths), set `set working-directory` to the relative path back to root:

   ```justfile
   # tools/cli/justfile
   set working-directory := "../.."

   [default]
   run *args:
       bun tools/cli/src/cli.ts {{ args }}

   run-ai *args:
       AGENT=1 bun tools/cli/src/cli.ts {{ args }}

   typecheck:
       bun run tsc --noEmit

   verify: typecheck test

   test:
       bun test tools/cli
   ```

## Standard Submodule Recipes

Name aggregate validation `verify` and invoke it with `just verify` or `just <module> verify`. Keep `verify` and its dependencies read-only; reserve formatting and fixes for separate write recipes. Do not create a `check` alias for aggregate validation.

Every runnable submodule should provide standard lifecycle recipes matching CLI standards:

- `[default]` on the primary entrypoint so `just <module>` runs it without sub-recipe arguments.
- `run *args:`: Main execution entrypoint forwarding flags.
- `run-ai *args:`: Token-conservative agent mode when `AGENT=1` applies.
- `verify:`: Aggregate read-only validation, including linting, type checking, invariants, and tests as applicable.
- `typecheck:`: Type checking.
- `test:`: Component test suite execution.

```justfile
# tools/dashboard/justfile
[default]
run *args:
    bun scripts/serve.ts {{ args }}

run-ai *args:
    AGENT=1 bun scripts/serve.ts {{ args }}

typecheck:
    bun run tsc --noEmit

verify: typecheck test

test:
    bun test
```

## Root Lifecycle Orchestration

The root `justfile` aggregates submodule tasks by calling them through `just <module> <recipe>` rather than executing nested tools directly:

```justfile
# Workspace Justfile

mod web 'apps/web/justfile'
mod core 'packages/core/justfile'
mod cli 'tools/cli/justfile'

default:
    @just --list

# Run verification across all submodules
verify:
    just core verify
    just web verify
    just cli verify

# Run tests across all submodules
test:
    just core test
    just web test
    just cli test
```

### Passing Arguments via Variadic Parameters

Use `*args` to pass arbitrary flags and parameters through to module recipes:

```justfile
# Parent recipe delegating to module
web-dev *args:
    just web dev {{ args }}
```

## Verification & Formatting

- **Discoverability**: Inspect all registered submodules and their recipes:
  ```sh
  just --list --list-submodules
  ```
- **Formatting**: Always format all justfiles in the project:
  ```sh
  just --fmt
  just -f apps/web/justfile --fmt
  ```
  Check formatting in CI:
  ```sh
  just --fmt --check
  ```
