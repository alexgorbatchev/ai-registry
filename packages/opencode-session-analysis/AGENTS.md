# OpenCode Session Analysis Package

This package provides tools and CLI commands for analyzing OpenCode session logs and skill usage.

## Commands

- Test: `bun test packages/opencode-session-analysis`

## Boundaries & Quality Rules

- Any time code is changed such that results from running that code are changed, a test file must be changed as well.
- Minimum 90% code coverage is required (the `scripts/` folder is excluded from this rule).
