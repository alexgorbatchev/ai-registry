# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `bun run build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs, not copied verbatim into `.output/` unless a harness explicitly ships them. Each plugin receives `system/system.md` as `context.systemPromptPath` and copies it into its native memory file with `buildSupport.copyPathWithTemplateVariables(...)`, so generated edits recover into that source.
- Do not place repo-only maintenance notes inside a harness subdirectory unless they are intentionally meant to ship into generated output.
- If a unified harness needs custom output shaping beyond raw file copying, put the repo-local build plugin at `packages/registry-cli/src/harnesses/<name>/build.ts`.
- Never create runtime state (session stores, logs, todo lists, databases) in generated output. Each harness home is a real directory outside the repository that bootstrap fills with links to the harness output's managed entries; the harness writes its runtime state there directly (see Harness Homes in the root `AGENTS.md`). Return exactly one home target per harness from `getBootstrapTargets()`, sourced from `.output/<target>/`.
- Register JSON, JSONC, or TOML settings files the harness tool edits at runtime with `context.buildSupport.syncSettingsFile(...)` after staging them. The build then keeps them out of the manifest and reconciles them with their registry source on every run instead of reporting drift: harness edits are written back into `harnesses/<name>/`, registry edits reach the live file. Pass `liveOnlyKeyPaths` (with `*` for any key) for keys the tool rewrites on its own, such as version stamps, for entries keyed by local paths, and for any field that can hold credentials: synced source changes are committed and scheduled updates push them to the public remote.
- Prefer the harness's native configuration surface over local wrapper files when the harness already supports the feature directly.
- Pin external plugin versions and commit SHAs so generated outputs stay reproducible.
- Treat harness-written generated-file edits as expected. Automatically recover supported edits into their mapped source only when the manifest baseline and exact reverse transformation establish that source changes will not be overwritten; regenerate every affected output afterward. Preserve source and generated versions and suspend output application on conflicts, unsupported recovery, or save failures. Do not add an ownership investigation or confirmation merely for harness drift, and do not bypass reconciliation with `-y`. Preserve all session/runtime data.

Harnesses are only built into `.output/` when they provide `packages/registry-cli/src/harnesses/<name>/build.ts`.

## Claude Code

- Keep shipped Claude Code config under `harnesses/claude-code/`, using Claude Code's native config-directory layout (`settings.json`, `commands/`, `agents/`, `output-styles/`, and so on).
- Keep the Claude Code unified-output plugin in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- Keep `harnesses/claude-code/settings.json` keys sorted alphabetically, nested objects included. Claude Code rewrites that file with sorted keys whenever a setting changes in the app (theme, permissions, and so on), and the settings sync inserts keys it writes back in sorted position, so the source and live file keep the same order.
- `settings.json` is a synced settings file: changes made through `/config`, `/model`, or tool installers flow back into `harnesses/claude-code/settings.json` on the next build.
- Every file under `harnesses/claude-code/` except `skills/` is copied verbatim into `.output/claude-code/`, so new native config surfaces need no build changes. `skills/` is excluded through `.registry-ignore` because the build merges those bundles separately into `.output/claude-code/skills/` as copies with build-time template tags resolved.
- Put Claude Code-only shipped skills under `harnesses/claude-code/skills/` (grouped into `agent/` and `user/`); they override registry skills of the same name.
- Map registry commands to `commands/` and copy `system/system.md` to `CLAUDE.md`.
- Claude Code writes `projects/`, `sessions/`, `todos/`, `history.jsonl`, `file-history/`, `plugins/`, and the rest of its runtime state into the real `~/.claude` home, never into `.output/`.
- `bun run bootstrap` applies `.output/claude-code/` to `${CLAUDE_CONFIG_DIR:-~/.claude}`.
- Do not generate a `claude` wrapper: the real `claude` binary already reads `~/.claude`, so nothing needs to shadow it.

## Codex

