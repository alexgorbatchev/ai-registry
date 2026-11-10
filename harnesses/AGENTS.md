# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `just build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs, not copied verbatim into `.output/` unless a harness explicitly ships them. Each plugin receives `system/system.md` as `context.systemPromptPath` and copies it into its native memory file with `buildSupport.stageSourcePath(...)`, so generated edits recover into that source.
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
- `keybindings.json` is a synced settings file: bindings added through `/keybindings` or by tool installers flow back into `harnesses/claude-code/keybindings.json` on the next build.
- `claude.json` declares user-scope MCP servers under `mcpServers`. Claude Code reads them only from its global `.claude.json` (`$CLAUDE_CONFIG_DIR/.claude.json` or `~/.claude.json`), which also holds its runtime state. The build renders `claude.json` with overlays merged into the generated output without linking it into the harness home, and bootstrap writes its entries into the global file: it adds and updates declared servers, removes servers the registry stopped declaring, keeps servers added with `claude mcp add`, and keeps the `headers` and `env` Claude Code stored. Edits made in Claude Code to a declared server are replaced on the next bootstrap with a warning, so change declared servers in the registry. Keep private servers in the overlay's `harnesses/claude-code/claude.json`.
- Every file under `harnesses/claude-code/` except `skills/` is copied verbatim into `.output/claude-code/`, so new native config surfaces need no build changes. `skills/` is excluded through `.registry-ignore` because the build merges those bundles separately into `.output/claude-code/skills/` as copies with build-time template tags resolved.
- `hooks/` is the `@alexgorbatchev/claude-code-hooks` root workspace, linked from the root `justfile` as `claude-code-hooks`; its nested `.registry-ignore` ships only the hook scripts. Generated copies resolve imports from the repository root's `node_modules`, so keep each hook runtime dependency in the root `package.json` as well as the hooks package.
- `hooks/herdr.ts` holds the helpers the recap and notification hooks share: running commands, naming the project from the Herdr workspace label or the session folder, and `paneHostsProcess`, which counts a Herdr pane only when its shell (`herdr pane process-info --pane <pane>`) is the hook process or one of its ancestors (`ps -A -o pid= -o ppid=`). Herdr variables alone do not show that the pane runs the session: T3 and Codex's shared app-server pass the variables of the pane they started from to every session they run, long after that pane is gone.
- `hooks/t3.ts` finds the T3 Code thread a session runs in (`resolveT3Session`). Claude Code runs one process per thread, so T3 names it in `T3CODE_THREAD_ID`. Codex runs every T3 thread in one shared app-server whose environment names none of them, so the hook reads the `session_meta` record that opens the rollout named by the hook input's `transcript_path`: T3 started the session when its `originator` is `T3 Code`. A native Codex subagent (`source.subagent.thread_spawn`) is mirrored as its own T3 thread, `thread:provider:codex:native-thread:<subagent id>`. A top-level Codex thread's T3 id is known only to T3, so the hook leaves it unnamed.
- `hooks/recapTitle.ts` is a `UserPromptSubmit` hook shared with Codex that has the agent end each turn by retitling its T3 Code thread or the Herdr pane that runs it with a recap of the session; anywhere else it prints nothing.
  - **T3 Code** (`resolveT3Session` finds a thread; it wins over Herdr, as in the notification hook): it injects an instruction to call T3's `t3_thread_update` tool with `action: "rename"` and a recap title of at most 60 characters, without the project, which T3 already groups threads by. The agent leaves `threadId` out so T3 renames the calling thread, except in a native Codex subagent, which shares its parent's MCP connection and so names its own T3 thread. The agent skips the call when the title it set earlier still fits.
  - **Herdr** (`HERDR_PANE_ID` set and the pane runs the hook): it injects an instruction to end each turn by setting the Herdr pane title with `herdr pane report-metadata <pane> --source recap --title '<project>: <recap>'`. The hook writes the project itself, from the pane's workspace label (`herdr workspace get`) or else the session directory name, so the agent supplies only the recap. It writes the pane ID, binary, and socket into the command literally because Codex's `shell_environment_policy.inherit = "core"` withholds Herdr variables from the agent's shell, while hook processes still receive them.
