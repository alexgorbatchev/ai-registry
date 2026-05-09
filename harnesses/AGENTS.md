# Harnesses

This directory contains source-of-truth harness overrides and maintenance notes for generated configs.

## General Rules

- Keep harness-specific behavior inside `harnesses/<name>/`.
- Only files under `harnesses/<name>/` are copied into that harness output during `bun run build`.
- Shared repo-level system instruction fragments live under `system/`; they are referenced from harness configs and profile includes, not copied verbatim into `.output/` unless a harness explicitly ships them.
- Do not place repo-only maintenance notes inside a harness subdirectory unless they are intentionally meant to ship into generated output.
- If a unified harness needs custom output shaping beyond raw file copying, put the repo-local build plugin at `harnesses/<name>/scripts/build.ts` and keep that path ignored via `.registry-ignore`.
- Prefer the harness's native configuration surface over local wrapper files when the harness already supports the feature directly.
- Pin external plugin versions and commit SHAs so generated outputs stay reproducible.

Harnesses are only built into `.output/` when they provide `harnesses/<name>/scripts/build.ts`.

## Codex

- Keep the checked-in Codex reference docs under `harnesses/codex/docs/`.
- Treat `harnesses/codex/docs/` as an upstream documentation snapshot; refresh it from `https://github.com/openai/codex/tree/main/docs` when the local copy drifts.
- Preserve upstream filenames when refreshing the snapshot so links and diffs stay easy to compare.
- Keep the Codex unified-output plugin in `harnesses/codex/scripts/build.ts`.
- Put Codex-only shipped skills under `harnesses/codex/skills/`; the Codex build merges them into each generated `.output/codex/<profile>/skills/` root.
- The Codex harness treats `.output/codex/default/` as the shared Codex base. Every non-default generated profile root under `.output/codex/<profile>/` symlinks all top-level entries from `default/` except `skills/`.
- Map reusable commands and the generated home-level `AGENTS.md` only from the `default` profile. Generate selected skills into each profile's own Codex `skills/` directory.
- Treat `harnesses/codex/config.toml` as the seed for the mutable Codex config file. The generated `default` Codex root symlinks `config.toml` to `{{repo_root}}/.tmp/codex/`, and non-default generated Codex roots inherit that shared entry by symlinking back to `default/`. Runtime files such as `auth.json` remain Codex-owned under the active `CODEX_HOME` instead of being registry-managed.
- Plain `bun run bootstrap` links the generated `default` Codex profile root into `${CODEX_HOME:-~/.codex}`. Use `bun run bootstrap -- --codex-profile <profile>` to override that link with another generated Codex profile root.
- Generate `codex` for the `default` profile and `codex-<profile>` for other generated Codex profiles under `.output/bin/`.

## OpenCode

- Register external OpenCode plugins in `harnesses/opencode/opencode.jsonc` under the `plugin` array.
- Keep the OpenCode unified-output plugin in `harnesses/opencode/scripts/build.ts`.
- Prefer direct package specs such as `name@version`.
- For unpublished plugins, use a pinned Git spec or a direct `file://...` spec.
- If a local file plugin needs runtime dependencies from the repo install, vendor the package under `vendor/<name>/` as a Bun workspace and point `opencode.jsonc` at `file://{{repo_root}}/vendor/<name>/...`.
- Keep shipped OpenCode config in `harnesses/opencode/`, but keep installable third-party plugin source out of that directory unless it truly needs to be copied into generated output.
- Do not add proxy wrapper plugins under `harnesses/opencode/plugins/` unless a plugin truly must be loaded from a local file entrypoint.
- Use tuple form `[spec, { ... }]` only when a plugin needs inline startup options.

## Pi

- Keep shipped Pi skeleton files under `harnesses/pi/agent/`.
- Keep the Pi unified-output plugin in `harnesses/pi/scripts/build.ts`.
- The Pi harness treats `.output/pi/default/` as the shared Pi base. Every non-default generated profile root under `.output/pi/<profile>/` symlinks all top-level entries from `default/` except `skills/`.
- Map reusable commands, `APPEND_SYSTEM.md`, the shared `settings.json`, and the static shared `sessions/` directory only from the `default` profile. Generate selected skills into each profile's own Pi `skills/` directory.
- Plain `bun run bootstrap` links the generated `default` Pi profile root into `${PI_CODING_AGENT_DIR:-~/.pi/agent}`. Use `bun run bootstrap -- --pi-profile <profile>` to override that link with another generated Pi profile root.
- Generate `pi` for the `default` profile and `pi-<profile>` for other generated Pi profiles under `.output/bin/`.
- Do not silently ignore profile `tools` or `permission`; the Pi build must fail until an exact Pi-native mapping exists.

## Maintenance

- After editing anything in `harnesses/`, run `bun run build`.
- Verify the generated copies in `.output/`.
