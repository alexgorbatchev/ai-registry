---
name: internal-docs-writer
description: 'Write, rewrite, and update internal Markdown documentation for maintainers, operators, and collaborators. Use when creating repo-local process docs, runbooks, decision notes, or reference material that should default to `docs/internal/` and must include `created_on`, `last_modified`, and `status: current|archived` frontmatter.'
author: alexgorbatchev
---

# Internal Docs Writer

Write internal documentation for people who work inside the repository or organization. Default new files to `docs/internal/`, keep the content grounded in source materials, and enforce the required Markdown frontmatter contract on every file.

## Workflow

1. Identify the documentation job.
- Determine whether the request is for a runbook, procedure, decision note, onboarding guide, architecture note, or reference page.
- Prefer updating an existing document when the topic already has a canonical home.

2. Choose the default location.
- Write new internal docs to `docs/internal/` relative to the repository root unless the user or repository already defines a different canonical location.
- Create `docs/internal/` if it does not exist.
- Use descriptive `kebab-case` filenames such as `docs/internal/deploy-runbook.md` or `docs/internal/auth/session-lifecycle.md`.
- Create subdirectories only when they improve navigation for multiple related documents.

3. Build from source material.
- Read the code, configuration, scripts, tests, and existing docs that support the content.
- Do not invent system behavior, guarantees, URLs, commands, or ownership details.
- Mark unknowns explicitly instead of guessing.

4. Apply the required frontmatter.
- Start every internal Markdown file with YAML frontmatter containing at least these required keys:

```yaml
---
created_on: 2026-04-23 14:00
last_modified: 2026-04-23 14:00
status: current
---
```

- Use the `YYYY-MM-DD HH:MM` timestamp format.
- Set `created_on` and `last_modified` to the same timestamp when creating a new file.
- Preserve `created_on` and update only `last_modified` when editing an existing file.
- Use only `current` or `archived` for `status`.
- Switch to `archived` when the document is superseded or no longer the active source of truth.

5. Write for internal readers.
- Put the purpose and audience near the top.
- Prefer current-state instructions and facts over change narration.
- Keep procedures ordered, concrete, and copy-pasteable where possible.
- Use headings that let readers scan quickly.
- Use role-based language rather than personal names when possible.

6. Protect sensitive information.
- Do not write secrets, private keys, raw tokens, or unredacted credentials into docs.
- Avoid unnecessary private hostnames or internal URLs unless they are already an accepted checked-in convention for the repository.
- Sanitize examples when the real values are not required.

7. Keep docs coherent over time.
- Rewrite surrounding sections so the document reads as one maintained artifact, not a stack of patches.
- Archive or replace stale guidance instead of adding contradictory footnotes.
- When archiving, add a short note near the top that points to the current replacement if one exists.

## Default Output Rule

- Default new files to `docs/internal/`.
- Deviate only when the user explicitly requests another location or repository conventions clearly assign the topic elsewhere.
- Treat `docs/internal/` as the canonical home for internal-only Markdown docs, not public product docs such as `README.md`.

## Current And Archived States

- Use `status: current` for active guidance people should follow today.
- Use `status: archived` for superseded or historical docs that are kept only for reference.
- Do not invent extra lifecycle values such as `draft`, `deprecated`, or `final` unless the user explicitly changes the schema.
- For a current doc, describe the expected present-state process or system behavior.
- For an archived doc, keep the historical content intact but make its archived state obvious near the top.

## Final Checklist

- File lives under `docs/internal/` unless there is a verified exception.
- Frontmatter includes `created_on`, `last_modified`, and `status`.
- Timestamps use `YYYY-MM-DD HH:MM`.
- `status` is exactly `current` or `archived`.
- Claims are grounded in the repository or supplied materials.
- Sensitive values are omitted or sanitized.
- The document reads as a maintained internal reference, not a PR summary or assistant note.
