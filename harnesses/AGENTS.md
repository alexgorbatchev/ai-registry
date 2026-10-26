# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `bun run build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs and profile includes, not copied verbatim into `.output/` unless a harness explicitly ships them.
- Do not place repo-only maintenance notes inside a harness subdirectory unless they are intentionally meant to ship into generated output.
- If a unified harness needs custom output shaping beyond raw file copying, put the repo-local build plugin at `packages/registry-cli/src/harnesses/<name>/build.ts`.
- Never create runtime state (session stores, logs, todo lists, databases) in generated output. Each harness home is a real directory outside the repository that bootstrap fills with links to the generated profile's managed entries; the harness writes its runtime state there directly (see Harness Homes in the root `AGENTS.md`). Return home targets from `getBootstrapTargets()`: the selected profile's home first, then one target per non-default profile with `getProfileHomeDir(...)` as its home and the default home as `sharedHomePath`. Point `<harness>-<profile>` launchers at `getProfileHomeShellPath(...)`.
- Register JSON, JSONC, or TOML settings files the harness tool edits at runtime with `context.buildSupport.syncSettingsFile(...)` after staging them. The build then keeps them out of the manifest and reconciles them with their registry source on every run instead of reporting drift: harness edits are written back into `harnesses/<name>/`, registry edits reach the live file. Pass `liveOnlyKeyPaths` (with `*` for any key) for keys the tool rewrites on its own, such as version stamps, for entries keyed by local paths, and for any field that can hold credentials: synced source changes are committed and scheduled updates push them to the public remote.
- Prefer the harness's native configuration surface over local wrapper files when the harness already supports the feature directly.
- Pin external plugin versions and commit SHAs so generated outputs stay reproducible.
- Treat harness-written generated-file edits as expected. Automatically recover supported edits into their mapped source only when the manifest baseline and exact reverse transformation establish that source changes will not be overwritten; regenerate every affected output afterward. Preserve source and generated versions and suspend output application on conflicts, unsupported recovery, or save failures. Do not add an ownership investigation or confirmation merely for harness drift, and do not bypass reconciliation with `-y`. Preserve all session/runtime data.

Harnesses are only built into `.output/` when they provide `packages/registry-cli/src/harnesses/<name>/build.ts`.

## Claude Code

- Keep shipped Claude Code config under `harnesses/claude-code/`, using Claude Code's native config-directory layout (`settings.json`, `commands/`, `agents/`, `output-styles/`, and so on).
- Keep the Claude Code unified-output plugin in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- Keep `harnesses/claude-code/settings.json` keys sorted alphabetically, nested objects included. Claude Code rewrites that file with sorted keys whenever a setting changes in the app (theme, permissions, and so on), and the settings sync inserts keys it writes back in sorted position, so the source and live file keep the same order.
- `default/settings.json` is a synced settings file: changes made through `/config`, `/model`, or tool installers flow back into `harnesses/claude-code/settings.json` on the next build.
- Every file under `harnesses/claude-code/` except `skills/` is copied verbatim into the generated `default` profile root, so new native config surfaces need no build changes. `skills/` is excluded through `.registry-ignore` because the build merges those bundles separately into each generated profile's `skills/` directory as copies with build-time template tags resolved.
- Put Claude Code-only shipped skills under `harnesses/claude-code/skills/` (grouped into `agent/` and `user/`); the build merges them into each generated `.output/claude-code/<profile>/skills/` root.
- The Claude Code harness treats `.output/claude-code/default/` as the shared Claude Code base. Every non-default generated profile root under `.output/claude-code/<profile>/` symlinks all top-level entries from `default/` except `CLAUDE.md` and `skills/`.
- Map reusable commands to `commands/` only from the `default` profile. Render `CLAUDE.md` separately for each profile from that profile's `system_prompt`, and generate selected skills into each profile's own `skills/` directory.
- Claude Code writes `projects/`, `sessions/`, `todos/`, `history.jsonl`, `file-history/`, `plugins/`, and the rest of its runtime state into the real `~/.claude` home, never into `.output/`.
- Plain `bun run bootstrap` applies the generated `default` Claude Code profile to `${CLAUDE_CONFIG_DIR:-~/.claude}`. Use `bun run bootstrap -- --claude-code-profile <profile>` to apply another generated Claude Code profile there instead.
- Generate `claude-<profile>` launchers under `.output/bin/` for non-default generated Claude Code profiles only; each sets `CLAUDE_CONFIG_DIR` to that profile's home. Do not generate a `claude` wrapper: the real `claude` binary already reads `~/.claude`, so nothing needs to shadow it.
- Do not silently ignore profile `tools` or `permission`; the Claude Code build must fail until an exact Claude Code-native mapping exists.

## Codex

