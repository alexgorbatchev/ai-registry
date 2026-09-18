# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `bun run build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs and profile includes, not copied verbatim into `.output/` unless a harness explicitly ships them.
- Do not place repo-only maintenance notes inside a harness subdirectory unless they are intentionally meant to ship into generated output.
- If a unified harness needs custom output shaping beyond raw file copying, put the repo-local build plugin at `packages/registry-cli/src/harnesses/<name>/build.ts`.
- Create directories the harness tool owns at runtime (session stores, logs, todo lists) with `context.buildSupport.ensureRuntimeDirectory(...)`, not `mkdir`. That registers them as ensure-present, unmanaged output so the manifest never tracks them and the tool pruning them never shows up as drift. Codex uses it for `sessions/`, `log/`, and `.tmp/`; Pi for `sessions/`; Claude Code for all of its state directories.
- Prefer the harness's native configuration surface over local wrapper files when the harness already supports the feature directly.
- Pin external plugin versions and commit SHAs so generated outputs stay reproducible.

Harnesses are only built into `.output/` when they provide `packages/registry-cli/src/harnesses/<name>/build.ts`.

## Claude Code

- Keep shipped Claude Code config under `harnesses/claude-code/`, using Claude Code's native config-directory layout (`settings.json`, `commands/`, `agents/`, `output-styles/`, and so on).
- Keep the Claude Code unified-output plugin in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- Keep `harnesses/claude-code/settings.json` keys sorted alphabetically, nested objects included. Claude Code rewrites that file with sorted keys whenever a setting changes in the app (theme, permissions, and so on). If the checked-in source uses any other order, the app's rewrite reads as external drift and the next `bun run build` refuses to run until it is confirmed with `-y`.
- Every file under `harnesses/claude-code/` except `skills/` is copied verbatim into the generated `default` profile root, so new native config surfaces need no build changes. `skills/` is excluded through `.registry-ignore` because the build symlinks those bundles into every generated profile root instead of copying them.
- Put Claude Code-only shipped skills under `harnesses/claude-code/skills/`; the build merges them into each generated `.output/claude-code/<profile>/skills/` root.
- The Claude Code harness treats `.output/claude-code/default/` as the shared Claude Code base. Every non-default generated profile root under `.output/claude-code/<profile>/` symlinks all top-level entries from `default/` except `CLAUDE.md` and `skills/`.
- Map reusable commands to `commands/` only from the `default` profile. Render `CLAUDE.md` separately for each profile from that profile's `system_prompt`, and generate selected skills into each profile's own `skills/` directory.
- Materialize the runtime directories Claude Code writes into (`sessions/`, `projects/`, `todos/`, `shell-snapshots/`, `file-history/`, `session-env/`, `statsig/`, `plugins/`) in the default root through `buildSupport.ensureRuntimeDirectory(...)` so every profile shares one history and plugin install. They are ensure-present, unmanaged: excluded from `manifest.json`, never drift, never removed by sync, recreated when Claude Code prunes them. Treat everything Claude Code writes there as tool-owned.
- Plain `bun run bootstrap` links the generated `default` Claude Code profile root into `${CLAUDE_CONFIG_DIR:-~/.claude}`. Use `bun run bootstrap -- --claude-code-profile <profile>` to override that link with another generated Claude Code profile root.
- Generate `claude-<profile>` launchers under `.output/bin/` for non-default generated Claude Code profiles only. Do not generate a `claude` wrapper: unlike Codex and Pi, the default profile is already reached through the `~/.claude` symlink, so nothing needs to shadow the real `claude` binary.
- Claude Code reads `CLAUDE.md`, not `AGENTS.md`. The build symlinks the vendored `vendor/claude-agents-md/agents-md-vfs.js` preload into the generated `default` root as `agents-md-vfs.js`, so every generated profile exposes it at `$CLAUDE_CONFIG_DIR/agents-md-vfs.js`, and it fails when the vendored file is missing. `claude-<profile>` launchers export `BUN_OPTIONS="--require <profile root>/agents-md-vfs.js"` before launching the real binary. The bare `claude` command gets the same `BUN_OPTIONS` merge from the shell configuration that defines a `claude()` function, not from this repository. Never add `CLAUDE.md` files or `@AGENTS.md` import shims to projects to work around this; refresh the vendored preload per `vendor/claude-agents-md/README.md` instead.
- Do not silently ignore profile `tools` or `permission`; the Claude Code build must fail until an exact Claude Code-native mapping exists.

