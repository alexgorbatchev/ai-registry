# AI Assistant Guidelines for `ai-registry`

This repository is a central registry for AI skills, commands, rules, and agent profiles. As an AI assistant working in this repository, you must adhere to the following rules:

## Purpose
This repository manages reusable AI skills and commands plus the configurations (profiles) that assemble them. It serves as the single source of truth for your agent personas, generated harness outputs, and setup workflow.

## File Conventions
- **Reusable Assets**:
  - **Skills (`skills/`)**: Each skill must reside in its own isolated folder and contain at least a `SKILL.md` file detailing the domain knowledge, workflows, and rules. This is also the install surface for `npx skills`.
  - **Commands (`commands/`)**: Slash commands and reusable task prompts belong here.
  - **Self-Contained Logic**: Each skill or command must be self-contained. Do not assume other skills are present.
- **The Harnesses (`harnesses/`)**:
  - Global configuration overrides for specific tools (e.g., `harnesses/opencode/opencode.jsonc`).
  - When a task says to change OpenCode config "in ai-registry", edit the checked-in source file under `harnesses/opencode/`, not the machine-local installed config under `~/.config/opencode/`.
  - The checked-in OpenCode docs snapshot lives under `harnesses/opencode/docs/`; refresh it with `bun run sync:opencode-docs`, which runs `harnesses/opencode/scripts/sync-docs.ts`.
  - Repository-local harness maintenance guidance belongs in `harnesses/AGENTS.md`.
  - Only files inside `harnesses/<target>/` are injected directly into the matching target output directories during the build process.
- **Standalone Packages (`packages/<package-name>/`)**:
  - Publishable repo-local packages that are distributed independently from generated harness outputs live under `packages/`.
  - Add each standalone package to the root `package.json` workspaces so `bun install` manages it consistently.
- **Vendored Packages (`vendor/`)**:
  - Third-party code packages that need to live in this repo as Bun workspaces belong here.
  - Use this for repo-local harness dependencies such as file-based OpenCode plugins with runtime imports.
  - Vendored packages are repo-local runtime dependencies, not generated-output surfaces; reference them from source configs with `file://{{repo_root}}/...` when needed.
- **The Profiles (`profiles/`)**:
  - Contains directories (e.g., `designer`, `developer`) with `profile.yaml` (or `profile.json`) manifests.
  - Manifests declare which skills and commands to include (supports globbing, e.g., `*`, `react-*`).
  - Manifests can explicitly toggle native harness tools (e.g., `bash: false`) and inject custom tool-level permissions.
  - Manifests can define a custom `system_prompt` to give the agent specific baseline instructions.
- **External Skill Lock (`skills-lock.json`)**:
  - Records third-party skills vendored into `skills/` via the Skills CLI.
  - Commit it whenever you add or update external skills.

