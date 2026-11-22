---
created_on: 2026-11-21 07:00
last_modified: 2026-11-21 11:22
status: current
---

## Commands

- `agent-auth`: root command; prints help when no subcommand is given.
- `agent-auth provider`: provider command group.
- `agent-auth provider list`: list supported providers (`codex`, `claude`, `agy` with alias `antigravity`), their default and supported methods, logout support, and whether each binary is on `PATH`.
- `agent-auth provider status [name]`: inspect authentication status for one provider or all providers when `[name]` is omitted.
- `agent-auth provider usage [name]`: fetch normalized usage and rate-limit quota buckets (`used_fraction`, `remaining_fraction`, `reset_time`) for one provider or all providers when `[name]` is omitted.
- `agent-auth provider login <name>`: launch a detached per-session worker, wait for the provider auth URL (and optional user code), print the session snapshot, and exit immediately.
- `agent-auth provider logout <name>`: sign out of `<name>` using its native logout command.
- `agent-auth session`: session command group for managing active sign-in sessions.
- `agent-auth session submit <id>`: submit user input (authorization code or callback URL) to the active session worker and wait for authentication to finish. When `expected_input.required` is `false` and no input is supplied, falls through to waiting.
- `agent-auth session wait <id>`: wait up to `--timeout` seconds for an active session to complete without pasting input. Returns exit `3` with the current snapshot if still pending.
- `agent-auth session status <id>`: inspect the current snapshot of an active session without blocking.
- `agent-auth session list`: list active sessions and reap stale sockets from exited workers.
- `agent-auth session cancel <id>`: cancel an active session, terminate its child process group, and remove its socket and metadata.
- `agent-auth completion`: shell completion command group.
- `agent-auth completion script <shell>`: print a completion script for `<shell>` (`bash`, `zsh`, `fish`, or `powershell`).
- `agent-auth skill`: print the offline Skills CLI install command and canonical skill URL identically in human and agent modes. Accepts no positional arguments or command-specific flags.
- `agent-auth help [COMMAND...]`: print help for any command path. `--help` and `-h` print help on every command; agent help starts with the skill alert.

## Global flags

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--json` | bool | false | Print machine-readable JSON envelopes (`schema_version: 1`) |
| `--runtime-dir <dir>` | path | unset; uses `AGENT_AUTH_RUNTIME_DIR`, `$XDG_RUNTIME_DIR/agent-auth` on Linux, or `/tmp/agent-auth-<uid>` | Override the private `0700` per-user runtime socket directory |
| `--version` | bool | false | Print the raw version string and newline |
| `--help`, `-h` | bool | false | Print help without side effects |

## Provider flags

| Flag | Type | Default | Commands | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--provider-bin <path>` | path | unset; resolved from `PATH` | `provider status`, `provider usage`, `provider login`, `provider logout` | Explicit provider executable path (requires naming `[name]` for `provider status` and `provider usage`) |
| `--home <dir>` | path | unset; inherits native home | `provider status`, `provider usage`, `provider login`, `provider logout` | Override provider home directory (`HOME`, XDG vars, and `CODEX_HOME`) |
| `--timeout <sec>` | uint64 | 15 | `provider status`, `provider usage`, `provider logout` | Timeout in seconds for status, usage, or logout |
| `--method <name>` | string | auto | `provider login` | Auth method (`auto`, `device`, or `oauth`); `auto` selects `device` when supported |
| `--ttl <sec>` | uint64 | 900 | `provider login` | Maximum background session lifetime in seconds |
| `--start-timeout <sec>` | uint64 | 20 | `provider login` | Startup timeout in seconds while waiting for the auth URL |
| `--console` | bool | false | `provider login` | Use Anthropic Console API billing (`claude` only) |
| `--sso` | bool | false | `provider login` | Use SSO sign-in (`claude` only) |
| `--email <addr>` | string | unset | `provider login` | Prefill email address on the login page (`claude` only) |

## Session flags

| Flag | Type | Default | Commands | Description |
| :--- | :--- | :--- | :--- | :--- |
| `--input <text>` | string | unset | `session submit` | Authorization code or callback URL (conflicts with `--input-stdin`) |
| `--input-stdin` | bool | false | `session submit` | Read authorization code or callback URL from stdin (conflicts with `--input`) |
| `--timeout <sec>` | uint64 | 120 | `session submit` | Completion wait timeout in seconds |
| `--timeout <sec>` | uint64 | 300 | `session wait` | Wait timeout in seconds |

## Completion flags

- `--no-descriptions` (`bool`, default `false`): omit descriptions from generated completion scripts on `agent-auth completion script <shell>`.

## Environment variables

- `AGENT`: `1`, `true`, or `yes` (case-insensitive) enables compact `key:value` agent output and the agent help skill alert.
- `AGENT_AUTH_RUNTIME_DIR`: overrides the default per-user runtime directory for Unix domain sockets (`0700`).
