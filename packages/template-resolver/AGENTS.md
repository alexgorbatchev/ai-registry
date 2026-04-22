# Template Resolver Package

This package implements the repository's build-time template resolver.

## Scope

- Keep this package text-only. Do not add JavaScript evaluation, loops, conditionals, filters, or custom helper execution.
- Supported template forms are limited to:
  - lower-snake-case string variables such as `{{ repo_root }}`
  - `{{ include "path/from/repo/root.txt" }}`
  - `{{ env "VAR_NAME" }}`
  - `{{ env "VAR_NAME" default "fallback" }}`
- Includes are always repository-root-relative.
- Includes must support recursive expansion.
- Circular includes, missing include files, unknown variables, invalid env names, and missing env vars without defaults must fail clearly.

## Compatibility Boundaries

- Preserve foreign templating syntax that this package does not own.
- In particular, `${{ ... }}` expressions and non-owned `{{ ... }}` forms such as Go-template placeholders must remain literal unless this package explicitly supports them.
- If you add a new supported template form, update both detection and tests in the same change.

## Files

- `src/index.ts`: package implementation and public API
- `src/index.test.ts`: Bun test coverage for supported syntax and regression cases
- `.tmp/`: package-local temporary test fixtures only

## Validation

- Run `bun test` from `packages/template-resolver` after changing package code or tests.
- Run `bun run build` from the repository root after changing resolver behavior, because the build pipeline is the main integration surface.

## Editing Notes

- Keep error messages specific enough to identify the failing source file and include chain.
- Prefer adding regression tests for real-world syntax collisions before widening the matcher.
