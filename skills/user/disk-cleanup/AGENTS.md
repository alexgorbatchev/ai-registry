---
created_on: '2026-10-05 07:24'
last_modified: '2026-10-18 15:22'
status: current
---

Maintain the portable development-folder cleanup skill and its Bun scripts in this directory.

- Install locked dependencies: `bun install --frozen-lockfile`.
- Run type checks, lint, and behavioral tests: `bun run check`.
- Use Oxlint and Oxfmt for linting and formatting: `bun run lint` checks both; `bun run fix` applies fixes.
- Run the tool for agents: `bun run run-ai skill`, then `bun run run-ai disk assess --root <target>`.
- General disk-space requests require the combined assessment before cleanup recommendations or deletion questions.
  Await all sections, include large development paths alongside caches, preserve partial command output, and expose
  every inspection failure. Never report a pending or failed assessment as complete.
- Keep test fixtures and verification artifacts in `.tmp/`; tests must never delete real project data.

Update `SKILL.md` and its `last_modified` in the same change as any command, argument, option, default,
environment handling, output, error, or filesystem side-effect change. Check the skill against the live Commander
command tree; preserve verbatim `skill` output and the single alert on every agent help path.

Use real disposable Git repositories for cleanup tests. Keep removal previews read-only. Preserve the root `.tmp`
container because execution logs live there; reject deletions that would remove those logs.
Keep worktree deletion in native Git and preserve tracked files, ignored files, branch/tag reachability, and locks.
Do not replace failed Git inspection with an inactivity guess or add `--force` to make removal pass.

Automatically record explicit standing user instructions, such as “always do X” or “never do Y,” in the narrowest applicable `AGENTS.md` or existing policy file without requiring a separate request to save them. Update an existing rule in place when the user clearly changes it. Keep one-task directions, progress, and session data out of policy files. Ask only when the intended policy scope or resolution of a material conflict is unclear.
For runtime-changing code outside `scripts/`, change a test file and maintain 90% coverage. This coverage rule
excludes `scripts/`; its deletion behavior must still have real behavioral tests.
Use existing user authorization for cleanup. Request missing authorization after presenting exact deletion targets.
Never publish releases, tags, packages, or production deployments without explicit user authorization.
