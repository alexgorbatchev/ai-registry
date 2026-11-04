# Bun justfile

Bun implementation of the [task automation contract](../cli/best-practices.md#task-automation-justfile). Read that contract first for the required recipes and the read-only `check` rule. Tool selection, the `unused` requirement, and tool invocation rules are in [Bun runtime: Linting & Formatting](runtime.md#linting--formatting); React projects replace the formatting and lint recipes as described in [Bun React Compiler](react-compiler.md#3-required-react-policy).

This TypeScript template requires installed `oxlint`, `oxfmt`, `ts-unused`, `typescript`, and `@types/bun` development dependencies, a `tsconfig.json`, and behavioral tests. Drop `run`, `run-ai`, and `build` for libraries without an executable. Replace `src/cli.ts` and `mytool` with the actual entrypoint and binary name.

```justfile
set dotenv-load := false

default:
    @just --list

# Run the CLI in human mode
run *args:
    bun src/cli.ts {{args}}

# Run the CLI in agent-facing mode
run-ai *args:
    AGENT=1 bun src/cli.ts {{args}}

# Compile a standalone binary into bin/
build:
    mkdir -p bin
    bun build --compile --outfile bin/mytool src/cli.ts

fmt:
    bun run oxfmt

fmt-check:
    bun run oxfmt --check

lint:
    bun run oxlint --deny-warnings

fix:
    bun run oxlint --fix
    bun run oxfmt

typecheck:
    bun run tsc --noEmit

unused:
    bun run --bun ts-unused check tsconfig.json

test:
    bun test

# Validate without modifying files
check: fmt-check lint typecheck unused test
```

Scope these commands to the project's source and test directories when a repository contains unrelated assets or packages.
