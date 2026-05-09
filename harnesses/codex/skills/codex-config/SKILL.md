---
name: codex-config
description: Configure Codex local clients, project `.codex/` layers, profiles, providers, approvals, permissions, hooks, MCP servers, and enterprise policy files. Use when the task involves `~/.codex/config.toml`, `.codex/config.toml`, `requirements.toml`, or explaining Codex configuration precedence and override behavior.
author: alexgorbatchev
---

# Codex Config

Use this skill for Codex configuration work rather than generic prompting or skill-authoring questions. Ground answers in the checked-in snapshot under `{{repo_root}}/harnesses/codex/docs/`, then follow the linked OpenAI docs when the task depends on current release behavior.

## Workflow

1. Identify the config surface before proposing changes.
   - Use `config.toml` for user, project, profile, provider, tool, sandbox, MCP, and UI behavior.
   - Use `requirements.toml` for admin-enforced policy constraints.
   - Use `hooks.json`, `.codex/`, and `AGENTS.md` only when the task is about project-local behavior layered on top of Codex config.
2. Determine the active layer and precedence.
   - CLI flags and `--config` overrides win.
   - Selected profiles override lower layers.
   - Trusted project `.codex/config.toml` files load from project root down to the current working directory; the closest file wins for conflicts.
   - User config, then system config, then built-in defaults apply underneath.
   - Admin-managed requirements can still forbid values that user config would otherwise allow.
3. Keep the change as narrow as possible.
   - Prefer a project `.codex/config.toml` when the behavior is repo-specific.
   - Prefer a user config change when the behavior should follow the person across repos.
   - Prefer a profile when the user switches between repeatable modes such as deep review vs lightweight edits.
4. Check interacting settings before finalizing.
   - Approval policy and sandbox mode are separate controls.
   - `default_permissions` and `[permissions.<name>]` may tighten or expand filesystem and network behavior beyond the coarse sandbox label.
   - Trusted-project status decides whether project-local config, hooks, and rules load at all.
   - Provider settings, MCP settings, and tool gates often have per-profile or per-app overrides.
5. Read `references/configuration.md` whenever you need exact key families, lesser-known knobs, or `requirements.toml` policy details.
6. Read `references/harness-maintenance.md` before changing checked-in Codex harness policies, rules, or Codex-only skills in this registry.

## Working rules

- Treat `config.toml` values as TOML, not JSON. When showing `codex --config ...` examples, use TOML quoting rules.
- Do not recommend insecure combinations such as `approval_policy = "never"` plus `sandbox_mode = "danger-full-access"` unless the user explicitly wants that risk and no admin policy forbids it.
- Distinguish persistent configuration from runtime state under `CODEX_HOME` such as `auth.json`, `history.jsonl`, logs, and caches.
- For project config, call out that relative paths resolve from the `.codex/` directory that contains the active `config.toml`.
- For built-in OpenAI routing changes, prefer `openai_base_url` instead of inventing a duplicate custom provider.
- For hooks, note that a single layer can define either `hooks.json` or inline `[hooks]`; Codex loads both if present and warns.
- For project trust, state plainly that untrusted projects skip project-local `.codex/config.toml`, hooks, and rules.
- For this registry, edit Codex harness source under `{{repo_root}}/harnesses/codex/`, then run `bun run build`; do not hand-edit `{{output_dir}}/codex/`.

## Read this reference on demand

- `references/configuration.md` — comprehensive configuration guide organized by layer, key family, security model, override scope, and admin policy.
- `references/harness-maintenance.md` — repo-local workflow for Codex harness policies, exec rules, and Codex-only skills under `{{repo_root}}/harnesses/codex/`.
