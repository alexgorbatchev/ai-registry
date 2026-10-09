---
created_on: 2026-10-01 11:46
last_modified: 2026-10-09 21:14
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

## Hostname Variants

- Keep the bundle's default `SKILL.md`; add machine-specific instructions in `variants/<hostname>/SKILL.md` with the same frontmatter `name` and `author` as the default and the normal skill metadata conventions.
- Use exact hostnames, including case and domain suffixes. The build uses the OS hostname unless `AI_REGISTRY_HOSTNAME` selects another machine; an absent matching directory uses the default, while an invalid matching variant fails.
- Keep shared references, scripts, and assets at the bundle root. Only `SKILL.md` varies by hostname, and the root `variants/` directory is omitted from generated outputs. Markdown links refer to generated bundle locations.
- Keep private hostnames and environment instructions in the private overlay. Overlay bundles replace whole public bundles and must carry all required resources.
- Keep generic variants free of harness-specific instructions. Place harness-specific variants inside the matching harness skill bundle.
- Edit include-based variants at their source; generated-edit recovery does not reconstruct include directives. Recover generated edits with the same hostname and overlay selection that produced them.

## Validation

Write skill frontmatter descriptions using positive trigger conditions only. Never include negative triggers or exclusion clauses in `description`; place excluded tasks and operational boundaries in the skill body instead.

Vendored skills must maintain their upstream `author` in `SKILL.md` frontmatter, which is automatically resolved and preserved during `bun run skills:add` and `bun run skills:update`. In generated harness outputs, skills not authored by `alexgorbatchev` are automatically prefixed as `<author>-<skill>`.

After skill changes, validate the changed skill folders with `bun skills/agent/skill-writer/scripts/quick-validate.ts <skill-dir>` from the repository root, then run `bun run build`.

Record new skill-authoring instructions in this file; check with the user before changing conflicting instructions.
