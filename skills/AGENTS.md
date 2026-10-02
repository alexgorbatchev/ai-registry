---
created_on: 2026-10-01 11:46
last_modified: 2026-10-01 21:18
status: current
---

# Generic Skills

This directory contains reusable skills that must work across harnesses.

## Harness Boundary

- Never place harness-specific instructions in generic skills under `skills/agent/` or `skills/user/`. This applies to `SKILL.md` and all bundled references, scripts, templates, and assets.
- Place harness-specific instructions under `harnesses/<target>/skills/agent/<skill-name>/` or `harnesses/<target>/skills/user/<skill-name>/`, according to the skill's invocation type.
- Keep harness-specific tool names, configuration, command invocation, approval behavior, session handling, and runtime paths in the matching harness skill.
- Do not add conditional harness sections to generic skills, such as “if using Codex” or “for Claude Code.” Move those instructions into the matching harness skill.
- When a skill mixes generic and harness-specific instructions, keep only the shared guidance here and move the harness-specific content to `harnesses/<target>/skills/`. Harness skills may override a generic skill with the same name.

## Validation

Write skill frontmatter descriptions using positive trigger conditions only. Never include negative triggers or exclusion clauses in `description`; place excluded tasks and operational boundaries in the skill body instead.

After skill changes, validate the changed skill folders with `bun skills/agent/skill-writer/scripts/quick-validate.ts <skill-dir>` from the repository root, then run `bun run build`.

Record new skill-authoring instructions in this file; check with the user before changing conflicting instructions.
