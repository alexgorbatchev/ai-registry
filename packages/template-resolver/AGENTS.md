# Template Resolver Package

This package renders trusted repository text with EJS, preserving source filenames.

## Contracts

- Use EJS's native renderer, delimiters, expressions, control flow, escaping, and include mechanism. Do not add a custom template parser or legacy syntax compatibility.
- Pass the original source path as EJS's filename. Keep file_path and file_dir bound to that original file across nested includes.
- Set root and views to the repository root. Use include("/system/system.md") for explicit repository-root-relative includes; relative includes follow EJS filename resolution.
- Reject resolved include paths outside the repository root.
- Expose env(name, fallback?) from the caller-supplied environment. Missing values without a fallback fail; empty strings remain valid.
- Use raw output tags for plain text and paths. Escaped output tags retain native HTML escaping.
- Render each file exactly once. Literal EJS opening delimiters use <%%.
- Treat templates as trusted JavaScript code. Curly-brace syntax belongs to other tools and passes through unchanged.
- Sync-back supports canonical raw path-variable tags only. Edit expressions, includes, and control flow at their source.

## Validation

- Tests use the registry-cli fixture factories through `src/__tests__/fixtures.ts`; the preload owns the run root, and `just test` supervises child processes and scratch cleanup. Typechecking is non-emitting so tests can share repository fixtures.
- Run `just template-resolver check` and `just registry-cli test` from the repository root. `check` runs Oxfmt and Oxlint checks, the type check, ts-unused in package mode, and tests.
- Run `just build` after resolver behavior changes and inspect generated outputs.
- For executable behavior changes, add or update meaningful behavioral tests and apply the root [testing and coverage policy](../../AGENTS.md#development-workflow): at least 90% line coverage and 90% function coverage across this package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; handle blocking baseline failures under the prerequisite-repair policy. Do not weaken gates or make token test edits.
