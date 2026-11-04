---
name: programming
description: MUST USE anytime working with Go, Python, Rust, TypeScript, Bun, Tailwind, Swift, shell scripts, or justfiles.
author: alexgorbatchev
metadata:
  created_on: 2026-10-15 16:55
  last_modified: 2026-11-04 10:21
  status: current
---

## Required reading

Inspect the task's files, manifests, toolchain configuration, and repository instructions. Read every matching baseline below before working, then read the topic references required by the task. For mixed-language projects, apply each language's rules to its own files. Combine language, runtime, UI, and automation guidance when their scopes overlap.

| Working with | Read first |
| --- | --- |
| Go code, projects, tooling, or build storage | [Go conventions](references/go/conventions.md) |
| Python execution, dependencies, environments, or tooling | [Python tooling](references/python/tooling.md) |
| Rust code, Cargo projects, or build storage | [Rust conventions](references/rust/conventions.md) |
| Reading or writing TypeScript, including TSX | [TypeScript conventions](references/typescript/conventions.md) |
| Bun execution, dependencies, builds, or runtime APIs | [Bun runtime](references/bun/runtime.md) |
| Tailwind integration, theme tokens, or utility scanning | [Bun/Tailwind integration](references/bun-tailwind/integration.md) and [setup](references/bun-tailwind/setup.md); apply Bun-specific wiring when the project uses Bun |
| Creating, structuring, or refactoring justfiles | [Modular justfiles](references/just/modular-justfiles.md) |

Swift and shell scripts have no language baseline here; for them, follow the project's own conventions and the work-tracking and POC sections below. Keep language-specific naming, types, error handling, ownership, and abstraction rules within their language. Select runtime commands from the actual project's tooling; Bun commands apply to Bun projects. Verify unfamiliar APIs against the installed version's source or official documentation.

## Topic references

Read each matching reference before reaching its domain:

| Task | Required references |
| --- | --- |
| Starting, restructuring, building, or releasing a Go project | [Go setup](references/go/setup.md) |
| Go CI, tagged releases, or binary version metadata | [Go CI and releases](references/go/github-ci-cd-releases.md); templates: [CI](references/go/github-actions-ci.yml), [release](references/go/github-actions-release.yml), [GoReleaser](references/go/goreleaser.yml) |
| Choosing recent Go idioms or upgrading Go tooling | [Go release notes](references/go/go-release-notes.md) |
| Designing Go function signatures | [Go parameter design](references/go/parameter-design.md) |
| Go builds, tests, coverage, profiling, or storage cleanup | [Go disk usage](references/go/disk-usage.md) |
| Rust package layout, toolchains, dependencies, features, or CLI setup | [Rust setup](references/rust/setup.md) |
| Rust tests, CI, coverage, packaging, or publishing | [Rust testing and releases](references/rust/testing-and-releases.md) |
| Rust builds, tests, coverage, profile changes, or artifact cleanup | [Rust disk usage](references/rust/disk-usage.md) |
| TypeScript tests | [TypeScript testing](references/typescript/testing.md) |
| TypeScript 7 migration or compiler coexistence | [TypeScript 7 update](references/typescript/typescript-7-update.md) |
| React components or tests | [React development](references/typescript/react-development.md) and [React testing](references/typescript/react-testing.md) |
| Storybook stories or browser interaction tests | [Storybook](references/typescript/storybook.md) |
| Storybook installation or configuration | [Storybook setup](references/typescript/storybook-setup.md) |
| Storybook failures | [Storybook debugging](references/typescript/storybook-debugging.md) |
| Bun bundling or compilation | [Bun bundling](references/bun/bundling.md) |
| Bun React projects, React Compiler, or the shared React lint and format policy | [Bun React Compiler](references/bun/react-compiler.md) |
| Bun S3/R2 storage | [Bun S3](references/bun/s3.md) |
| Bun Redis/Valkey clients | [Bun Redis](references/bun/redis.md) |
| Bun tar/gzip archives | [Bun archives](references/bun/archive.md) |
| Bun utilities or cryptography | [Bun utilities](references/bun/utilities.md) |

## Work tracking

Track every task that changes project code or configuration with the `issue-tracker` CLI. Set `AGENT=1` on every invocation and run `AGENT=1 issue-tracker --help` for command details.

1. Before changing files, claim the task's ticket with `issue-tracker issue claim <number>`. When no ticket covers the task, create one with `issue-tracker issue create` and claim it. Register an unregistered repository with `issue-tracker project add`.
2. Record unrelated problems found along the way as new tickets with `--discovered-from <number>` instead of folding them into the current task.
3. Close the ticket with `issue-tracker issue close <number> --pr <pull-request>` after its pull request merges, or with `--reason completed` when the work was committed directly to `main`. Run `issue-tracker issue release <number>` when stopping before the work is done.
4. Follow any `WARN:` line printed for a public project: keep ticket text, attachments, ticket numbers, and the tracker repository name out of its commits, pull requests, and branch names.

If the CLI is missing or fails on authentication, report the exact error and the command that resolves it, continue the code work, and list the untracked work so it can be recorded afterward.

## POC projects

A project is in POC when its root `AGENTS.md` contains this exact line:

```text
POC mode: merge directly to main; skip tests unless requested.
```

When the user turns POC on, add that line directly below the file's first heading, creating `AGENTS.md` with a `# <project name>` heading if it does not exist. When the user turns POC off, delete the line. Change nothing else in the file for the toggle, and commit it like any other task change.

While POC is on:

- Integrate work into `main` directly: commit on `main`, or merge a task branch or worktree into `main` locally, then push. Do not open pull requests. Never force-push or bypass branch protection; report a rejected push.
- Do not write, update, or run tests, and do not apply coverage requirements, unless the user requests tests for the current task. This overrides test and coverage rules in repository and shared guidance. Run the project's other required checks, such as formatting, linting, type checking, and builds.
- Start the `DUE DILIGENCE` section with this exact unnumbered line, and include the section even when nothing else is reported:

  ```text
  POC: tests and PRs skipped (non-actionable).
  ```

  Do not report missing tests, missing coverage, or skipped pull requests as due diligence items.

## Missing context and completion

If a required reference, toolchain, dependency contract, or project configuration is unavailable, record what is missing, the affected work, attempted recovery, and the input needed to resume. Suspend only dependent work and continue independent authorized work. Do not invent missing contracts or substitute another language's rules.

Run the project's required checks for the affected languages and tooling, excluding tests while POC is on. Report executed results and material limitations; a reference walkthrough is not an executed check.
