# Justfile Templates

All CLI tools and repositories must provide a `Justfile` (or `justfile`) at root with `run`, `run-ai`, and `test` recipes.

---

## TypeScript / Bun Template

```justfile
set dotenv-load := false

# Run CLI in human mode (default)
run *args:
    bun run src/cli.ts {{args}}

# Run CLI in agent-facing token-conservative mode
run-ai *args:
    AGENT=1 bun run src/cli.ts {{args}}

# Run unit tests
test:
    bun test

# Typecheck and lint
check:
    bun x tsc --noEmit
    bun test

# Compile standalone binary
build:
    mkdir -p bin
    bun build --compile --outfile bin/mytool src/cli.ts
```

---

## Go Template

```justfile
set dotenv-load := false
binary_name := "mytool"

# Run CLI in human mode
run *args:
    go run ./cmd/{{binary_name}} {{args}}

# Run CLI in agent-facing mode
run-ai *args:
    AGENT=1 go run ./cmd/{{binary_name}} {{args}}

# Run test suite
test:
    go test -v ./...

# Build binary into bin/
build:
    mkdir -p bin
    go build -o bin/{{binary_name}} ./cmd/{{binary_name}}

# Lint and static check
check:
    golangci-lint run
    go test ./...
```

---

## Python Template

```justfile
set dotenv-load := false

# Run CLI in human mode
run *args:
    python -m mytool {{args}}

# Run CLI in agent-facing mode
run-ai *args:
    AGENT=1 python -m mytool {{args}}

# Run pytest suite
test:
    pytest

# Typecheck and lint
check:
    mypy mytool
    ruff check .
    pytest
```

---

## Rust Template

```justfile
set dotenv-load := false

# Run CLI in human mode
run *args:
    cargo run -- {{args}}

# Run CLI in agent-facing mode
run-ai *args:
    AGENT=1 cargo run -- {{args}}

# Run test suite
test:
    cargo test

# Build release binary
build:
    cargo build --release
    mkdir -p bin
    cp target/release/mytool bin/

# Lint and check
check:
    cargo clippy -- -D warnings
    cargo test
```