## Architecture & Build Process
This repository uses a custom build script (`scripts/build.ts`) to locally compile the registry into ready-to-use configurations for various agent harnesses (OpenCode, Cursor, Pi, etc.).
- **Unified Outputs:** The script generates final unified outputs in `.output/` for supported shared targets. Today that includes `.output/opencode` for OpenCode and `.output/agents` for the AGENTS.md target. Intermediate rulesync inputs are cleaned up after the build so `.output` only contains final generated outputs.
- **Generated Output Manifest:** Each successful unified build also writes `.output/manifest.json` with SHA-256 checksums for the generated files. Before replacing `.output/` on the next run, the build verifies that manifest and stops for confirmation if any managed generated file drifted externally.
- **Other Targets:** The script simultaneously generates isolated cache directories inside each profile folder (e.g., `profiles/designer/.agents/`) for tools that don't support native agent switching. These isolated outputs are controlled by `RULESYNC_TARGETS`; `opencode` and `agentsmd` are produced in `.output/` instead.
- **Source Tree Ignores:** When the build stages files from `skills/`, `commands/`, and `harnesses/<target>/`, it honors nested `.registry-ignore` files with `.gitignore`-style matching so repo-local scratch files can stay out of generated outputs.
- **Bootstrap Command:** `bun run bootstrap` is the repo-local setup entrypoint. It installs dependencies, builds the generated outputs, and links the default machine-local OpenCode target using an XDG-style path unless `OPENCODE_CONFIG_DIR` is set.
- **Smoke Test:** `bun run bootstrap:smoke` validates the bootstrap flow against `.tmp/bootstrap-smoke/`, treating that directory as a fake `HOME` with the repo staged at `development/ai-registry`.
- **Generated Output Template Variables:** Generated output files may use the current build-time placeholders `{{repo_root}}`, `{{skills_dir}}`, `{{commands_dir}}`, `{{profiles_dir}}`, and `{{output_dir}}`. Expansion happens during `bun run build` as generated text outputs are scanned recursively. Unknown placeholders must fail the build instead of being left unresolved.
- **Canonical Path References:** When checked-in guidance or generated text needs a canonical path inside this repository that would otherwise be machine-specific and absolute, use template variables instead of hardcoded absolute paths. Prefer the most specific token available for canonical folders: `{{skills_dir}}/...`, `{{commands_dir}}/...`, `{{profiles_dir}}/...`, and `{{output_dir}}/...`. For canonical folders without a dedicated token, anchor the path from `{{repo_root}}`, such as `{{repo_root}}/harnesses/...`, `{{repo_root}}/vendor/...`, `{{repo_root}}/scripts/...`, `{{repo_root}}/README.md`, and `{{repo_root}}/AGENTS.md`. Use normal repo-relative paths elsewhere in checked-in docs.

## Development Workflow
- **CRITICAL ANONYMIZATION RULE:** This registry is designed to be public and reusable. When creating or editing *any* file in this repository (especially skills, commands, prompts, and profiles), you MUST strictly anonymize and generalize all potentially Personal Identifiable Information (PII) and proprietary data. This includes, but is not limited to: company names, specific project names, employee names, locations, desk numbers, internal URLs, specific server hostnames, proprietary nomenclature, private API keys, or hardcoded passwords. Exception: the repository's already-public ownership and attribution identifiers may remain when they are required for the published package/repository identity or canonical author metadata (for example the GitHub owner, package scope, or `author` field used by this registry). Do not introduce any other personal details beyond that narrow public-attribution scope. Ensure all other content added to this repository is globally applicable and scrubbed of private context.
- When asked to create a new skill, create a new directory under `skills/`. Keep concerns separated.
- When vendoring an external skill, use `bun run skills:add 'npx skills add <source> --skill <name>'`. That wrapper applies `-a openclaw --copy -y` behind the scenes so the skill is copied into the canonical `skills/` directory and tracked in `skills-lock.json`.
- When updating vendored external skills, use `bun run skills:update` instead of plain `npx skills update`, because the upstream update command does not preserve the canonical `skills/` target in this repo.
- When creating a new command, add it under `commands/`.
- When creating a new profile, create a folder under `profiles/` and add a `profile.yaml` file that cherry-picks from the reusable assets.
- When creating a publishable standalone package, place it under `packages/<package-name>/` and add it to the root Bun workspaces.
- When vendoring a third-party code package for a harness integration, place it under `vendor/` and wire it through the root Bun workspaces instead of placing installable package source inside a generated harness directory.
- After modifying any skill, command, profile, harness file, or `skills-lock.json`, ALWAYS run `bun run build` to regenerate the configurations.
- **CRITICAL:** This `AGENTS.md` and the `README.md` must be kept strictly up to date whenever structural or architectural changes are made to this repository. Do not leave documentation stale.
- When structural, workflow, or location changes affect how agents should add things to this registry, update `skills/ai-registry-integration/SKILL.md` in the same change so the registry-integration guidance stays accurate.