- `hooks/turnNotification.ts` is a `Stop` hook shared with Codex; each harness passes its agent (`claude` or `codex`) as the argument. When `aerospace-sidebar` is on `PATH` and the session runs in a T3 Code thread or a Herdr pane, it pushes an aerospace-sidebar card with the agent's final message (`last_assistant_message`) as its markdown body (`--markdown`, line breaks kept with at most one blank line in a row, cut to 300 characters where no link, code, emphasis or strikethrough span is left open) and the agent's icon. An `aerospace-sidebar` older than an option exits 64 for it, and the hook then pushes again without it: first without `--key`, then also without `--markdown` (v0.0.1 has neither), skipping an attempt that would repeat the last. Outside T3 and Herdr, or without the CLI, it does nothing; it exits 1 only when the agent argument is missing or the push fails.
  - **T3 Code** (`resolveT3Session` finds a thread; it wins over Herdr): `hooks/t3.ts` reads the thread with `"$T3CODE_CLI_PATH" thread show <thread> --json --messages 0`, falling back to `t3` on `PATH`. The card is titled with the thread's title, else the session folder, keyed `t3:<thread>` (`t3:codex:<session>` for a top-level Codex thread), and clicking it opens the thread through `--open t3code://threads/<environment>/<thread>`, built from the thread's hosted `link`. When the hook cannot name the thread (a top-level Codex thread) or the T3 server does not answer, clicking runs `open -b "$__CFBundleIdentifier"` to bring the app forward.
  - **Herdr** (`HERDR_PANE_ID` set and the pane runs the hook): the card is titled with the project (the Herdr workspace label, else the session folder, as in the recap title), keyed to the pane (`--key herdr:<pane>`) so each pane keeps one card that later turns replace, and clicking it runs `herdr agent focus <pane>` and then `open -b "$__CFBundleIdentifier"` to bring the terminal forward.
- Put Claude Code-only shipped skills under `harnesses/claude-code/skills/` (grouped into `agent/` and `user/`); they override registry skills of the same name.
- Map registry commands to `commands/` and copy `system/system.md` to `CLAUDE.md`.
- Claude Code writes `projects/`, `sessions/`, `todos/`, `history.jsonl`, `file-history/`, `plugins/`, and the rest of its runtime state into the real `~/.claude` home, never into `.output/`.
- `just bootstrap` applies `.output/claude-code/` to `${CLAUDE_CONFIG_DIR:-~/.claude}`.
- Do not generate a `claude` wrapper: the real `claude` binary already reads `~/.claude`, so nothing needs to shadow it.

## Codex

