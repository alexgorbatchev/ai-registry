---
name: ai-registry-integration
description: Add or update content in the AI registry. Use when a user needs to create or modify skills, commands, profiles, harness overrides, vendored skills, or related registry documentation in this repository.
author: alexgorbatchev
---

# AI Registry Integration

Treat this repository as the source of truth. Add things to the reusable source directories first, then rebuild generated outputs. Do not hand-edit the generated output directory under the repo_root token.

## Template Tokens

- Use template tokens when checked-in guidance or generated text needs canonical repository paths that would otherwise be machine-specific.
- For string-variable tokens, write the token name with the template resolver's variable syntax in source files. Available path tokens are `repo_root`, `skills_dir`, `commands_dir`, `profiles_dir`, `output_dir`, `file_path`, and `file_dir`.
- Use the `include` directive for repository-root-relative file inclusion.
- Use the `env` directive to read environment variables, with an optional default value when the variable may be absent.
- Prefer the most specific path token available. Use `skills_dir`, `commands_dir`, `profiles_dir`, and `output_dir` for those canonical folders. Use `repo_root` for canonical folders that do not have a dedicated token.

## Core Rules

- Keep new content anonymized and reusable. Do not introduce private company names, internal URLs, secrets, or personal details.
- When checked-in guidance or generated text refers to repository paths, use template tokens instead of machine-specific absolute paths.
- Put reusable assets under the directories referenced by the repo_root token: `skills/`, `commands/`, `profiles/`, or `harnesses/`.
- Keep executable repo entrypoints under `scripts/` beneath the repo_root token and use dash-based filenames. Put imported TypeScript helper modules that are not direct entrypoints under `scripts/lib/`.
- Public CLI helpers meant to be symlinked to `~/.local/bin/` (like `air-*`, `codex`, `codex-*`, `pi`, or `pi-*` wrappers) MUST NOT be checked into `scripts/` beneath the repo_root token. Generate them from `scripts/build.ts` into `.output/bin/` beneath the repo_root token so the bootstrap script can link them from there.
- Put publishable standalone packages under `packages/<package-name>/` beneath the repo_root token.
- Put vendored third-party code packages that need Bun workspace installs under `vendor/` beneath the repo_root token.
- When a source tree needs repo-local files that must not ship into generated outputs, add `.registry-ignore` files with `.gitignore`-style rules inside that tree. The build honors nested `.registry-ignore` files while staging `skills/`, `commands/`, and `harnesses/<target>/` content.
- Treat `.output/` beneath the repo_root token as generated output, not an editing surface.
- After modifying any file under `skills/`, `commands/`, `profiles/`, `harnesses/`, or `skills-lock.json` beneath the repo_root token, run `bun run build` from the repo_root token.
- If a change alters repo structure, build architecture, or workflow contracts, update `AGENTS.md` and `README.md` beneath the repo_root token in the same change.

## Workflow

1. Identify what kind of thing is being added.
2. Create or edit the source-of-truth file in the matching section below.
3. Update any dependent manifest or lock file.
4. Run the narrowest relevant validation.
5. Run `bun run build` from the repo_root token.
6. Inspect the generated output under the output_dir token if the change affects shipped harness content.

## Add A Skill

- Create a folder under the skills_dir token for the new skill.
- Put the main instructions in `SKILL.md` within that skill folder.
- Start `SKILL.md` with YAML frontmatter containing `name`, `description`, and `author: alexgorbatchev`.
- Keep each skill self-contained. Do not assume another skill is present.
- Add bundled resources only when needed, inside the same skill folder:
  - `scripts/` beneath the skill folder
  - `references/` beneath the skill folder
  - `assets/` beneath the skill folder
- Keep the body procedural and specific for another AI agent.
- Validate the skill with the quick_validate script under the skill-writer skill inside the skills_dir token.
- Run `bun run build` from the repo_root token after the skill change.

## Add A Command

- Create the command under the commands_dir token.
- Use commands for slash-command prompts, reusable task blueprints, and prompt templates.
- Keep the command self-contained rather than relying on unstated repo context.
- If the command is meant to be available in a profile, make sure the profile manifest under the profiles_dir token includes it directly or via an existing glob.
- Run `bun run build` from the repo_root token after the command change.

## Add A Profile

- Create a profile folder under the profiles_dir token.
- Put the manifest in `profile.yaml` within that profile folder.
- Use the manifest to select skills and commands, plus any tool toggles, permissions, or `system_prompt` overrides.
- Optional profile-local commands live in the profile folder's `commands/` directory and are emitted as namespaced shared commands named `--<profile>-<filename>.md` in OpenCode outputs.
- Optional profile-local skills live in the profile folder's `skills/<skill-name>/SKILL.md` path and must not collide with global skills or another profile's local skills.
- Keep reusable knowledge in the skills_dir token and reusable prompts in the commands_dir token; profiles should assemble those pieces instead of duplicating them.
- Run `bun run build` from the repo_root token after the profile change.
- Check generated profile-local outputs when the selected targets write files inside that profile folder.

