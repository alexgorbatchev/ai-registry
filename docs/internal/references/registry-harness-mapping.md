---
created_on: 2026-11-10 11:33
last_modified: 2026-11-10 11:33
status: current
---

# Registry harness mappings

For agents modifying or diagnosing these contracts. Paths are relative to the repository root.

## Codex Harness Mapping

The Codex harness writes `system/system.md` to `AGENTS.md`, renders `harnesses/codex/config.toml` into `config.toml` as a synced settings file, copies `harnesses/codex/rules/`, and stages registry and Codex-only skills under `skills/`. It packages every registry command as a native skill bundle in `skills/`, preserving command content as `SKILL.md` and setting `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Commands require YAML frontmatter with a non-empty `description`. An explicit frontmatter `name` determines the skill name; otherwise names use `command-<filename>` with leading hyphens removed and repeated hyphens collapsed. Names must be lowercase kebab-case and at most 64 characters; duplicate command names and collisions with staged skills fail the build. Invoke these workflows with `$<skill-name>` or `/skills`. Codex outputs have no managed `prompts/` directory. Runtime files such as `auth.json` remain Codex-owned under `CODEX_HOME`. No `codex` wrapper is generated.

## Codex Project Trust (`AI_REGISTRY_CODEX_TRUSTED_DIRS`)

Codex matches project trust by exact checkout path, so a trusted parent folder covers nothing beneath it. Read a PATH-style list of folders (home and registry-relative paths expand; missing paths warn and are skipped) and trust every git checkout found beneath them: every repository outside checkouts, skipping hidden folders, `node_modules`, and symlinks, plus the submodules each checkout declares in `.gitmodules`. Write the entries into the generated Codex `config.toml` only; `projects` entries are live-only, so they never reach the registry source, and an entry Codex already records, including `untrusted`, keeps its live value.

## Pi Harness Mapping

The Pi harness writes `system/system.md` to `APPEND_SYSTEM.md`, maps registry commands plus `harnesses/pi/prompts/` to `prompts/` (a name collision fails the build), stages registry and Pi-only skills under `skills/`, copies `settings.json` as a synced settings file, and copies `models.json`, `web-search.json`, and `extensions/` when `harnesses/pi/` ships them. Bootstrap also links `web-search.json` to `~/.pi/web-search.json`. The output `bin/` directory contains the `pi-install`, `pi-update`, and `pi-uninstall` helpers. No `pi` wrapper is generated, because the real `pi` binary already reads `${PI_CODING_AGENT_DIR:-~/.pi/agent}`.

## Claude Code Harness Mapping

The Claude Code harness writes `system/system.md` to `CLAUDE.md`, maps registry commands to `commands/`, stages registry and Claude Code-only skills under `skills/`, and copies every file shipped under `harnesses/claude-code/` except `skills/` into the output root. No `claude` wrapper is generated, because the real `claude` binary already reads `~/.claude`. It generates the `cll` helper for launching Claude Code through an on-prem or remote LiteLLM proxy.

## OpenCode Harness Mapping

The OpenCode harness copies `harnesses/opencode/` into the output root, syncs `opencode.jsonc` as a settings file, merges registry commands into `commands/` (a collision with a harness command fails the build), stages registry and OpenCode-only skills under `skills/`, and generates the `air-opencode-*` helpers. It generates no agents; the shared system prompt reaches OpenCode through `instructions` in `opencode.jsonc`.
