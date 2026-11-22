---
name: agent-auth
description: Use when operating agent-auth to check provider authentication status, inspect normalized usage quotas, or run non-blocking OAuth and device-code sign-in flows for codex, claude, and agy (antigravity).
author: alexgorbatchev
metadata:
  created_on: 2026-11-21 07:00
  last_modified: 2026-11-21 11:22
  status: current
---

Read [commands](references/commands.md) for every command, flag, type, default, and environment variable, [providers](references/providers.md) for provider-specific auth flows and JSON schemas, and [generated help queries](references/help.md) when querying help paths.

Set `AGENT=1` for compact `key:value` lines, or add `--json` for versioned JSON envelopes (`schema_version: 1`) across every command and provider.

## Standard non-blocking sign-in loop

1. Check current status:
   ```sh
   AGENT=1 agent-auth provider status codex --json
   ```
2. Start a session (exits immediately with `session_id`, `auth_url`, optional `user_code`, and `expected_input`):
   ```sh
   AGENT=1 agent-auth provider login codex --json
   ```
3. Relay `auth_url` (and `user_code` when present) plus `expected_input.prompt` to the user.
4. Complete the session:
   - When `expected_input.required` is `false` and the user did not paste a callback URL (e.g., `codex` device flow or local callback):
     ```sh
     AGENT=1 agent-auth session wait <id> --json
     ```
   - When the user returned an authorization code or callback URL (e.g., `claude`, `agy`, or remote `codex --method oauth`):
     ```sh
     printf '%s' "$USER_INPUT" | AGENT=1 agent-auth session submit <id> --input-stdin --json
     ```
5. Cancel an abandoned session cleanly with `AGENT=1 agent-auth session cancel <id> --json`.

## Exit codes

- `0`: success (`awaiting_input` on `provider login`, `authenticated`, `cancelled`, status/list/logout ok)
- `1`: operational, provider, session-missing/expired, or invalid-input failure
- `2`: CLI argument parsing error
- `3`: `session wait` timed out while the session is still active and pending (the current `SessionSnapshot` is printed to stdout)
- `130`: cancelled by signal

Run `agent-auth skill` for the offline canonical skill install command and URL.
