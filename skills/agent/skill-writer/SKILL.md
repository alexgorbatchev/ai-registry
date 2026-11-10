---
name: skill-writer
description: Use when creating or revising skills, including SKILL.md instructions, bundled scripts, references, assets, scaffold templates, and validation tooling.
author: alexgorbatchev
metadata:
  created_on: 2026-04-14 12:00
  last_modified: 2026-11-10 11:06
  status: current
---

## Required dependency

Load `prompt-writer` before composing or reviewing skill instructions. It is required for agent-facing writing, token economy, policy ownership, authorization, and acceptance checks. This skill owns bundle structure, routing, metadata, resources, and validation.

If `prompt-writer` is unavailable, locate it through the available skill catalog or repository sources. If it cannot be loaded, report the missing requirement and suspend instruction composition and review; continue independent bundle inspection or script validation. Do not substitute a copied writing checklist.

## Execute the task

1. Inspect the request, repository instructions, and existing bundle. Establish triggers, inputs, authorized actions, and expected results from available context; ask only for consequential missing information.
2. For a new skill, select its source under **Source location** before creating files. For revisions, inspect affected references, scripts, assets, and callers as well as `SKILL.md`.
3. Before creating or changing metadata, load [frontmatter rules](references/frontmatter.md). When creating or revising a project-local companion skill, load [addendum rules](references/addenda.md) before choosing its name and trigger.
4. Implement necessary resources under **Bundle contents**, then write the common execution path and resource loading conditions. Apply the required `prompt-writer` workflow to preserve existing requirements and authorized changes.
5. Run **Validate and finish**. For later usage feedback, correct the demonstrated failure and repeat the affected checks.

## Source location

Create new skills at `<cwd>/.agents/skills/<skill-name>/SKILL.md` by default, where `<cwd>` is the target project directory, not an incidental shell working directory. Honor explicit user destinations and repository source-layout rules; this registry uses `skills/agent/<skill-name>/` or `skills/user/<skill-name>/`.

Treat deployed `skills/<skill-name>/` directories separately from authoring locations. Edit the source bundle and regenerate installed copies using the project's workflow. For vendoring in this registry, use `just skills-add` and preserve upstream attribution and content according to repository instructions.

## Bundle contents

Keep `SKILL.md` focused on the common execution path, local constraints, and resource routing. Start with actionable instructions rather than a repeated skill title or overview. Keep its body under 500 lines; extract conditional details before reaching that limit.

Create only resources the workflow uses:

- `scripts/`: executable operations that need deterministic behavior or would otherwise be rewritten repeatedly. Inspect them when changing behavior or adapting execution to the environment.
- `references/`: conditional workflows, modes, schemas, configuration, or domain details. Extract by applicability, even when short. Put service installation and setup in `references/setup.md`.
- `assets/`: templates, media, and other files consumed or copied into the result.

Keep each rule in one place. In `SKILL.md`, link every reference directly and state its loading condition before the first affected decision or action. Keep variant selection in the body and variant-specific procedures in references. For references over 100 lines, add a table of contents; for files over 10,000 words, provide useful search terms without prescribing a search tool.

Use bundle-relative links for bundled files and runtime parameters or environment variables for external paths. Do not hardcode machine-local absolute paths. Include necessary execution, setup, and verification instructions, but omit authoring history and redundant README, installation-guide, quick-reference, or changelog files unless repository or distribution requirements call for them.

## Validate and finish

1. Apply `prompt-writer`'s acceptance checks to the instructions. Additionally verify that metadata selects the intended tasks, conditional resources load before affected actions, links resolve, and instructions agree with executable resources. Walk through routing for a matching request and a request outside the skill's scope.
2. Execute added or behaviorally changed scripts with representative inputs and verify their results. Sampling similar scripts must still cover distinct changed behavior; do not describe unexecuted scripts as tested.
3. Run the bundled validator against every changed skill directory, resolving the script relative to this skill's directory:

   ```bash
   bun scripts/quick-validate.ts <skill-dir-or-SKILL.md> [...more]
   ```

   Fix every error; assess warnings against the task. The validator checks metadata, naming, body length, and bundled links, not instruction semantics.
4. Run the repository's required build or generation checks and inspect affected outputs. Complete only when required checks pass; report executed checks and any remaining blockers without treating text review as runtime proof.