## Codex

- Keep the checked-in Codex reference docs under `harnesses/codex/docs/`.
- Treat `harnesses/codex/docs/` as an upstream documentation snapshot; refresh it from `https://github.com/openai/codex/tree/main/docs` when the local copy drifts.
- Preserve upstream filenames when refreshing the snapshot so links and diffs stay easy to compare.
- Keep the Codex unified-output plugin in `packages/registry-cli/src/harnesses/codex/build.ts`.
- Put Codex-only shipped skills under `harnesses/codex/skills/`; the Codex build merges them into each generated `.output/codex/<profile>/skills/` root.
- The Codex harness treats `.output/codex/default/` as the shared Codex base. Every non-default generated profile root under `.output/codex/<profile>/` symlinks all top-level entries from `default/` except `AGENTS.md` and `skills/`.
- Map reusable commands only from the `default` profile. Render `AGENTS.md` separately for each profile from that profile's `system_prompt`, and generate selected skills into each profile's own Codex `skills/` directory.
- Treat `harnesses/codex/config.toml` as the seed configuration for Codex. The generated `default` Codex root symlinks only `config.toml` to `{{repo_root}}/.tmp/codex/`, and non-default generated Codex roots inherit that shared entry by symlinking back to `default/`. Runtime files such as `auth.json` remain Codex-owned under the active `CODEX_HOME` instead of being registry-managed.
- Plain `bun run bootstrap` links the generated `default` Codex profile root into `${CODEX_HOME:-~/.codex}`. Use `bun run bootstrap -- --codex-profile <profile>` to override that link with another generated Codex profile root.
- Generate `codex-<profile>` launchers under `.output/bin/` for non-default generated Codex profiles only. Do not generate a bare `codex` wrapper: the default profile is already reached through the `${CODEX_HOME:-~/.codex}` symlink, so nothing needs to shadow the real `codex` binary.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- Keep the OpenCode unified-output plugin in `packages/registry-cli/src/harnesses/opencode/build.ts`.
- OpenCode agent generation auto-allows harness-local skills that match the current harness prefix (for example `opencode-*`) in addition to matched global skills and profile-local skills.
- Prefer direct package specs such as `name@version`.
- For unpublished plugins, use a pinned Git spec or a direct `file://...` spec.
- If a local file plugin needs runtime dependencies from the repo install, vendor the package under `vendor/<name>/` as a Bun workspace and point `opencode.jsonc` at `file://{{repo_root}}/vendor/<name>/...`.
- Keep shipped OpenCode config in `harnesses/opencode/`, but keep installable third-party plugin source out of that directory unless it truly needs to be copied into generated output.
- Do not add proxy wrapper plugins under `harnesses/opencode/plugins/` unless a plugin truly must be loaded from a local file entrypoint.
- Use tuple form `[spec, { ... }]` only when a plugin needs inline startup options.

## Pi

- Keep shipped Pi skeleton files under `harnesses/pi/agent/`.
- Keep the Pi unified-output plugin in `packages/registry-cli/src/harnesses/pi/build.ts`.
- The Pi harness treats `.output/pi/default/` as the shared Pi base. Every non-default generated profile root under `.output/pi/<profile>/` symlinks all top-level entries from `default/` except `APPEND_SYSTEM.md` and `skills/`.
- Map reusable commands, the shared `settings.json`, and the static shared `sessions/` directory only from the `default` profile. Render `APPEND_SYSTEM.md` separately for each profile from that profile's `system_prompt`, and generate selected skills into each profile's own Pi `skills/` directory.
- Plain `bun run bootstrap` links the generated `default` Pi profile root into `${PI_CODING_AGENT_DIR:-~/.pi/agent}`. Use `bun run bootstrap -- --pi-profile <profile>` to override that link with another generated Pi profile root.
- Generate `pi-<profile>` launchers under `.output/bin/` for non-default generated Pi profiles only, plus the `pi-install`, `pi-update`, and `pi-uninstall` helpers. Do not generate a bare `pi` wrapper: the default profile is already reached through the `${PI_CODING_AGENT_DIR:-~/.pi/agent}` symlink, so nothing needs to shadow the real `pi` binary.
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
