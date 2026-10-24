# OpenCode Session Analysis Package

This package provides tools and CLI commands for analyzing OpenCode session logs and skill usage.

## Commands

- Test: `bun test packages/opencode-session-analysis`

## Boundaries & Quality Rules

- For executable behavior changes, add or update meaningful behavioral tests and apply the root [testing and coverage policy](../../AGENTS.md#development-workflow): at least 90% line coverage and 90% function coverage across this package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; handle blocking baseline failures under the prerequisite-repair policy. Do not weaken gates or make token test edits.
