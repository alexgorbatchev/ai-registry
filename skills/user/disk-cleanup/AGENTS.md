---
created_on: '2026-10-05 07:24'
last_modified: '2026-10-05 07:24'
status: current
---

Maintain the portable development-folder cleanup skill and its Bun scripts in this directory.

- Install locked dependencies: `bun install --frozen-lockfile`.
- Run type checks, lint, and behavioral tests: `bun run check`.
- Run the tool for agents: `bun run run-ai skill`, then `bun run run-ai disk inspect --root <target>`.
- Keep test fixtures and verification artifacts in `.tmp/`; tests must never delete real project data.

Update `SKILL.md` and its `last_modified` in the same change as any command, argument, option, default,
environment handling, output, error, or filesystem side-effect change. Check the skill against the live Commander
command tree; preserve verbatim `skill` output and the single alert on every agent help path.

Use real disposable Git repositories for cleanup tests. Keep removal previews read-only. Preserve the root `.tmp`
container because execution logs live there; reject deletions that would remove those logs.
Keep worktree deletion in native Git and preserve tracked files, ignored files, branch/tag reachability, and locks.
Do not replace failed Git inspection with an inactivity guess or add `--force` to make removal pass.

Record new user instructions in the most appropriate `AGENTS.md`; ask before changing conflicting instructions.
For runtime-changing code outside `scripts/`, change a test file and maintain 90% coverage. This coverage rule
excludes `scripts/`; its deletion behavior must still have real behavioral tests.
Use existing user authorization for cleanup. Request missing authorization after presenting exact deletion targets.
Never publish releases, tags, packages, or production deployments without explicit user authorization.
