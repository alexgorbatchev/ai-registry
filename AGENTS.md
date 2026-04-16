# AI Assistant Guidelines for `ai-registry`

This repository is a central registry for AI skills, commands, rules, and agent profiles. As an AI assistant working in this repository, you must adhere to the following rules:

## Purpose
This repository manages reusable AI skills and commands plus the configurations (profiles) that assemble them. It serves as the single source of truth for your agent personas, generated harness outputs, and bootstrap guidance.

## File Conventions
- **Reusable Assets**:
  - **Skills (`/skills`)**: Each skill must reside in its own isolated folder and contain at least a `SKILL.md` file detailing the domain knowledge, workflows, and rules. This is also the install surface for `npx skills`.
  - **Commands (`/commands`)**: Slash commands and reusable task prompts belong here.
  - **Self-Contained Logic**: Each skill or command must be self-contained. Do not assume other skills are present.
- **The Harnesses (`/harnesses`)**:
  - Global configuration overrides for specific tools (e.g., `harnesses/opencode/opencode.jsonc`).
  - These files are cleanly injected directly into the target output directories during the build process.
- **The Profiles (`/profiles`)**:
  - Contains directories (e.g., `designer`, `developer`) with `profile.yaml` (or `profile.json`) manifests.
  - Manifests declare which skills and commands to include (supports globbing, e.g., `*`, `react-*`).
  - Manifests can explicitly toggle native harness tools (e.g., `bash: false`) and inject custom tool-level permissions.
  - Manifests can define a custom `system_prompt` to give the agent specific baseline instructions.

- **Bootstrap (`/bootstrap`)**:
  - Cross-machine installation and apply guidance lives here.
  - Prefer `bootstrap/chezmoi/` when updating the recommended bootstrap flow.

## Architecture & Build Process
This repository uses a custom build script (`scripts/build.ts`) to locally compile the registry into ready-to-use configurations for various agent harnesses (OpenCode, Cursor, Pi, etc.).
- **Unified Outputs:** The script generates final unified outputs in `.output/` for supported shared targets. Today that includes `.output/opencode` for OpenCode and `.output/agents` for the AGENTS.md target. Intermediate rulesync inputs are cleaned up after the build so `.output` only contains final generated outputs.
- **Other Targets:** The script simultaneously generates isolated cache directories inside each profile folder (e.g., `profiles/designer/.agents/`) for tools that don't support native agent switching. These isolated outputs are controlled by `RULESYNC_TARGETS`; `opencode` and `agentsmd` are produced in `.output/` instead.

## Development Workflow
- **CRITICAL ANONYMIZATION RULE:** This registry is designed to be public and reusable. When creating or editing *any* file in this repository (especially skills, commands, prompts, and profiles), you MUST strictly anonymize and generalize all potentially Personal Identifiable Information (PII) and proprietary data. This includes, but is not limited to: company names, specific project names, employee names, locations, desk numbers, internal URLs, specific server hostnames, proprietary nomenclature, private API keys, or hardcoded passwords. Ensure all content added to this repository is globally applicable and scrubbed of private context.
- When asked to create a new skill, create a new directory under `skills/`. Keep concerns separated.
- When creating a new command, add it under `commands/`.
- When creating a new profile, create a folder under `profiles/` and add a `profile.yaml` file that cherry-picks from the reusable assets.
- After modifying any skill, command, profile, or harness file, ALWAYS run `bun run build` to regenerate the configurations.
- **CRITICAL:** This `AGENTS.md` and the `README.md` must be kept strictly up to date whenever structural or architectural changes are made to this repository. Do not leave documentation stale.
