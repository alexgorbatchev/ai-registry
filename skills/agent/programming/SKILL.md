---
name: programming
description: Use when designing, implementing, debugging, refactoring, testing, documenting, reviewing software, or managing software releases, including application code, scripts, development tooling, and command-line interfaces.
author: alexgorbatchev
metadata:
  created_on: 2026-10-15 16:55
  last_modified: 2026-11-10 14:46
  status: current
---

## Execute the task

1. Establish the requested outcome and affected files from the user request and repository instructions. Inspect manifests, lockfiles, toolchain configuration, development recipes, and relevant implementation before choosing commands or changing files.
2. Select and read every applicable baseline in **Language and tooling references**. Read matching **Topic references** before working in those domains. Apply each language's rules to its own files; combine runtime, UI, CLI, and automation rules where their scopes overlap.
3. Apply **Work tracking** before editing code or configuration. If the root `AGENTS.md` mentions POC mode or the user requests a POC toggle, read [POC projects](references/poc-projects.md) before choosing an integration or testing workflow.
4. Before selecting checks, changing executable behavior, or defining testing and coverage policy, read [testing and coverage](references/testing-and-coverage.md). Apply **Implementation rules** and perform the authorized work using the selected references and project conventions. Select commands from the actual project's tooling; apply Bun commands to Bun projects. Keep language-specific naming, types, error handling, ownership, and abstraction rules within their language. Verify unfamiliar APIs against the installed version's source or official documentation rather than inventing contracts.
5. Apply **Development artifacts**, **Test cleanup**, and **CI dependency caching** whenever the work reaches those areas. Run the applicable checks and finish under **Verify and report**.

For languages without a bundled baseline, use the project's language conventions and this skill's shared rules. Do not substitute an unrelated language's rules.

## Implementation rules

- Do not introduce backward-compatibility layers, migrations, or shims for old behavior unless explicitly requested.
- Implement the required behavior; do not substitute stubs, mock layers, or shallow code for a working implementation. Satisfy the intent of checks and project requirements rather than evading them through cosmetic renaming, hidden files, or inline stubs. Verify applicable platform semantics, accessibility, type safety, security, and performance requirements before declaring completion.
- Choose the native primitive whose semantics match the requirement. Do not emulate an available suitable primitive with wrappers or overrides. Use supported extension points without violating the primitive's semantic or lifecycle contracts.
- Distinguish user-visible defects from tooling gaps, theoretical edge cases, and failures introduced by a proposed repair. A missing coverage-report entry alone proves neither a product defect nor insufficient coverage. Preserve applicable testing and coverage requirements; establish why an investigation or repair is necessary before adding process supervision, infrastructure, or a broad dependency investigation.

### Libraries and dependencies

Before implementing a feature, inspect existing dependencies and maintained libraries within the task's required capabilities. Use native or standard-library functionality when it meets the requirements; otherwise prefer a suitable library over custom implementation. Write custom functionality only when suitable existing solutions cannot meet the requirements.

Integrate libraries through their intended APIs and capabilities. When a library is explicitly requested, perform the required integration rather than wrapping existing code in a compatibility layer that bypasses the library.

## Language and tooling references