## Add Harness Overrides

- Put harness-specific shipped files under `harnesses/<target>/` beneath the repo_root token.
- Put unified harness-specific build logic in `harnesses/<target>/scripts/build.ts` beneath the repo_root token for every generated harness target; the root build only discovers harness outputs through that plugin entrypoint.
- Put repo-local vendored code packages that a harness references by file path under `vendor/` beneath the repo_root token.
- Put shared repo-level system guidance under `system/` beneath the repo_root token and harness-specific guidance in `harnesses/AGENTS.md` or the relevant `harnesses/<target>/` directory.
- Only files under a harness directory are copied into generated output for that harness, subject to `.registry-ignore`.
- Do not place repo-only notes inside a harness directory unless they are intentionally meant to ship.
- Prefer the harness's native configuration surface over local wrappers when the harness already supports the feature directly.
- For Codex-only shipped skills, place them under `harnesses/codex/skills/`; the Codex build merges that directory into each generated `skills/` root inside `.output/codex/<profile>/`.
- If a local file-based harness dependency needs installed runtime imports, vendor it under `vendor/<name>/` beneath the repo_root token, add it to the root Bun workspaces, and reference it from the harness config using the repo_root token.
- Run `bun run build` from the repo_root token and verify the corresponding files under the output_dir token.
- Existing harnesses:
  - OpenCode under `harnesses/opencode`.
  - Codex under `harnesses/codex`.
  - Pi under `harnesses/pi`.

## Add A Standalone Package

- Create the package under `packages/<package-name>/` beneath the repo_root token.
- Use this for publishable tools that are distributed independently from generated harness outputs.
- Add the package folder to the root `package.json` workspaces beneath the repo_root token.
- Keep publishable package docs inside the package folder, such as `README.md`.
- Run the package's narrowest validation plus any affected repo-level validation.

## Vendor An External Skill

- Vendored skills live under the skills_dir token.
- Track the vendored source in `skills-lock.json` beneath the repo_root token.
- Add a third-party skill with `bun run skills:add 'npx skills add <source> --skill <skill-name>'` from the repo_root token.
- Do not use plain `npx skills add ...` for vendoring into this repo; the wrapper enforces the repo's canonical destination and flags.
- Update vendored skills with `bun run skills:update` from the repo_root token.
- Commit both the vendored skill directory under the skills_dir token and `skills-lock.json` beneath the repo_root token when vendoring or updating an external skill.
- Run `bun run build` from the repo_root token afterward.

## Build And Generated Output

- The local build entrypoint is `scripts/build.ts` beneath the repo_root token.
- Unified harness plugins are discovered from `harnesses/<target>/scripts/build.ts` beneath the repo_root token.
- Generated outputs are written under the output_dir token.
- Verify generated files that match the change, especially:
  - `opencode/` beneath the output_dir token
  - `codex/` beneath the output_dir token
  - `pi/` beneath the output_dir token
  - `manifest.json` beneath the output_dir token
- Never move source-of-truth edits into the output_dir token; rebuild instead.

## Repo Docs And Maintenance

- Update `README.md` beneath the repo_root token when public usage, repository structure, build behavior, or setup flow changes.
- Update `AGENTS.md` beneath the repo_root token when repository operating rules or architecture change.
- If a new skill or command overlaps existing instructions, resolve the duplication instead of leaving conflicting guidance in multiple places.

## Quick Routing

- Add reusable agent behavior under the skills_dir token.
- Add reusable slash command or prompt under the commands_dir token.
- Add or adjust an assembled persona under the profiles_dir token.
- Add harness-specific shipped config under `harnesses/<target>/` beneath the repo_root token.
- Add a publishable standalone package under `packages/<package-name>/` beneath the repo_root token.
- Add a vendored third-party code package for a harness under `vendor/<name>/` beneath the repo_root token.
- Add shared system guidance under `system/` beneath the repo_root token.
- Add shared harness guidance under `harnesses/AGENTS.md` beneath the repo_root token.
- Add or update a vendored third-party skill under the skills_dir token plus `skills-lock.json` beneath the repo_root token.
- OpenCode configuration lives in `harnesses/opencode/opencode.jsonc` beneath the repo_root token.
- Codex docs snapshots, build logic, and Codex-only shipped skills live under `harnesses/codex/` beneath the repo_root token.
- Pi configuration skeleton lives in `harnesses/pi/agent/settings.json` beneath the repo_root token.
