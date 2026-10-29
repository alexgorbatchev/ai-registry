---
name: programming
description: MUST USE anytime working with Go, Python, Rust, TypeScript, Bun, Tailwind, or justfiles.
author: alexgorbatchev
metadata:
  created_on: 2026-10-15 16:55
  last_modified: 2026-10-29 13:51
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

Keep language-specific naming, types, error handling, ownership, and abstraction rules within their language. Select runtime commands from the actual project's tooling; Bun commands apply to Bun projects. Verify unfamiliar APIs against the installed version's source or official documentation.

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
| Bun React Compiler or React lint configuration | [Bun React Compiler](references/bun/react-compiler.md) |
| Bun S3/R2 storage | [Bun S3](references/bun/s3.md) |
| Bun Redis/Valkey clients | [Bun Redis](references/bun/redis.md) |
| Bun tar/gzip archives | [Bun archives](references/bun/archive.md) |
| Bun utilities or cryptography | [Bun utilities](references/bun/utilities.md) |

## Missing context and completion

If a required reference, toolchain, dependency contract, or project configuration is unavailable, record what is missing, the affected work, attempted recovery, and the input needed to resume. Suspend only dependent work and continue independent authorized work. Do not invent missing contracts or substitute another language's rules.

Run the project's required checks for the affected languages and tooling. Report executed results and material limitations; a reference walkthrough is not an executed check.
