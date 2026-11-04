# Go justfile

Go implementation of the [task automation contract](../cli/best-practices.md#task-automation-justfile). Read that contract first for the required recipes and the read-only `check` rule.

Go projects additionally require a `fmt` recipe, and `check` verifies formatting without rewriting files:

- `fmt` runs `golangci-lint fmt`, which rewrites files with the formatters enabled in the `formatters` section of `.golangci.yml` (`gofmt` when none are configured).
- `fmt-check` runs `golangci-lint fmt --diff`, which prints the diff and exits nonzero when any file is unformatted. `check` depends on it.
- Keep `fmt` and `fmt-check` on the same formatter configuration. Install `golangci-lint` as described in [Go CI and releases](github-ci-cd-releases.md).

Drop `run` and `run-ai` for libraries without an executable. Replace `<app-name>` with the actual binary name.

```justfile
set dotenv-load := false

binary_name := "<app-name>"

# List available tasks
default:
    @just --list

# Run the CLI in human mode
run *args:
    go run ./cmd/{{binary_name}} {{args}}

# Run the CLI in agent-facing mode
run-ai *args:
    AGENT=1 go run ./cmd/{{binary_name}} {{args}}

# Build the binary strictly into bin/
build:
    @mkdir -p bin
    go build -o bin/{{binary_name}} ./cmd/{{binary_name}}

# Run all tests with the race detector
test:
    go test -race ./...

# Apply formatting
fmt:
    golangci-lint fmt

# Fail on unformatted files without rewriting them
fmt-check:
    golangci-lint fmt --diff

# Check module hygiene and run vet + linter
lint:
    go mod tidy -diff
    go vet ./...
    golangci-lint run

# Validate without modifying files
check: fmt-check lint test

# Remove build artifacts
clean:
    rm -rf bin/
```
