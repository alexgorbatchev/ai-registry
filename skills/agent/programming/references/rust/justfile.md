# Rust justfile

Rust implementation of the [task automation contract](../cli/best-practices.md#task-automation-justfile). Read that contract first for the required recipes and the read-only `check` rule. Adjust package selection and features to the supported configuration, as described in [Rust testing and releases](testing-and-releases.md).

Drop `run` and `run-ai` for libraries without an executable. Replace `mytool` with the actual binary name.

```justfile
set dotenv-load := false

# Run the CLI in human mode
run *args:
    cargo run -- {{args}}

# Run the CLI in agent-facing mode
run-ai *args:
    AGENT=1 cargo run -- {{args}}

# Run the test suite
test:
    cargo test --workspace --locked

# Apply formatting
fmt:
    cargo fmt --all

# Fail on unformatted files without rewriting them
fmt-check:
    cargo fmt --all -- --check

# Run Clippy with warnings as errors
lint:
    cargo clippy --workspace --all-targets --locked -- -D warnings

# Validate without modifying files
check: fmt-check lint test

# Build the release binary into bin/
build:
    cargo build --release --locked
    mkdir -p bin
    cp target/release/mytool bin/
```
