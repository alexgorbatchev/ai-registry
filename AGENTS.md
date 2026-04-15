# AI Assistant Guidelines for `ai-registry`

This repository is a central registry for AI skills, commands, rules, and agent profiles. As an AI assistant working in this repository, you must adhere to the following rules:

## Purpose
This repository manages both the global catalog of AI skills and the configurations (profiles) that assemble them. It serves as the single source of truth for your agent personas, which are distributed to other projects and local harnesses via `rulesync`.

## File Conventions
- **The Catalog (`/catalog`)**:
  - **Skills (`/catalog/skills`)**: Each skill must reside in its own isolated folder and contain at least a `SKILL.md` file detailing the domain knowledge, workflows, and rules.
  - **Commands (`/catalog/commands`)**: Slash commands and reusable task prompts belong here.
  - **Self-Contained Logic**: Each skill or command must be self-contained. Do not assume other skills are present.
- **The Harnesses (`/harnesses`)**:
  - Global configuration overrides for specific tools (e.g., `harnesses/opencode/opencode.jsonc`).
  - These files are cleanly injected directly into the target output directories during the build process.
- **The Profiles (`/profiles`)**:
  - Contains directories (e.g., `designer`, `developer`) with `profile.yaml` (or `profile.json`) manifests.
  - Manifests declare which skills and commands to include (supports globbing, e.g., `*`, `react-*`).
  - Manifests can explicitly toggle native harness tools (e.g., `bash: false`) and inject custom tool-level permissions.
  - Manifests can define a custom `system_prompt` to give the agent specific baseline instructions.

## Architecture & Build Process
This repository uses a custom build script (`scripts/build.ts`) to locally compile the registry into ready-to-use configurations for various agent harnesses (OpenCode, Cursor, Pi, etc.).
- **OpenCode:** The script generates a single unified output directory (`.output/opencode`) containing all required skills and dynamic Markdown agent personas (which use OpenCode's native permissions to lock down skill access).
- **Other Targets:** The script simultaneously generates isolated cache directories inside each profile folder (e.g., `profiles/designer/.agents/`) for tools that don't support native agent switching.

## Development Workflow
- **CRITICAL ANONYMIZATION RULE:** This registry is designed to be public and reusable. When creating or editing *any* file in this repository (especially skills, commands, prompts, and profiles), you MUST strictly anonymize and generalize all potentially Personal Identifiable Information (PII) and proprietary data. This includes, but is not limited to: company names, specific project names, employee names, locations, desk numbers, internal URLs, specific server hostnames, proprietary nomenclature, private API keys, or hardcoded passwords. Ensure all content added to this repository is globally applicable and scrubbed of private context.
- When asked to create a new skill, create a new directory under `catalog/skills/`. Keep concerns separated.
- When creating a new profile, create a folder under `profiles/` and add a `profile.yaml` file that cherry-picks from the catalog.
- After modifying any profile or catalog file, ALWAYS run `bun run build` to regenerate the configurations.
- **CRITICAL:** This `AGENTS.md` and the `README.md` must be kept strictly up to date whenever structural or architectural changes are made to this repository. Do not leave documentation stale.
