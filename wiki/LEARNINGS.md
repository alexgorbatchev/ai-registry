---
created_on: 2026-04-21 00:00
author: openai/gpt-5.4
source_url: null
file_kind: learnings
scope: cross-project
compaction_threshold: 10
changes_since_compaction: 2
last_compacted_at: null
---

# Learnings

This file stores durable engineering wisdom that should generalize across work in this repository.

## Scripts Layout

- Put TypeScript helper modules that are imported by other scripts under `scripts/lib/`, not directly under `scripts/`.
- Use dash-based filenames for executable script entrypoints (for example `install-git-hooks.ts`), not camelCase names.

## Build-time Template Tags In Runnable Code

- If a runnable source script contains build-time template tags such as `{{repo_root}}`, give it a runtime fallback for the unresolved placeholder so the source file still works before generated output templating runs.
