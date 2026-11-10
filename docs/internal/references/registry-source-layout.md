---
created_on: 2026-11-10 11:33
last_modified: 2026-11-10 13:36
status: current
---

# Registry source layout

For agents adding, moving, or editing registry assets. Paths are relative to the repository root.

- **Reusable Assets**:
  - **Skill Authoring Guidance**: Follow `skills/AGENTS.md`. Use `prompt-writer` whenever generating, writing, or revising AI agent instructions; `skill-writer` adds skill-bundle conventions and validation, while `docs-writer` owns project documentation structure and maintenance. Review AI agent instructions with concrete acceptance checks and bounded review rounds rather than numerical quality scores. Generic skills must contain no harness-specific instructions; place those under `harnesses/<target>/skills/` instead.
  - **Bundled Skill Dependencies**: Register skill packages needed by repository-wide typechecking as root Bun workspaces, including `skills/user/disk-cleanup` and `harnesses/claude-code/hooks`, so normal installs cover their dependencies. Exclude installed dependencies and scratch directories from generated skill copies through `.registry-ignore`. Ship a bundle's `bun.lock` when its instructions install with `--frozen-lockfile`, and keep that lockfile installable on its own, outside the root workspace.
  - **Skills (`skills/`)**: Skills are grouped into `skills/agent/` for agent-runnable skills and `skills/user/` for user-invokable skills. Each skill resides in its own isolated folder and contains at least a `SKILL.md` file detailing the domain knowledge, workflows, and rules. User skills in `skills/user/` do not contain `disable-model-invocation: true` in their source `SKILL.md`; the build/bootstrap process automatically injects it into generated harness outputs. In generated outputs, skills from `agent/` and `user/` are merged flat into `skills/`.
  - **Commands (`commands/`)**: Slash commands and reusable task prompts belong here.
  - **Pull Requests**: Maintain PR-writing and PR review-feedback guidance in `skills/agent/github-pr/`, with one bundled reference per mode, not a duplicate command. PR descriptions, comments, and replies posted from the user's account use the account owner's first-person voice (`I`, `me`, `my`), including approval and landing notices. Do not refer to that account owner as `the user` or narrate an assistant intermediary. Ground actions, results, and approvals in actual work and authorization; separate bot reviews speak for the bot's identity. Keep titles concise and avoid drawn-out explanations. Cover related issues from commit messages, the problem and motivation, change type, tests, and risks. When a PR from an external author (not `OWNER`, `MEMBER`, or `COLLABORATOR`) is merged, closed, or superseded, thank the author on that PR and say where the work landed.
  - **System (`system/`)**: Shared repo-level instruction fragments and memory guidance belong here. `system/system.md` is the shared system prompt every harness ships: Codex as `AGENTS.md`, Pi as `APPEND_SYSTEM.md`, Claude Code as `CLAUDE.md`, and OpenCode through `instructions` in `harnesses/opencode/opencode.jsonc`.
  - **Self-Contained Logic**: Keep skills and commands self-contained; do not assume other skills are present. Matt Pocock's explicitly user-invoked workflows may depend on other bundled user skills; maintain their required dependencies. Keep all skills authored by `mattpocock` under `skills/user/`, as specified in `skills/AGENTS.md`.
- **The Harnesses (`harnesses/`)**:
  - Global configuration overrides for specific tools (e.g., `harnesses/opencode/opencode.jsonc`).
  - Unified harnesses can also provide repo-local build plugins at `packages/registry-cli/src/harnesses/<target>/build.ts`; `packages/registry-cli/src/commands/buildCommand.ts` statically imports those plugins.
  - When a task says to change OpenCode config "in ai-registry", edit the checked-in source file under `harnesses/opencode/`, not the machine-local installed config under `~/.config/opencode/`.
  - The checked-in OpenCode docs snapshot lives under `harnesses/opencode/docs/`; refresh it with `just sync-opencode-docs`, which runs `packages/registry-cli/src/bin/sync-opencode-docs.ts`.
  - Repository-local harness maintenance guidance belongs in `harnesses/AGENTS.md`.
  - Each harness contains a `fetch-source.sh` script to clone or update its upstream source code into a local, git-ignored scratch folder at `harnesses/<harness>/.tmp/<harness>-source/` for reference and inspection. These scripts and folders are omitted from the generated harness outputs using `.registry-ignore`.
  - **USE SOURCE REFERENCE FIRST:** When diagnosing harness-specific issues, analyzing behavioral contracts, or updating configurations, ALWAYS consult the local checked-out source code under `harnesses/<harness>/.tmp/<harness>-source/` first. Never guess, assume, or rely on memory. Run the respective `fetch-source.sh` first if the directory is absent.
  - Only files inside `harnesses/<target>/` are injected directly into the matching target output directories during the build process, subject to `.registry-ignore` rules.
  - Current generated harnesses are OpenCode (`harnesses/opencode/`), Codex (`harnesses/codex/`), Pi (`harnesses/pi/`), and Claude Code (`harnesses/claude-code/`).
- **Standalone Packages (`packages/<package-name>/`)**:
  - Publishable repo-local packages that are distributed independently from generated harness outputs live under `packages/`.
  - Add each standalone package to the root `package.json` workspaces so `bun install` manages it consistently, and give it its own `justfile` linked from the root `justfile` with `mod`.
  - Package-local guidance belongs in `packages/<package-name>/AGENTS.md` when a package has non-obvious contracts or validation rules. For the template resolver package, see `packages/template-resolver/AGENTS.md`.
- **Vendored Packages (`vendor/`)**:
  - Third-party code packages that need to live in this repo as Bun workspaces belong here.
  - Use this for repo-local harness dependencies such as file-based OpenCode plugins with runtime imports.
  - Vendored packages are repo-local runtime dependencies, not generated-output surfaces; reference them from source configs with `file://<%- repo_root %>/...` when needed, or symlink single files into generated roots from the harness build plugin.
  - Record the upstream repository, pinned commit, and file checksum in the vendored package's `README.md` so the copy stays reproducible.
- **External Skill Lock (`skills-lock.json`)**:
  - Records third-party skills vendored into `skills/` via the Skills CLI.
  - Commit it whenever you add or update external skills.

