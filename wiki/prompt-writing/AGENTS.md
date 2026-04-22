---
created_on: "2026-04-19 17:38"
author: "openai/gpt-5.4"
---

# Prompt Writing

This directory stores a generated corpus of official prompt-writing and context-engineering docs under `wiki/prompt-writing/<provider>/`.

## Commands

- Regenerate corpus: `bun wiki/prompt-writing/scripts/download-prompt-writing.ts`
- Inspect changed files: `git status --short wiki/prompt-writing`

## Local Conventions

- Treat provider article files and `README.md` as generated output from `wiki/prompt-writing/scripts/download-prompt-writing.ts`.
- Parent `wiki/AGENTS.md` still applies: generated article files must include `created_on` and `source_url` when available.
- Omit `author` on script-generated pages; keep it on hand-written docs in this subtree.
- Keep `published` truthful. If a source does not expose a trustworthy publish date, leave `published: "unavailable"` and preserve the official metadata in `date_status` and `source_date`.

## Boundaries

- Always: rerun the script after editing entry metadata, frontmatter fields, or cleanup logic.
- Ask first: expanding the provider list or changing the inclusion/date-policy rules.
- Never: hand-edit generated provider markdown without porting the fix back into the script, or invent publication dates from proxy or HTTP response timestamps.

## References

- `wiki/AGENTS.md`
- `wiki/prompt-writing/README.md`
- `wiki/prompt-writing/scripts/download-prompt-writing.ts`
