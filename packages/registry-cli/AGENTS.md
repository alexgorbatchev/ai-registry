# Registry CLI Package

This package implements the repository build, bootstrap, and synchronization commands for harness configuration output generation.

## Commands

- Dev / Build: `bun run build` from repository root
- Test: `bun test packages/registry-cli` from the repository root, or `bun test` from this package; tests resolve repository paths from their own location, never the working directory, and build tests copy `harnesses/` instead of building from it
- Coverage: `bun run coverage` from the repository root or this package. It runs `bun test` with lcov output in `.tmp/coverage/` and `src/bin/check-coverage.ts`, which fails below 90% line or 90% function coverage across all non-test `src/**/*.ts`, excluding `__tests__/` and `scripts/`. Files no test loads count as fully uncovered: every non-blank line and every function or arrow of their type-stripped code; type-only modules have no runtime code and are skipped.
- Scheduled update: `bun run scheduled:update` from repository root; the entrypoint owns runtime directory creation, logging, and the native macOS/Linux lock for both manual and scheduled runs. Keep only the last 48 hours of timestamped output in `.tmp/scheduled-update.log`, pruning under the same lock as all log writes and worker execution. Do not add an outer scheduler lock or invoke its internal logger or worker directly. `AI_REGISTRY_SCHEDULED_WORKER` is internal launcher-to-logger transport, not user configuration.

## Boundaries & Quality Rules

- For executable behavior changes, add or update meaningful behavioral tests and apply the root [testing and coverage policy](../../AGENTS.md#development-workflow): at least 90% line coverage and 90% function coverage across this package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; handle blocking baseline failures under the prerequisite-repair policy. Do not weaken gates or make token test edits.
- Always verify generated harness outputs in `.output/` after changing build or harness logic.