- Keep the checked-in Codex reference docs under `harnesses/codex/docs/`.
- Treat `harnesses/codex/docs/` as an upstream documentation snapshot; refresh it from `https://github.com/openai/codex/tree/main/docs` when the local copy drifts.
- Preserve upstream filenames when refreshing the snapshot so links and diffs stay easy to compare.
- Keep the Codex unified-output plugin in `packages/registry-cli/src/harnesses/codex/build.ts`.
- `harnesses/codex/rules/default.rules` forbids hook-skipping, gist, and Gitleaks exception commands by argv prefix, which needs no trust step. Flags later in a command, config overrides, and shell wrappers need the `guardGitBypass.ts` hook from `harnesses/claude-code/hooks/`, shared through `config.toml`. `config.toml` also registers the shared `recapTitle.ts` `UserPromptSubmit` hook and `turnNotification.ts` `Stop` hook. Codex runs these hooks only after each is approved once per machine with `/hooks`, and again after it changes.
- Put Codex-only shipped skills under `harnesses/codex/skills/` (grouped into `agent/` and `user/`); they override registry skills of the same name in `.output/codex/skills/`.
- Package every registry command as a native skill in `.output/codex/skills/`. Copy command content unchanged into `SKILL.md`, requiring a non-empty YAML `description`, and set `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Honor an explicit `name`; otherwise derive `command-<filename>` with normalized hyphens. Fail on invalid names, duplicate commands, or collisions with staged skills. Do not generate `prompts/`. Stage command skills through `buildSupport.stageSourcePath(...)` so templates resolve once and generated command edits sync back to their source files. Copy `system/system.md` to `AGENTS.md`.
- `config.toml` is a synced settings file: `/model`, MCP, and feature changes Codex saves flow back into `harnesses/codex/config.toml`, with comments preserved. each `projects` entry, `skills.config`, and `hooks.state` (keyed by local paths), `notify`, `marketplaces.openai-bundled`, `marketplaces.openai-primary-runtime`, `mcp_servers.node_repl` (except registry entries in `env.NODE_REPL_TRUSTED_SERVICES`, merged into its JSON object after live-only preservation while retaining app-added services, and only while the app-written server declares a `command` or `url` transport; otherwise the registry entries are removed and no `node_repl` server is created, because Codex refuses to start on a server without a transport), and `mcp_servers.cua_repl` (Codex and the ChatGPT desktop app point them at machine-local binaries and caches), `notice` and `tui.model_availability_nux` (acknowledgements and counters Codex stamps itself), and `mcp_servers.*.env` and `mcp_servers.*.http_headers` (credentials) are live-only. Runtime files such as `auth.json` remain Codex-owned under `CODEX_HOME` instead of being registry-managed.
- `hooks.json` is a synced settings file. Codex loads user hooks from it as well as from `config.toml`, so hooks an installer writes there flow back into `harnesses/codex/hooks.json` on the next build and show up as a registry change. Keep registry hooks in `config.toml`.
- The build trusts every git checkout under the folders listed in `AI_REGISTRY_CODEX_TRUSTED_DIRS` by adding `projects` entries to the generated `config.toml` (see Codex Project Trust in the root `AGENTS.md`). Keep `projects` live-only per entry so generated and Codex-recorded trust merge.
- Codex writes sessions, SQLite state, worktrees, logs, and its app-server packages into the real `${CODEX_HOME:-~/.codex}` home, never into `.output/`. Codex adds system skills under the linked `skills/.system/`; the build leaves that unmanaged directory alone.
- `just bootstrap` applies `.output/codex/` to `${CODEX_HOME:-~/.codex}`.
- Do not generate a `codex` wrapper: the real `codex` binary already reads `${CODEX_HOME:-~/.codex}`, so nothing needs to shadow it.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- `opencode.jsonc` is a synced settings file: OpenCode's config updates and `mcp add`/`mcp auth` edits flow back into `harnesses/opencode/opencode.jsonc`, with absolute repository paths written back as `<%- repo_root %>` tags and comments preserved. `mcp.*.headers` and `mcp.*.environment` are live-only because `mcp add --header` and `--env` store their values literally.
- `tui.json` is a synced settings file: TUI plugins and settings that installers add flow back into `harnesses/opencode/tui.json` on the next build.
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
- `settings.json` is a synced settings file: model, theme, and thinking-level choices made in Pi flow back into `harnesses/pi/settings.json`. `lastChangelogVersion` and `extensionChangelogVersions` are live-only because Pi stamps them after Pi and extension updates.
- `just bootstrap` applies `.output/pi/` to `${PI_CODING_AGENT_DIR:-~/.pi/agent}`.
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

- Claude Code hook tests use the registry-cli fixture factories through `hooks/__tests__/fixtures.ts` and its command supervisor. Keep the test preload excluded from generated output. The coverage command validates its report inside owned scratch before removing it.
- After editing anything in `harnesses/`, run `just build`.
- Verify the generated copies in `.output/`.
