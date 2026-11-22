---
created_on: 2026-11-21 07:00
last_modified: 2026-11-21 11:22
status: current
---

## Supported providers

### `codex`
- **Default method:** `device` (`chatgptDeviceCode` via `codex app-server --stdio`).
- **Supported methods:** `device`, `oauth`.
- **Browser policy:** Never invokes `codex login`; `codex app-server --stdio` never launches a browser.
- **`device` flow:** Returns `auth_url` (`https://auth.openai.com/codex/device`) and `user_code` with `expected_input.kind = "none"` and `required = false`. User approves in browser; agent calls `session wait <id>`.
- **`oauth` flow:** Starts Codex's local callback listener (`127.0.0.1:1455`) via `account/login/start` (`type: "chatgpt"`), returning `auth_url` with `expected_input.kind = "callback_url_optional"` and `required = false`. Same-machine browsers hit the listener directly (`session wait`); remote browsers can paste the final `http://127.0.0.1:1455/auth/callback?...` URL into `session submit` for validated local replay.
- **Status / usage / logout:** `account/read` returns `email`, `plan`, `workspace`, and `auth_method`; `provider usage` calls `account/rateLimits/read` (`excludeResetCreditDetails: true`) and normalizes each window's `usedPercent` and `resetsAt` into `buckets`; logout runs `codex logout`.

### `claude`
- **Default method:** `oauth` (`claude auth login`).
- **Supported methods:** `oauth`.
- **Browser policy:** Runs with a no-op `BROWSER` executable and `PATH` shims so no browser opens.
- **`oauth` flow:** Captures the manual authorization URL (`expected_input.kind = "code"`, `required = true`). User pastes `<code>#<state>` back; agent submits it via `session submit <id> --input-stdin`.
- **Status / usage / logout:** `claude auth status` (JSON), `provider usage` sends `get_usage` (`skip_behaviors: true`) over `claude -p --input-format stream-json --output-format stream-json --verbose --no-session-persistence --setting-sources ""`, and `claude auth logout`.

### `agy` (alias: `antigravity`)
- **Aliases:** `antigravity` resolves to canonical provider `agy` on all commands (`provider status`, `provider usage`, `provider login`, `provider logout`).
- **Default method:** `oauth` (`agy acp --login`).
- **Supported methods:** `oauth`.
- **Browser policy:** `agy acp --login` is headless ACP terminal auth; `provider status` and `provider usage` run `agy -p /usage --output-format json` inside the browser-blocking sandbox and immediately terminate the child if unauthenticated prompts appear.
- **`oauth` flow:** Keeps stdin open, returns the Google OAuth URL (`expected_input.kind = "code_or_url"`, `required = true`). User pastes either the authorization code or the full landing URL (`https://antigravity.google/oauth-callback?...`).
- **Status / usage / logout:** `agy -p /usage --output-format json` returns normalized `buckets` (`id`, `group`, `label`, `window`, `used_fraction`, `remaining_fraction`, `reset_time`) when authenticated. Non-interactive logout is unsupported (`unsupported_operation`); sign out with `/logout` inside interactive `agy`.

## Output and error contracts

- All `--json` success outputs include `"schema_version": 1`.
- `SessionSnapshot` fields: `schema_version`, `session_id`, `provider`, `method`, `status`, `auth_url`, `user_code`, `expected_input`, `account`, `expires_at`, `error`.
- Failure output in `--json` mode writes `{"schema_version":1,"error":{"code":...,"message":...,"retryable":...,"hint":...}}` to stderr.
- Home directory paths printed to stdout or stderr are folded to `~` using whole-segment matching.
- Authorization codes and callback URLs are transmitted only over `0600` Unix domain sockets and are never written to disk or logs.
