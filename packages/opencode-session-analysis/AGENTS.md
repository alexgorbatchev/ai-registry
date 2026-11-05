# OpenCode Session Analysis Package

This package provides tools and CLI commands for analyzing OpenCode session logs and skill usage.

## Commands

- Test: `just session-analysis test` from the repository root, or `just test` in this package
- Fixture lifecycle: import `factory_testDirectory` from `./fixtures` so each fixture registers cleanup immediately. The preload owns the run root and redirects `TMPDIR`; the test recipe uses registry-cli’s shared supervisor to stop child processes and remove scratch on failure, timeout, or interruption. Tests share the registry-cli fixture implementation, while the package’s TypeScript configuration remains non-emitting.
- Validate: `just session-analysis check` (Oxfmt and Oxlint checks, type check, ts-unused, CLI help smoke run, tests); `just session-analysis fix` applies formatting and lint fixes

## Boundaries & Quality Rules

- For executable behavior changes, add or update meaningful behavioral tests and apply the root [testing and coverage policy](../../AGENTS.md#development-workflow): at least 90% line coverage and 90% function coverage across this package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; handle blocking baseline failures under the prerequisite-repair policy. Do not weaken gates or make token test edits.
