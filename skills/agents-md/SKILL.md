---
name: agents-md
description: Generate, audit, refactor, split, and maintain canonical repository AGENTS.md files for AI coding agents. Use when creating a new AGENTS.md, tightening a stale or bloated AGENTS.md, adding nested AGENTS.md files for monorepos, or improving commands, boundaries, non-obvious patterns, and validation guidance without duplicating README or framework docs.
---

# AGENTS.md

This skill is for the canonical repository `AGENTS.md` format.

Do **not** confuse it with GitHub Copilot custom agent persona files under `.github/agents/*.md`. Some external guidance is useful for command placement, boundaries, and examples, but the output shape is different, so this skill targets only canonical repository `AGENTS.md` files.

## Core principles

- Human-curate from repository evidence. Do not blindly auto-generate and commit.
- Include only details the agent cannot reliably infer from code and existing docs.
- Put executable commands early and include flags when they matter.
- Prefer one real example or gotcha over paragraphs of generic advice.
- Make boundaries explicit with `Always`, `Ask first`, and `Never` when risk is non-trivial.
- Keep the root file lean. Split into nested `AGENTS.md` files when module rules diverge.
- Treat `AGENTS.md` as the source of truth.

## Required discovery before writing

Inspect all of the following before drafting or editing:

- lockfiles, manifests, workspace files, and task runners
- `package.json`/`Makefile`/`justfile`/`Taskfile`/language-specific build files
- CI workflows and release automation
- existing `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, and relevant docs
- at least one canonical code example in each major area you document
- monorepo and package boundaries

Never invent commands, folders, or rules.

## Choose the file topology

- Use **root only** for a single-package repo with mostly shared rules.
- Use **root + nested files** when apps/packages/services have different commands, stacks, or constraints.
- If the root file would exceed roughly 100 lines or starts carrying directory-specific rules, split it.
- Keep the root file focused on shared commands, shared boundaries, and navigation to deeper files.

Read `references/generation.md` for the topology and content-selection workflow.

## Authoring workflow

1. Discover repository facts and decide whether this is a create, refactor, or maintenance task.
2. Read `references/generation.md` for file topology, content selection, and section order.
3. If `AGENTS.md` already exists, read `references/maintenance.md` before rewriting anything substantial.
4. Draft or tighten the root file and any needed nested files using `references/templates.md`.
5. Run `references/checklist.md` before finalizing.
6. Validate commands, linked paths, and scope boundaries.
7. When updating an existing file, report findings and proposed diffs before destructive rewrites.

## Include

- exact install, dev, test, build, lint, and typecheck commands when applicable
- file-scoped or package-scoped commands when they materially reduce cost and runtime
- setup or bootstrap facts only when they are non-obvious and required to execute work
- non-standard tooling choices and version-sensitive constraints
- project-specific gotchas with corrective actions
- implementation-affecting conventions and example file paths
- explicit do-not-touch zones and approval boundaries
- nested-file pointers for monorepos and multi-package repos
- commit or PR rules only when they are repository-specific and enforced

## Exclude

- framework tutorials and architecture essays
- exhaustive folder trees and copy-pasted docs
- linter or formatter rules already enforced by config unless agents repeatedly violate a non-obvious exception
- generic advice like “follow best practices”
- speculative or aspirational rules not grounded in current repository reality
- stale paths, commands, or historical notes

## Reference guide

- Read `references/generation.md` when creating from scratch, splitting files, or deciding what belongs in root vs nested files.
- Read `references/maintenance.md` when auditing, scoring, pruning, or incrementally updating an existing file.
- Read `references/templates.md` when drafting root or nested files.
- Read `references/checklist.md` before you finalize changes.
