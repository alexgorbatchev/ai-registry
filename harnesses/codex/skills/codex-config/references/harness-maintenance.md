# Codex harness maintenance

Use this reference when changing files under `{{repo_root}}/harnesses/codex/`.
These files are source-of-truth inputs for generated Codex homes; `{{output_dir}}/codex/` is generated output.

## Policy surfaces

- `harnesses/codex/config.toml` seeds the managed mutable Codex config at `{{repo_root}}/.tmp/codex/config.toml` during `bun run build`.
- `harnesses/codex/rules/*.rules` ships into the generated Codex home beside `config.toml`; use this for exec-policy command rules.
- `requirements.toml` is for admin-managed policy constraints. Add it only when the requirement is an enforced policy boundary rather than a user default.
- Project-local `.codex/config.toml` and `.codex/rules/` belong in the target project, not in this registry, unless this registry itself needs project-local behavior.

## Set Up Harness Policies

1. Decide whether the behavior is a default, a command rule, or an admin constraint.
2. Edit `harnesses/codex/config.toml` for defaults such as `approval_policy`, `sandbox_mode`, model settings, features, MCP servers, hooks, or permission profiles.
3. Edit or add `harnesses/codex/rules/default.rules` for command-prefix policy. Use `decision = "allow"`, `"prompt"`, or `"forbidden"`; include `match` and `not_match` examples so Codex validates the rule at startup.
4. Prefer `forbidden` for commands the agent must not run, such as destructive Git state changes. Prefer `prompt` only when user review should remain possible.
5. Run `codex execpolicy check --pretty --rules harnesses/codex/rules/default.rules -- <command...>` for important command rules.
6. Run `bun run build` from `{{repo_root}}` after any `harnesses/codex/` change.
7. Restart Codex. Rules and config layers are loaded at startup.

## Approval And Sandbox Notes

- `approval_policy` controls whether Codex pauses for approval; `sandbox_mode` controls the execution boundary. Changing only one often does not produce the intended behavior.
- Use `approval_policy = "never"` only when no approval prompts are desired. Pairing it with `sandbox_mode = "danger-full-access"` removes Codex sandboxing and should require an external trust or isolation boundary.
- Use `sandbox_mode = "workspace-write"` for a safer default when the host can run the Codex sandbox. Configure `[sandbox_workspace_write]` only for additional writable roots and network access.
- Do not add a broad home-directory writable root casually. It can conflict with protected Codex state paths and may expose credentials or unrelated user files.

## Add A Codex-Only Skill

1. Create `harnesses/codex/skills/<skill-name>/SKILL.md` when the skill should ship only with Codex profiles.
2. Use global `skills/<skill-name>/SKILL.md` instead when the skill is reusable across harnesses.
3. Keep each skill self-contained. Do not assume another skill is present.
4. Include YAML frontmatter with `name`, `description`, and `author: alexgorbatchev`.
5. Keep `description` as routing metadata. Put workflow rules in the body, not in frontmatter.
6. Put detailed setup material in `references/setup.md`; put large reference material in `references/*.md`; add scripts or assets only when they materially improve reuse.
7. Avoid private names, internal URLs, hostnames, secrets, and other non-public details.
8. Validate changed skills with `bun {{repo_root}}/skills/skill-writer/scripts/quick_validate.ts harnesses/codex/skills/<skill-name>` when practical.
9. Run `bun run build` and inspect `{{output_dir}}/codex/default/skills/<skill-name>/` or another affected generated profile.

## Generated Output Contract

- The Codex build merges `harnesses/codex/skills/` into each generated Codex profile skills directory.
- Non-default Codex profiles keep their own `AGENTS.md` and `skills/` directory, and inherit shared top-level entries from generated `default/`.
- Never repair generated Codex output by editing `{{output_dir}}/codex/` directly; fix the source under `harnesses/codex/`, `skills/`, `commands/`, or `profiles/`, then rebuild.
