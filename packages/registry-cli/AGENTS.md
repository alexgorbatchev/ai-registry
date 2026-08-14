# Registry CLI Package

This package implements the repository build, bootstrap, and synchronization commands for harness configuration output generation.

## Commands

- Dev / Build: `bun run build` from repository root
- Test: `bun test packages/registry-cli`

## Boundaries & Quality Rules

- Any time code is changed such that results from running that code are changed, a test file must be changed as well.
- Minimum 90% code coverage is required (the `scripts/` folder is excluded from this rule).
- Always verify generated harness outputs in `.output/` after changing build or harness logic.
