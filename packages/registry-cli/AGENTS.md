# Registry CLI Package

This package implements the repository build, bootstrap, and synchronization commands for harness configuration output generation.

## Commands

- Dev / Build: `bun run build` from repository root
- Test: `bun test packages/registry-cli`
- Scheduled update: `bun run scheduled:update` from repository root; the entrypoint owns runtime directory creation, logging, and the native macOS/Linux lock for both manual and scheduled runs. Keep only the last 48 hours of timestamped output in `.tmp/scheduled-update.log`, pruning under the same lock as all log writes and worker execution. Do not add an outer scheduler lock or invoke its internal logger or worker directly. `AI_REGISTRY_SCHEDULED_WORKER` is internal launcher-to-logger transport, not user configuration.

## Boundaries & Quality Rules

- For executable behavior changes, add or update meaningful behavioral tests and apply the root [testing and coverage policy](../../AGENTS.md#development-workflow): at least 90% line coverage and 90% function coverage across this package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; handle blocking baseline failures under the prerequisite-repair policy. Do not weaken gates or make token test edits.
- Always verify generated harness outputs in `.output/` after changing build or harness logic.
