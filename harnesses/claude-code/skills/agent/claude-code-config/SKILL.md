---
name: claude-code-config
description: Configure Claude Code (`claude`) memory, settings, skills, commands, subagents, and hooks. Use when working with Claude Code config surfaces such as `settings.json`, `CLAUDE.md`, `commands/`, `skills/`, `agents/`, `hooks`, `output-styles/`, or `CLAUDE_CONFIG_DIR`, and when mapping another harness's prompts or skills into Claude Code's native configuration surface.
author: alexgorbatchev
metadata:
  created_on: 2026-09-18 18:00
  last_modified: 2026-09-19 15:10
  status: current
---

# Claude Code Config

- Prefer Claude Code's native configuration surface over wrapper layers.
- The user-global config directory is `~/.claude/`. Override it with the `CLAUDE_CONFIG_DIR` environment variable; the whole directory moves, including settings, memory, skills, commands, and runtime state.
- Settings resolve from lowest to highest precedence: user `settings.json`, project `.claude/settings.json`, project `.claude/settings.local.json`, then enterprise managed policy. Later layers override earlier ones.
- Use `settings.json` for durable, shareable configuration. Use `settings.local.json` for machine-specific values that must not be committed.

## Configuration Surfaces

- `settings.json` holds `permissions`, `env`, `hooks`, `model`, `statusLine`, and similar options. It is JSON, not JSONC, so do not add comments.
- Keys in `settings.json` must be kept sorted alphabetically, nested objects included.
- `env` under `settings.json` defines session environment variables (e.g. `CLAUDE_CODE_MAX_CONTEXT_TOKENS` for overriding context window limits on custom/LiteLLM models).
- `CLAUDE.md` in the config directory is user-global memory that is prepended to every session. Project memory lives in `./AGENTS.md`, `./CLAUDE.md`, and `./.claude/CLAUDE.md`.
- `commands/*.md` are user slash commands, invoked as `/<filename>`. Frontmatter supports `description`, `argument-hint`, `allowed-tools`, and `model`.
- `skills/<name>/SKILL.md` are Agent Skills. Frontmatter requires `name` and `description`; the description is the only routing signal, so state both what the skill does and when to use it.
- `agents/*.md` are subagent definitions with `name`, `description`, `tools`, and `model` frontmatter.
- `output-styles/*.md` replace the default response style.
- `plugins/` holds installed plugins and marketplace state. Treat it as runtime state, not as an editing surface.

## Permissions

- `permissions.allow`, `permissions.deny`, and `permissions.ask` take tool rule strings such as `Bash(git commit:*)`, `Edit`, `Read(./secrets/**)`, or `WebFetch(domain:example.com)`.
- `deny` always wins over `allow`. Use `deny` for hard boundaries and `ask` for confirmation gates.
- Do not translate another harness's permission model into these rules by guessing. Reject an unsupported permission or tool-policy model instead of silently dropping it.

## AGENTS.md Support

- Claude Code natively supports `AGENTS.md` for project memory alongside `CLAUDE.md`.
- Treat `AGENTS.md` as the shared cross-harness project instruction file.
- When both `AGENTS.md` and `CLAUDE.md` exist, `CLAUDE.md` serves as Claude-specific instructions that layer on top.

## Runtime State

Claude Code writes runtime state into the config directory. Treat these entries as tool-owned and never as generated output:

- `projects/`, `sessions/`, `todos/`, `shell-snapshots/`, `file-history/`, `session-env/`, `statsig/`
- `history.jsonl`, `.claude.json`, `backups/`, `cache/`, `downloads/`

## Translation Rules

When translating another harness into Claude Code:

1. Map Markdown commands to `commands/`.
2. Map skill bundles to `skills/`.
3. Map additive persona text to `CLAUDE.md`.
4. Map named agent personas to `agents/`, or to separate config directories selected with `CLAUDE_CONFIG_DIR` when each persona needs its own settings and skill set.
5. Reject unsupported permission or tool-policy models instead of silently dropping them.