- Keep the checked-in Codex reference docs under `harnesses/codex/docs/`.
- Treat `harnesses/codex/docs/` as an upstream documentation snapshot; refresh it from `https://github.com/openai/codex/tree/main/docs` when the local copy drifts.
- Preserve upstream filenames when refreshing the snapshot so links and diffs stay easy to compare.
- Keep the Codex unified-output plugin in `packages/registry-cli/src/harnesses/codex/build.ts`.
- Put Codex-only shipped skills under `harnesses/codex/skills/` (grouped into `agent/` and `user/`); the Codex build merges them into each generated `.output/codex/<profile>/skills/` root.
- The Codex harness treats `.output/codex/default/` as the shared Codex base. Every non-default generated profile root under `.output/codex/<profile>/` symlinks all top-level entries from `default/` except `AGENTS.md` and `skills/`.
- Package reusable and profile-local commands only from the `default` profile as native skills in every profile's `skills/` directory. Copy command content unchanged into `SKILL.md`, requiring a non-empty YAML `description`, and set `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Honor an explicit `name`; otherwise derive `command-<filename>` with normalized hyphens. Fail on invalid names, duplicate commands, or collisions with profile skills. Do not generate `prompts/`. Preserve source-path mappings through `buildSupport.mergeDirectory(...)` so templates resolve once and generated command edits sync back to their source files. Render `AGENTS.md` separately from each profile's `system_prompt`.
- `default/config.toml` is a synced settings file: `/model`, MCP, and feature changes Codex saves flow back into `harnesses/codex/config.toml`, with comments preserved. `projects`, `skills.config`, and `hooks.state` (keyed by local paths), `notify`, `marketplaces.openai-bundled`, `marketplaces.openai-primary-runtime`, `mcp_servers.node_repl`, and `mcp_servers.cua_repl` (Codex and the ChatGPT desktop app point them at machine-local binaries and caches), `notice` and `tui.model_availability_nux` (acknowledgements and counters Codex stamps itself), and `mcp_servers.*.env` and `mcp_servers.*.http_headers` (credentials) are live-only. Non-default generated Codex roots inherit the file by symlinking back to `default/`. Runtime files such as `auth.json` remain Codex-owned under the active `CODEX_HOME` instead of being registry-managed.
- Codex writes sessions, SQLite state, worktrees, logs, and its app-server packages into the real `${CODEX_HOME:-~/.codex}` home, never into `.output/`. Codex adds system skills under the linked `skills/.system/`; the build leaves that unmanaged directory alone.
- Plain `bun run bootstrap` applies the generated `default` Codex profile to `${CODEX_HOME:-~/.codex}`. Use `bun run bootstrap -- --codex-profile <profile>` to apply another generated Codex profile there instead.
- Generate `codex-<profile>` launchers under `.output/bin/` for non-default generated Codex profiles only; each sets `CODEX_HOME` to that profile's home. Do not generate a bare `codex` wrapper: the real `codex` binary already reads `${CODEX_HOME:-~/.codex}`, so nothing needs to shadow it.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- `opencode.jsonc` is a synced settings file: OpenCode's config updates and `mcp add`/`mcp auth` edits flow back into `harnesses/opencode/opencode.jsonc`, with absolute repository paths written back as `<%- repo_root %>` tags and comments preserved. `mcp.*.headers` and `mcp.*.environment` are live-only because `mcp add --header` and `--env` store their values literally.
- Keep the OpenCode unified-output plugin in `packages/registry-cli/src/harnesses/opencode/build.ts`.
- OpenCode agent generation auto-allows harness-local skills that match the current harness prefix (for example `opencode-*`) in addition to matched global skills and profile-local skills.
- Prefer direct package specs such as `name@version`.
- For unpublished plugins, use a pinned Git spec or a direct `file://...` spec.
- If a local file plugin needs runtime dependencies from the repo install, vendor the package under `vendor/<name>/` as a Bun workspace and point `opencode.jsonc` at `file://<%- repo_root %>/vendor/<name>/...`.
- Keep shipped OpenCode config in `harnesses/opencode/`, but keep installable third-party plugin source out of that directory unless it truly needs to be copied into generated output.
- Do not add proxy wrapper plugins under `harnesses/opencode/plugins/` unless a plugin truly must be loaded from a local file entrypoint.
- Use tuple form `[spec, { ... }]` only when a plugin needs inline startup options.

## Pi

- Keep shipped Pi skeleton files under `harnesses/pi/agent/`.
- Keep the Pi unified-output plugin in `packages/registry-cli/src/harnesses/pi/build.ts`.
- The Pi harness treats `.output/pi/default/` as the shared Pi base. Every non-default generated profile root under `.output/pi/<profile>/` symlinks all top-level entries from `default/` except `APPEND_SYSTEM.md` and `skills/`.
- Map reusable commands and the shared `settings.json` only from the `default` profile; Pi writes `sessions/` into the real `${PI_CODING_AGENT_DIR:-~/.pi/agent}` home. Render `APPEND_SYSTEM.md` separately for each profile from that profile's `system_prompt`, and generate selected skills into each profile's own Pi `skills/` directory.
- `default/settings.json` is a synced settings file: model, theme, and thinking-level choices made in Pi flow back into `harnesses/pi/settings.json`. `lastChangelogVersion` is live-only because Pi stamps it after every update.
- Plain `bun run bootstrap` applies the generated `default` Pi profile to `${PI_CODING_AGENT_DIR:-~/.pi/agent}`. Use `bun run bootstrap -- --pi-profile <profile>` to apply another generated Pi profile there instead.
- Generate `pi-<profile>` launchers under `.output/bin/` for non-default generated Pi profiles only, each setting `PI_CODING_AGENT_DIR` to that profile's home, plus the `pi-install`, `pi-update`, and `pi-uninstall` helpers. Do not generate a bare `pi` wrapper: the real `pi` binary already reads `${PI_CODING_AGENT_DIR:-~/.pi/agent}`, so nothing needs to shadow it.
- Do not silently ignore profile `tools` or `permission`; the Pi build must fail until an exact Pi-native mapping exists.

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
