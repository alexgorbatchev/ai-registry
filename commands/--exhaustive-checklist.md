---
description: Write a target markdown file as an exhaustive completion checklist without implementation guidance
---

Write a target Markdown file containing an exhaustive completion checklist.

## Task

Produce a repository-grounded, exhaustive guard checklist for task completion criteria.

This file is for a different agent that will perform the work and check items off during execution. Your job is to define the completion contract, not the implementation plan.

## Inputs

You will be given:

- a target file path such as `<checklist-doc-path>`

If the target file path is not provided, stop and ask for it before doing any repository analysis or writing any files.

## Grounding

Before writing `<checklist-doc-path>`:

1. Read the repository instructions and any language-, framework-, or runtime-specific guidance that governs changes.
2. Inspect the actual project surface, including manifests, modules or packages, tests, scripts, CI, linting, docs, config, and any public interfaces.
3. Derive the checklist from verified project reality. Do not invent project-specific requirements.

If there is not enough evidence to write a grounded checklist, stop and explain the blocker instead of guessing.

## Constraints

- Write only `<checklist-doc-path>`.
- The file must contain only completion criteria and checklist items.
- Do not prescribe architecture, implementation steps, refactor strategy, or code patterns.
- Do not tell the implementing agent how to solve the task.
- Do not include filler prose, background essays, or generic best-practice discussion.
- Every checklist item must be observable and testable by another agent.
- Prefer specific completion conditions over vague wording such as `done`, `clean`, `better`, or `works`.
- If a requirement depends on evidence you cannot verify, either omit it or state the missing prerequisite explicitly in checklist form.
- Keep the checklist language generic to the repository unless the grounded evidence shows a language- or framework-specific contract that must be preserved.

## Output Contract

`<checklist-doc-path>` must be a Markdown checklist document.

Use this shape:

```md
# <Title>

## <category>
- [ ] <verifiable completion criterion>
```

## Required Behavior

- Organize the checklist into clear categories.
- Cover only completion criteria for the current task being truly finished and safe.
- Make the checklist exhaustive for the repository's actual affected surface area, based on the current request and repository context.
- Include guards for preserved behavior, interfaces, validation, tests, toolchain expectations, operational contracts, and documentation when those are relevant in the repository.
- Include repository-specific guard items for build commands, test commands, lint/type/static-analysis commands, generated artifacts, migrations, configuration, APIs, CLI behavior, storage contracts, concurrency, cancellation, error behavior, logging/metrics/tracing, and deployment or release expectations when applicable.
- Include compatibility and regression guards for any exported package APIs, wire formats, config formats, flags, environment variables, or persisted data that the work must not silently break.
- Include evidence-based negative guards when relevant, such as confirming no stubs, no skipped handlers, no dead code paths introduced by the work, and no mismatch between documented and implemented behavior.
- Phrase items so another agent can literally check them off while validating the work.

## Non-Goals

- No implementation instructions.
- No design document.
- No migration plan unless the repository already requires migration-related completion checks.
- No patch, code changes, or suggested refactor sequence.

## Final Check Before Finishing

Before you finish, verify all of the following:

- `<checklist-doc-path>` contains only checklist-oriented completion criteria.
- No item tells the implementer how to implement the task.
- Every item is grounded in repository evidence or clearly marked as a prerequisite gap.
- The checklist is specific enough that a second agent can use it as a working guardrail and signoff list.
