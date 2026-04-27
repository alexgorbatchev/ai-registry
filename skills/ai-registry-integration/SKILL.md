---
name: ai-registry-integration
description: Add or update content in the AI registry. Use when an user needs to add/integrate or modify skills, commands, profiles, harness overrides, vendored skills, or related registry documentation in ai-registry.
author: alexgorbatchev
---

# AI Registry Integration

Treat this repository as the source of truth. Add things to the reusable source directories first, then rebuild generated outputs. Do not hand-edit `{{repo_root}}/.output/`.

## Core Rules

- Keep new content anonymized and reusable. Do not introduce private company names, internal URLs, secrets, or personal details.
- When checked-in guidance or generated text refers to repository paths, use the build-time template tags instead of machine-specific absolute paths. Supported string variables are `{{repo_root}}`, `{{skills_dir}}`, `{{commands_dir}}`, `{{profiles_dir}}`, and `{{output_dir}}`. The build also supports `&#123;&#123; include "path/from/repo/root.md" &#125;&#125;` and `&#123;&#123; env "VAR_NAME" &#125;&#125;` with optional `default` for generated text outputs.
- Prefer the most specific canonical-folder token available: `{{skills_dir}}/...`, `{{commands_dir}}/...`, `{{profiles_dir}}/...`, and `{{output_dir}}/...`. For canonical folders without a dedicated token, anchor the path from `{{repo_root}}`, such as `{{repo_root}}/harnesses/...`, `{{repo_root}}/vendor/...`, `{{repo_root}}/scripts/...`, `{{repo_root}}/README.md`, and `{{repo_root}}/AGENTS.md`.
- Put reusable assets in `{{repo_root}}/skills/`, `{{repo_root}}/commands/`, `{{repo_root}}/profiles/`, or `{{repo_root}}/harnesses/`.
- Keep executable repo entrypoints directly under `{{repo_root}}/scripts/` and use dash-based filenames for them. Put TypeScript helper modules that are imported by those entrypoints and are not meant to be executed directly under `{{repo_root}}/scripts/lib/`.
- Put publishable standalone packages that are meant to be distributed from this repo under `{{repo_root}}/packages/<package-name>/`.
- Put vendored third-party code packages that need Bun workspace installs in `{{repo_root}}/vendor/`.
- When a source tree needs repo-local files that must not ship into generated outputs, add `.registry-ignore` files with `.gitignore`-style rules inside that tree. The build honors nested `.registry-ignore` files while staging `skills/`, `commands/`, and `harnesses/<target>/` content.
- Treat `{{repo_root}}/.output/` as generated output, not an editing surface.
- After modifying any file under `{{repo_root}}/skills/`, `{{repo_root}}/commands/`, `{{repo_root}}/profiles/`, `{{repo_root}}/harnesses/`, or `{{repo_root}}/skills-lock.json`, run `bun run build` from `{{repo_root}}`.
- If a change alters repo structure, build architecture, or workflow contracts, update `{{repo_root}}/AGENTS.md` and `{{repo_root}}/README.md` in the same change.

## Workflow

1. Identify what kind of thing is being added.
2. Create or edit the source-of-truth file in the matching section below.
3. Update any dependent manifest or lock file.
4. Run the narrowest relevant validation.
5. Run `bun run build` from `{{repo_root}}`.
6. Inspect the generated output in `{{repo_root}}/.output/` if the change affects shipped harness content.

## Add A Skill

- Create a folder at `{{repo_root}}/skills/<skill-name>/`.
- Put the main instructions in `{{repo_root}}/skills/<skill-name>/SKILL.md`.
- Start `SKILL.md` with YAML frontmatter containing `name`, `description`, and `author: alexgorbatchev`.
- Keep each skill self-contained. Do not assume another skill is present.
- Add bundled resources only when needed, inside the same skill folder:
  - `{{repo_root}}/skills/<skill-name>/scripts/`
  - `{{repo_root}}/skills/<skill-name>/references/`
  - `{{repo_root}}/skills/<skill-name>/assets/`
- Keep the body procedural and specific for another AI agent.
- Validate the skill with `bun {{repo_root}}/skills/skill-creator/scripts/quick_validate.ts {{repo_root}}/skills/<skill-name>`.
- Run `bun run build` from `{{repo_root}}` after the skill change.

## Add A Command

- Create the command at `{{repo_root}}/commands/<command-name>.md`.
- Use commands for slash-command prompts, reusable task blueprints, and prompt templates.
- Keep the command self-contained rather than relying on unstated repo context.
- If the command is meant to be available in a profile, make sure the profile manifest includes it directly or via an existing glob in `{{repo_root}}/profiles/<profile-name>/profile.yaml`.
- Run `bun run build` from `{{repo_root}}` after the command change.

## Add A Profile