- [Go conventions](references/go/conventions.md).
- [Python tooling](references/python/tooling.md).
- [Rust conventions](references/rust/conventions.md).
- [TypeScript conventions](references/typescript/conventions.md), including TSX.
- [Bun runtime](references/bun/runtime.md).
- Tailwind integration, theme tokens, or utility scanning: read [integration](references/bun-tailwind/integration.md) and [setup](references/bun-tailwind/setup.md); apply Bun-specific wiring only in Bun projects.
- Justfiles or development tasks: read [task automation](references/cli/best-practices.md#task-automation-justfile), [modular justfiles](references/just/modular-justfiles.md), and the matching template: [Go](references/go/justfile.md), [Python](references/python/justfile.md), [Rust](references/rust/justfile.md), or [Bun](references/bun/justfile.md).
- CLI applications: read [best practices](references/cli/best-practices.md) and the matching language guide: [Go](references/go/cli.md), [Python](references/python/cli.md), [Rust](references/rust/cli.md), or [TypeScript](references/typescript/cli.md).

## Topic references

Read each reference when its topic applies. Use these additional routing conditions:

- [Release policy](references/releases.md): creating, editing, publishing, or verifying releases, release notes, tags, or assets.
- [Go setup](references/go/setup.md): project creation, restructuring, builds, or releases.
- [Go CI and releases](references/go/github-ci-cd-releases.md): include tagged releases and binary version metadata. Templates: [CI](references/go/github-actions-ci.yml), [release](references/go/github-actions-release.yml), [GoReleaser](references/go/goreleaser.yml).
- [Go release notes](references/go/go-release-notes.md): recent idioms or tooling upgrades.
- [Go parameter design](references/go/parameter-design.md): function signatures.
- [Go disk usage](references/go/disk-usage.md): builds, tests, coverage, profiling, or storage cleanup.
- [Rust setup](references/rust/setup.md): package layout, toolchains, dependencies, features, or CLI setup.
- [Rust testing and releases](references/rust/testing-and-releases.md): include CI, coverage, packaging, and publishing.
- [Rust disk usage](references/rust/disk-usage.md): builds, tests, coverage, profile changes, or artifact cleanup.
- [TypeScript testing](references/typescript/testing.md).
- [TypeScript 7 update](references/typescript/typescript-7-update.md): migration or compiler coexistence.
- [React development](references/typescript/react-development.md) and [React testing](references/typescript/react-testing.md): read both for components or tests.
- [Storybook](references/typescript/storybook.md): stories or browser interaction tests.
- [Storybook setup](references/typescript/storybook-setup.md): installation or configuration.
- [Storybook debugging](references/typescript/storybook-debugging.md): failures.
- [Bun bundling](references/bun/bundling.md): include compilation.
- [Bun React Compiler](references/bun/react-compiler.md): Bun React projects or the shared React lint and format policy.
- [Bun S3/R2](references/bun/s3.md).
- [Bun Redis/Valkey](references/bun/redis.md).
- [Bun tar/gzip archives](references/bun/archive.md).
- [Bun utilities and cryptography](references/bun/utilities.md).

## Development artifacts

1. Choose storage before creating an artifact. Put disposable scratch files, build and test intermediates, drafts, captured output, and toolchain temporary directories in the project's git-ignored `.tmp/`. Put files that must outlive the session in git-ignored root directories: `.cache/` for regenerable caches and mirrors; `.state/` for state, locks, queues, and retained logs or reports. Never rely on `.tmp/` surviving a session.
2. Give each build command a unique owned `.tmp/` child. Scope build-tool temporary variables to that command (`GOTMPDIR` for Go, `TMPDIR` for a Bun build). Remove that child after its last consumer finishes, including on failure or cancellation. Remove only paths you created; never wipe `.tmp/` by name.
3. Keep test suites on the system temporary directory. Do not globally export project-local overrides into tests through `TMPDIR`, `TMP`, `TEMP`, or `GOTMPDIR`: long paths can exceed Unix socket limits, home paths can change path rendering, and Git discovery can reach the enclosing project. If compilation and test execution share an environment, retain system-temp defaults unless build-only overrides can be removed before tests start. Make tests own and remove their temporary files under **Test cleanup**.
4. Create Unix domain sockets in a short, unique per-run directory such as `/tmp/<project>-XXXXXX`. Stop its consumers before removing that exact directory on exit, failure, or cancellation. Never reuse a predictable shared socket directory.

## Test cleanup

1. When adding or changing tests, capture a baseline of the system temporary directory, the project's `.tmp/`, and the process list before running them.
2. Register cleanup for everything each test creates: files and directories in the project, system temp, home, or caches, and every child process, process group, server, or browser. Make cleanup run on success, failure, timeout, and cancellation.
3. Stop child processes by signaling their process group to terminate, waiting a bounded grace period, then killing remaining processes. Allow graceful termination to remove process-owned files before deleting their directories.
4. Compare the directories and process list after the run against the baseline and report leftovers. Fix leaks in tests changed by this task. Record leaks in other existing tests under **Work tracking**; the cleanup requirement applies to existing tests too.

## CI dependency caching

1. When adding or changing CI, restore or prebuild heavy dependencies rather than reinstalling toolchains, package-manager downloads, browsers, and system packages from scratch on every run.
2. Cache package and toolchain downloads between runs, keyed by the lockfile or tool version. Keep setup actions' built-in caching enabled (for example `actions/setup-go`, `actions/setup-node`, and `golangci/golangci-lint-action`). Add `actions/cache` only for downloads those actions do not cover.
3. Use a prebuilt container image for system packages installed with `apt` or similar; do not treat a download cache as a reliable system-package restore. For Playwright, set the job's `container:` to the official `mcr.microsoft.com/playwright:v<version>` image matching the project's Playwright version rather than running `playwright install --with-deps` on every run.
4. Read step timings from a real run after changing the job. If a dependency or setup step dominates its duration, fix it in the same change or record it under **Work tracking**. If a run is unavailable, report timing verification as unrun under **Verify and report**.

## Work tracking

Track every task that changes project code or configuration with the `issue-tracker` CLI before editing. Use the installed `issue-tracker` skill for ticket lifecycle, discovery links, CLI commands, and public-project privacy rules. If that skill is unavailable, consult `AGENT=1 issue-tracker --help` and the relevant subcommand help. Set `AGENT=1` on every invocation.

Keep the tracker repository, projects, and boards private even when the code repository is public. Treat tickets as approved work; do not ask for separate approval to manage or implement them.

If the CLI is missing or authentication fails, report the exact error and the recovery command supported by the CLI or its documentation. Continue the code work and list untracked work for later recording; do not invent a recovery command.

## Verify and report

1. Run the project's required checks for the affected languages and tooling, including `just check` under the [task automation contract](references/cli/best-practices.md#task-automation-justfile). While POC is on, run the non-test recipes `check` depends on instead of `check` itself.
2. If a required reference, toolchain, dependency contract, or configuration is unavailable, attempt recovery using available project sources or official documentation. Record what is missing, the affected work, attempted recovery, and the exact input needed to resume. Suspend only dependent work and continue independent authorized work. Do not invent contracts or substitute another language's rules.
3. Inspect the final diff for task scope and applicable reference requirements. Complete task-owned cleanup and update the ticket under **Work tracking** according to the actual integration state.
4. Report the resulting behavior or artifact, executed checks and results, checks left unrun, and material limitations or blockers. Include any remaining test artifacts or processes and follow-up work. Distinguish reference walkthroughs from executed checks, and do not claim completion while required work remains blocked. Apply the POC reporting rule when its marker is present.