- Keep the checked-in Codex reference docs under `harnesses/codex/docs/`.
- Treat `harnesses/codex/docs/` as an upstream documentation snapshot; refresh it from `https://github.com/openai/codex/tree/main/docs` when the local copy drifts.
- Preserve upstream filenames when refreshing the snapshot so links and diffs stay easy to compare.
- Keep the Codex unified-output plugin in `packages/registry-cli/src/harnesses/codex/build.ts`.
- `harnesses/codex/rules/default.rules` forbids hook-skipping, gist, and Gitleaks exception commands by argv prefix, which needs no trust step. Flags later in a command, config overrides, and shell wrappers need the `guardGitBypass.ts` hook from `harnesses/claude-code/hooks/`, shared through `config.toml`. Codex runs that hook only after it is approved once per machine with `/hooks`.
- Put Codex-only shipped skills under `harnesses/codex/skills/` (grouped into `agent/` and `user/`); they override registry skills of the same name in `.output/codex/skills/`.
- Package every registry command as a native skill in `.output/codex/skills/`. Copy command content unchanged into `SKILL.md`, requiring a non-empty YAML `description`, and set `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Honor an explicit `name`; otherwise derive `command-<filename>` with normalized hyphens. Fail on invalid names, duplicate commands, or collisions with staged skills. Do not generate `prompts/`. Stage command skills through `buildSupport.copyPathWithTemplateVariables(...)` so templates resolve once and generated command edits sync back to their source files. Copy `system/system.md` to `AGENTS.md`.
- `config.toml` is a synced settings file: `/model`, MCP, and feature changes Codex saves flow back into `harnesses/codex/config.toml`, with comments preserved. `projects`, `skills.config`, and `hooks.state` (keyed by local paths), `notify`, `marketplaces.openai-bundled`, `marketplaces.openai-primary-runtime`, `mcp_servers.node_repl`, and `mcp_servers.cua_repl` (Codex and the ChatGPT desktop app point them at machine-local binaries and caches), `notice` and `tui.model_availability_nux` (acknowledgements and counters Codex stamps itself), and `mcp_servers.*.env` and `mcp_servers.*.http_headers` (credentials) are live-only. Runtime files such as `auth.json` remain Codex-owned under `CODEX_HOME` instead of being registry-managed.
- Codex writes sessions, SQLite state, worktrees, logs, and its app-server packages into the real `${CODEX_HOME:-~/.codex}` home, never into `.output/`. Codex adds system skills under the linked `skills/.system/`; the build leaves that unmanaged directory alone.
- `bun run bootstrap` applies `.output/codex/` to `${CODEX_HOME:-~/.codex}`.
- Do not generate a `codex` wrapper: the real `codex` binary already reads `${CODEX_HOME:-~/.codex}`, so nothing needs to shadow it.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- `opencode.jsonc` is a synced settings file: OpenCode's config updates and `mcp add`/`mcp auth` edits flow back into `harnesses/opencode/opencode.jsonc`, with absolute repository paths written back as `<%- repo_root %>` tags and comments preserved. `mcp.*.headers` and `mcp.*.environment` are live-only because `mcp add --header` and `--env` store their values literally.
- Keep the OpenCode unified-output plugin in `packages/registry-cli/src/harnesses/opencode/build.ts`.
- The OpenCode build generates no agents. OpenCode's built-in agents load the shared system prompt through the `instructions` entry for `system/system.md` in `opencode.jsonc`; keep that entry.
- Prefer direct package specs such as `name@version`.
- For unpublished plugins, use a pinned Git spec or a direct `file://...` spec.
- If a local file plugin needs runtime dependencies from the repo install, vendor the package under `vendor/<name>/` as a Bun workspace and point `opencode.jsonc` at `file://<%- repo_root %>/vendor/<name>/...`.
- Keep shipped OpenCode config in `harnesses/opencode/`, but keep installable third-party plugin source out of that directory unless it truly needs to be copied into generated output.
- Do not add proxy wrapper plugins under `harnesses/opencode/plugins/` unless a plugin truly must be loaded from a local file entrypoint.
- Use tuple form `[spec, { ... }]` only when a plugin needs inline startup options.

## Pi

- Keep shipped Pi files directly under `harnesses/pi/`: `settings.json`, `models.json`, `web-search.json`, `extensions/`, `prompts/`, `skills/`, and the `templates/` the helper scripts are generated from.
- Keep the Pi unified-output plugin in `packages/registry-cli/src/harnesses/pi/build.ts`.
- Map registry commands and `harnesses/pi/prompts/` to `prompts/`, copy `system/system.md` to `APPEND_SYSTEM.md`, and stage registry and Pi-only skills under `skills/`. Pi writes `sessions/` into the real `${PI_CODING_AGENT_DIR:-~/.pi/agent}` home.
- `settings.json` is a synced settings file: model, theme, and thinking-level choices made in Pi flow back into `harnesses/pi/settings.json`. `lastChangelogVersion` is live-only because Pi stamps it after every update.
- `bun run bootstrap` applies `.output/pi/` to `${PI_CODING_AGENT_DIR:-~/.pi/agent}`.
- Generate the `pi-install`, `pi-update`, and `pi-uninstall` helpers under `.output/bin/`. Do not generate a `pi` wrapper: the real `pi` binary already reads `${PI_CODING_AGENT_DIR:-~/.pi/agent}`, so nothing needs to shadow it.

## Local Source Code References

For each harness, we maintain its upstream source code locally in a `.tmp/` scratch directory. This is used for inspection, code reference, and development comparison.

- Each harness directory contains a `fetch-source.sh` script.
- Execute this script to perform a shallow clone (depth 1) of the upstream repository, or to pull the latest changes if already checked out:
  ```bash
  ./harnesses/opencode/fetch-source.sh
  ./harnesses/codex/fetch-source.sh
  ./harnesses/pi/fetch-source.sh
  ./harnesses/claude-code/fetch-source.sh
  ```
- The cloned sources are saved to `harnesses/<harness>/.tmp/<harness>-source/`.
- These checkouts and fetch scripts are ignored by Git (via root `.gitignore`) and are never bundled into the generated config outputs (via `.registry-ignore`).

## Maintenance

- After editing anything in `harnesses/`, run `bun run build`.
- Verify the generated copies in `.output/`.