- Create a profile folder at `{{repo_root}}/profiles/<profile-name>/`.
- Put the manifest at `{{repo_root}}/profiles/<profile-name>/profile.yaml`.
- Use the manifest to select skills and commands, plus any tool toggles, permissions, or `system_prompt` overrides.
- Optional profile-local commands live at `{{repo_root}}/profiles/<profile-name>/commands/*.md` and are emitted as namespaced shared commands named `--<profile>-<filename>.md` in OpenCode outputs.
- Optional profile-local skills live at `{{repo_root}}/profiles/<profile-name>/skills/<skill-name>/SKILL.md` and must not collide with global skills or another profile's local skills.
- Keep reusable knowledge in `{{repo_root}}/skills/` and reusable prompts in `{{repo_root}}/commands/`; profiles should assemble those pieces instead of duplicating them.
- Run `bun run build` from `{{repo_root}}` after the profile change.
- Check generated profile-local outputs when the selected targets write files inside `{{repo_root}}/profiles/<profile-name>/`.

## Add Harness Overrides

- Put harness-specific shipped files in `{{repo_root}}/harnesses/<target>/`.
- Put unified harness-specific build logic in `{{repo_root}}/harnesses/<target>/scripts/build.ts` for every generated harness target; the root build only discovers harness outputs through that plugin entrypoint.
- Put repo-local vendored code packages that a harness references by file path in `{{repo_root}}/vendor/`.
- Put shared repo-level system guidance in `{{repo_root}}/system/` and harness-specific guidance in `{{repo_root}}/harnesses/AGENTS.md` or the relevant `{{repo_root}}/harnesses/<target>/` directory.
- Only files under `{{repo_root}}/harnesses/<target>/` are copied into generated output for that harness, subject to `.registry-ignore`.
- Do not place repo-only notes inside `{{repo_root}}/harnesses/<target>/` unless they are intentionally meant to ship.
- Prefer the harness's native configuration surface over local wrappers when the harness already supports the feature directly.
- If a local file-based harness dependency needs installed runtime imports, vendor it under `{{repo_root}}/vendor/<name>/`, add it to the root Bun workspaces, and reference it from the harness config with `file://{{repo_root}}/...`.
- Run `bun run build` from `{{repo_root}}` and verify the corresponding files under `{{repo_root}}/.output/`.
- Existing harnesses:
  - OpenCode: `{{repo_root}}/harnesses/opencode`.
  - Pi: `{{repo_root}}/harnesses/pi`.

## Add A Standalone Package

- Create the package under `{{repo_root}}/packages/<package-name>/`.
- Use this for publishable tools that are distributed independently from generated harness outputs.
- Add the package folder to the root `{{repo_root}}/package.json` workspaces.
- Keep publishable package docs inside the package folder, such as `README.md`.
- Run the package's narrowest validation plus any affected repo-level validation.

## Vendor An External Skill

- Vendored skills live in `{{repo_root}}/skills/<skill-name>/`.
- Track the vendored source in `{{repo_root}}/skills-lock.json`.
- Add a third-party skill with `bun run skills:add 'npx skills add <source> --skill <skill-name>'` from `{{repo_root}}`.
- Do not use plain `npx skills add ...` for vendoring into this repo; the wrapper enforces the repo's canonical destination and flags.
- Update vendored skills with `bun run skills:update` from `{{repo_root}}`.
- Commit both `{{repo_root}}/skills/<skill-name>/` and `{{repo_root}}/skills-lock.json` when vendoring or updating an external skill.
- Run `bun run build` from `{{repo_root}}` afterward.

## Build And Generated Output

- The local build entrypoint is `{{repo_root}}/scripts/build.ts`.
- Unified harness plugins are discovered from `{{repo_root}}/harnesses/<target>/scripts/build.ts`.
- Generated outputs are written under `{{repo_root}}/.output/`.
- Verify generated files that match the change, especially:
  - `{{repo_root}}/.output/opencode/`
  - `{{repo_root}}/.output/pi/`
  - `{{repo_root}}/.output/manifest.json`
- Never move source-of-truth edits into `{{repo_root}}/.output/`; rebuild instead.

## Repo Docs And Maintenance

- Update `{{repo_root}}/README.md` when public usage, repository structure, build behavior, or setup flow changes.
- Update `{{repo_root}}/AGENTS.md` when repository operating rules or architecture change.
- If a new skill or command overlaps existing instructions, resolve the duplication instead of leaving conflicting guidance in multiple places.

## Quick Routing

- Add reusable agent behavior: `{{repo_root}}/skills/<skill-name>/SKILL.md`
- Add reusable slash command or prompt: `{{repo_root}}/commands/<command-name>.md`
- Add or adjust an assembled persona: `{{repo_root}}/profiles/<profile-name>/profile.yaml`
- Add harness-specific shipped config: `{{repo_root}}/harnesses/<target>/...`
- Add a publishable standalone package: `{{repo_root}}/packages/<package-name>/`
- Add a vendored third-party code package for a harness: `{{repo_root}}/vendor/<name>/`
- Add shared system guidance: `{{repo_root}}/system/...`
- Add shared harness guidance: `{{repo_root}}/harnesses/AGENTS.md`
- Add or update a vendored third-party skill: `{{repo_root}}/skills/<skill-name>/` plus `{{repo_root}}/skills-lock.json`
- OpenCode configuration file: `{{repo_root}}/harnesses/opencode/opencode.jsonc`
- Pi configuration skeleton: `{{repo_root}}/harnesses/pi/agent/settings.json`
