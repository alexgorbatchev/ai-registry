---
created_on: 2026-10-01 11:46
last_modified: 2026-10-18 15:22
status: current
---

# Generic Skills

This directory contains reusable skills that must work across harnesses.

## User Invocation

- Keep every skill authored by `mattpocock` under `skills/user/`, including newly vendored skills. These workflows require explicit user invocation; do not classify them as agent-runnable skills.
- Dependencies between these user workflows are intentional. Keep their required skills bundled and distinguish missing dependencies from the intended interactive workflow.
- Keep `disable-model-invocation: true` out of source `SKILL.md` files; the build injects it into generated user skills. Preserve explicit invocation policies in bundled upstream agent metadata.

## Third-Party Ownership

- Do not locally rewrite third-party-authored skill bundles. Preserve upstream content and attribution; keep local policies in registry-owned guidance.
- Installation, upstream updates, and invocation classification follow user authorization. An instruction audit does not authorize rewriting upstream content.
- Record unresolved findings in protected bundles and continue independent authorized work on registry-owned instructions.

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

Use `prompt-writer` whenever generating, writing, or revising AI agent instructions, including skill bodies. `skill-writer` adds skill-specific routing, frontmatter, resources, and validation; `docs-writer` owns project documentation structure and maintenance.

Review instructions for AI agent execution with concrete acceptance checks and at most two review-and-fix rounds. Finish when required checks pass; record unresolved blockers without claiming completion and continue independent authorized work. Do not require numerical quality scores.

Write skill frontmatter descriptions using positive trigger conditions only. Never include negative triggers or exclusion clauses in `description`; place excluded tasks and operational boundaries in the skill body instead.

Vendored skills must maintain their upstream `author` in `SKILL.md` frontmatter, which is automatically resolved and preserved during `bun run skills:add` and `bun run skills:update`. In generated harness outputs, skills not authored by `alexgorbatchev` are automatically prefixed as `<author>-<skill>`.

After skill changes, validate the changed skill folders with `bun skills/agent/skill-writer/scripts/quick-validate.ts <skill-dir>` from the repository root, then run `bun run build`.

Automatically record explicit standing user instructions about skill authoring in this file without requiring a separate request to save them. Update an existing rule in place when the user clearly changes it. Keep one-task directions and session history out of this file. Ask only when the intended policy scope or resolution of a material conflict is unclear.
