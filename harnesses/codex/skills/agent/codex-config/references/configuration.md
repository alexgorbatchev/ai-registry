# Codex configuration reference

## Table of contents

1. [Primary sources](#primary-sources)
2. [Configuration files and state locations](#configuration-files-and-state-locations)
3. [Precedence and trust](#precedence-and-trust)
4. [Decision guide](#decision-guide)
5. [Top-level configuration families](#top-level-configuration-families)
6. [Important interactions and gotchas](#important-interactions-and-gotchas)
7. [Admin-managed `requirements.toml`](#admin-managed-requirementstoml)
8. [Representative snippets](#representative-snippets)

## Primary sources

- Checked-in Codex docs snapshot: `{{repo_root}}/harnesses/codex/docs/`
- Main config entrypoint in the snapshot: `{{repo_root}}/harnesses/codex/docs/config.md`
- Related snapshot docs that materially affect config advice:
  - `authentication.md`
  - `sandbox.md`
  - `execpolicy.md`
  - `skills.md`
  - `agents_md.md`
  - `example-config.md`
- The snapshot mostly links to live OpenAI documentation. If the task depends on current behavior, confirm against the linked developer docs before making definitive claims.

## Configuration files and state locations

### Main files

- User config: `~/.codex/config.toml`
- Project config: `.codex/config.toml`
- System config on Unix: `/etc/codex/config.toml`
- Hooks can also live beside a config layer as `hooks.json`
- Admin policy: `requirements.toml`

### State under `CODEX_HOME`

Codex stores mutable runtime state under `CODEX_HOME` (default `~/.codex`). Common files include:

- `config.toml`
- `auth.json` if file-backed credentials are used
- `history.jsonl`
- logs and caches

Do not confuse these state files with portable project configuration.

## Precedence and trust

Codex resolves values in this order:

1. CLI flags and `--config` overrides
2. Selected profile (`--profile <name>`)
3. Trusted project `.codex/config.toml` files from project root to the current working directory; the closest file wins for conflicts
4. User config
5. System config
6. Built-in defaults

Security-critical trust behavior:

- Project `.codex/` layers only load for trusted projects.
- Untrusted projects skip project-local config, hooks, and rules.
- User and system config still load even when the project is untrusted.
- `projects.<path>.trust_level` can mark a repo or worktree as trusted or untrusted.

Relative-path rule:

- Relative paths inside a project `.codex/config.toml` resolve relative to the `.codex/` directory that contains that file.

## Decision guide

Use this routing before editing config:

- **Personal default across many repos** → user `~/.codex/config.toml`
- **Repo-specific behavior** → project `.codex/config.toml`
- **Named operating mode** → `[profiles.<name>]`
- **Per-agent role behavior** → `agents.<name>.config_file`
- **Admin guardrails** → `requirements.toml`
- **Per-app or per-tool gating** → `[apps]` and `apps.<id>.tools.<tool>`
- **Per-skill enable/disable** → `[[skills.config]]`
- **Filesystem/network policy reuse** → `default_permissions` plus `[permissions.<name>]`

## Top-level configuration families

### 1. Core model and provider selection

Key families:

- `model`
- `model_provider`
- `service_tier`
- `oss_provider`
- `review_model`
- `openai_base_url`
- `model_catalog_json`
- `model_context_window`
- `model_auto_compact_token_limit`
- `tool_output_token_limit`

Notes:

- Use `openai_base_url` when you want the built-in OpenAI provider to target a different base URL.
- Custom providers live under `[model_providers.<id>]`.
- Reserved provider IDs cannot be redefined: `openai`, `ollama`, and `lmstudio`.

### 2. Model behavior and reasoning

Key families:

- `model_reasoning_effort`
- `plan_mode_reasoning_effort`
- `model_reasoning_summary`
- `model_supports_reasoning_summaries`
- `model_verbosity`
- `personality`

Use these when the question is about how verbose or deliberative Codex should be, not which provider it should call.

### 3. Instructions, project docs, and root discovery

Key families:

- `developer_instructions`
- `model_instructions_file`
- `compact_prompt`
- `experimental_compact_prompt_file`
- `project_doc_max_bytes`
- `project_doc_fallback_filenames`
- `project_root_markers`

Important details:

- `model_instructions_file` replaces built-in instructions.
- `instructions` exists in the reference but is reserved; prefer `model_instructions_file` or `AGENTS.md`.
- Setting `project_root_markers = []` disables parent-directory project root discovery and treats the current directory as the project root.

### 4. Approval policy, sandboxing, and login-shell behavior

Key families:

- `approval_policy`
- `approvals_reviewer`
- `sandbox_mode`
- `allow_login_shell`
- `[sandbox_workspace_write]`

Important details:

- `approval_policy` supports string modes and a granular object.
- Granular approvals can independently allow or auto-reject prompts for sandbox escalation, rules, MCP elicitations, `request_permissions`, and skill approval.
- `approvals_reviewer = "auto_review"` routes eligible approvals through automatic review rather than the user.
- `sandbox_mode` controls the broad execution boundary, but permissions profiles can further shape actual access.

`[sandbox_workspace_write]` keys:

- `writable_roots`
- `network_access`
- `exclude_tmpdir_env_var`
- `exclude_slash_tmp`

### 5. Named permission profiles

Key families:

- `default_permissions`
- `[permissions.<name>.filesystem]`
- `[permissions.<name>.network]`

Built-in names:

- `:read-only`
- `:workspace`
- `:danger-no-sandbox`

Important details:

- Custom names omit the leading colon and must have matching `permissions` tables.
- `permissions.<name>.filesystem.":project_roots"` allows rules scoped relative to detected project roots.
- Filesystem rules support `read`, `write`, and `none`.
- Network permissions can define domains, Unix sockets, SOCKS5 exposure, local binding, upstream proxies, and limited vs full proxy modes.

### 6. Shell environment policy and command execution context

Key families:

- `[shell_environment_policy]`
  - `inherit`
  - `include_only`
  - `exclude`
  - `set`
  - `ignore_default_excludes`
  - `experimental_use_profile`

Important details:

- This controls environment variable forwarding to subprocesses.
- `ignore_default_excludes = true` weakens the default filtering for variables containing names like `KEY`, `SECRET`, or `TOKEN`; treat that as a sensitive change.
- `background_terminal_max_timeout` governs empty poll windows for background terminal behavior.

### 7. Profiles and per-layer overrides

Key families:

- `profile`
- `[profiles.<name>]`
- `profiles.<name>.*`

Profiles can override almost any supported config key, including:

- model and provider selection
- reasoning and personality
- instruction files
- service tier
- web search mode
- Windows sandbox settings
- feature flags
- OSS provider

Profiles are intended for named modes, not as a substitute for understanding precedence.

### 8. Agent orchestration

Key families:

- `[agents]`
  - `max_threads`
  - `max_depth`
  - `job_max_runtime_seconds`
- `agents.<name>.description`
- `agents.<name>.config_file`
- `agents.<name>.nickname_candidates`

Use these when the task involves subagents or reviewer roles rather than single-threaded Codex behavior.

### 9. Hooks

Key families:

- `[hooks]` inline in `config.toml`
- sibling `hooks.json`

Important details:

- Hooks are gated by `[features].codex_hooks`.
- A layer may contain both `hooks.json` and inline `[hooks]`; Codex loads both and warns.
- Project hooks only load for trusted projects.

### 10. MCP servers and OAuth

Key families:

- `mcp_oauth_callback_port`
- `mcp_oauth_callback_url`
- `mcp_oauth_credentials_store`
- `[mcp_servers.<id>]`

Notable MCP server keys:

- `command`, `args`, `cwd`
- `url`
- `enabled`, `required`
- `enabled_tools`, `disabled_tools`
- `env`, `env_vars`
- `http_headers`, `env_http_headers`
- `scopes`, `oauth_resource`
- `startup_timeout_sec`, `startup_timeout_ms`, `tool_timeout_sec`
- `bearer_token_env_var`
- `experimental_environment = "remote"`

Important details:

- `required = true` can fail startup or resume if the MCP server cannot initialize.
- `env_vars` supports structured entries with `source = "local" | "remote"`.
- Remote placement exists for stdio MCP servers as an experimental environment.

### 11. Apps, connectors, and tool suggestion controls

Key families:

- `[apps._default]`
- `[apps.<id>]`
- `[apps.<id>.tools.<tool>]`
- `[tool_suggest]`

Use these when the request is about connectors, app/tool gating, destructive tool handling, or installation suggestions.

Important details:

- Controls layer from global defaults to per-app to per-tool overrides.
- App tool approval modes use `auto`, `prompt`, or `approve`.
- Tool suggestions can be shaped separately from enabling a tool outright.

### 12. Skills and project capabilities

Key families:

- `[[skills.config]]`
  - `path`
  - `enabled`

Use this when the task is about enabling or disabling a specific skill by path without deleting it.

### 13. Web search and tool controls

Key families:

- `web_search`
- `[tools]`
- `profiles.<name>.web_search`

Important details:

- Top-level `web_search` supports `disabled`, `cached`, and `live`.
- The legacy `[features].web_search*` flags are deprecated.
- The full reference also exposes richer `tools.web_search` configuration than the sample config shows, including controls such as context sizing, allowed domains, and approximate location.

### 14. Memories

Key families:

- `[features].memories`
- `[memories]`

Representative tuning keys:

- `generate_memories`
- `use_memories`
- `disable_on_external_context`
- `extract_model`
- `consolidation_model`
- rollout, retention, and rate-limit tuning keys

Use this family when the question is about memory generation or injection, not general chat history persistence.

### 15. Features

Representative `[features]` keys:

- `apps`
- `codex_hooks`
- `enable_request_compression`
- `fast_mode`
- `memories`
- `multi_agent`
- `personality`
- `prevent_idle_sleep`
- `shell_snapshot`
- `shell_tool`
- `skill_mcp_dependency_install`
- `undo`
- `unified_exec`

Important details:

- `experimental_use_unified_exec_tool` is legacy; prefer `[features].unified_exec`.
- Some older `web_search` feature flags remain for compatibility but are deprecated.

### 16. Observability, telemetry, analytics, and history

Key families:

- `[otel]`
- `otel.exporter`
- `otel.trace_exporter`
- `otel.metrics_exporter`
- `[analytics]`
- `[feedback]`
- `[history]`
- `log_dir`
- `sqlite_home`

Important details:

- OTel is opt-in for export, but analytics can still be enabled independently.
- `otel.log_user_prompt = true` exports raw user prompts; treat that as a privacy-sensitive setting.
- The advanced docs describe a large emitted event and metric surface; use that only when the user actually needs observability detail.

### 17. Authentication and login routing

Key families:

- `cli_auth_credentials_store`
- `chatgpt_base_url`
- `forced_login_method`
- `forced_chatgpt_workspace_id`
- `openai_base_url`

Use these for login flow, workspace restrictions, and credential storage. Do not confuse ChatGPT login configuration with model provider configuration.

### 18. UI and UX settings

Key families:

- `[tui]`
- `[tui.keymap.global]`
- `[tui.keymap.composer]`
- `file_opener`
- `notify`
- `hide_agent_reasoning`
- `show_raw_agent_reasoning`
- `disable_paste_burst`
- `notice.*`

Use these when the task is about terminal behavior, editor integration, notifications, or presentation rather than model execution.

### 19. Windows-specific settings

Key families:

- `[windows]`
  - `sandbox`
  - `sandbox_private_desktop`
- `windows_wsl_setup_acknowledged`

The docs recommend native Windows sandbox mode `elevated` when possible.

## Important interactions and gotchas

- Approval policy and sandbox mode are separate. Lowering approvals does not automatically expand filesystem or network access.
- `default_permissions` can materially change what `workspace-write` or `read-only` means in practice.
- Untrusted projects ignore project `.codex/` config, hooks, and rules entirely.
- `hooks.json` plus inline `[hooks]` in the same layer is valid but noisy because Codex warns.
- `notify` runs an external command and receives a JSON payload.
- `model_instructions_file` is a replacement mechanism, not a small additive hint.
- For built-in OpenAI routing, prefer `openai_base_url` instead of creating a redundant custom provider.
- `mcp_servers.<id>.required = true` can prevent startup or resume.
- `shell_environment_policy.ignore_default_excludes = true` is powerful and easy to misuse.
- The sample config is broad, but the full reference covers more than it shows: per-skill config, richer tool/web-search controls, Windows-private-desktop settings, more admin policy, and full observability exporters.

## Admin-managed `requirements.toml`

`requirements.toml` is the enterprise/admin policy surface that constrains user config.

Key concepts:

- allowlists for security-sensitive choices such as:
  - `allowed_approval_policies`
  - `allowed_approvals_reviewers`
  - `allowed_sandbox_modes`
  - `allowed_web_search_modes`
- managed `[features]` values that pin feature flags
- managed `guardian_policy_config` that overrides local `[auto_review].policy`
- managed hooks with the same event schema as normal hooks, but with additional restrictions
- MCP allowlisting by server identity (`command` or `url`)
- admin-enforced filesystem deny-read lists under permissions policy
- `remote_sandbox_config[]` for host-pattern-based sandbox constraints
- restrictive prefix command rules where requirements are allowed to force `prompt` or `forbidden`, not `allow`

When a user asks why a config value “won’t stick,” check whether managed requirements are constraining it.

## Representative snippets

### Safe personal default

```toml
model = "gpt-5.5"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
default_permissions = ":workspace"
web_search = "cached"
```

### Named profile for deeper review

```toml
profile = "deep-review"

[profiles.deep-review]
model = "gpt-5-pro"
model_reasoning_effort = "high"
approval_policy = "on-request"
```

### Custom permissions profile

```toml
default_permissions = "workspace"

[permissions.workspace.filesystem]
":project_roots" = { "." = "write", "**/*.env" = "none" }
glob_scan_max_depth = 3

[permissions.workspace.network]
enabled = true
mode = "limited"

[permissions.workspace.network.domains]
"api.openai.com" = "allow"
```

### Project-local MCP server

```toml
[mcp_servers.docs]
command = "docs-server"
args = ["--port", "4000"]
required = true
enabled_tools = ["search", "summarize"]
```

### Built-in OpenAI base URL override

```toml
openai_base_url = "https://us.api.openai.com/v1"
```

### Custom provider with token command

```toml
model_provider = "proxy"

[model_providers.proxy]
name = "OpenAI using LLM proxy"
base_url = "https://proxy.example.com/v1"
wire_api = "responses"

[model_providers.proxy.auth]
command = "/usr/local/bin/fetch-codex-token"
args = ["--audience", "codex"]
timeout_ms = 5000
refresh_interval_ms = 300000
```
