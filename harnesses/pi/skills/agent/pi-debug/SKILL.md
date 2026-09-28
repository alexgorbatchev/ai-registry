---
name: pi-debug
description: REQUIRED when diagnosing, troubleshooting, or debugging Pi Coding Agent (`pi`) issues, including provider errors, model catalog refresh failures, HTTP 403/401 auth blocks, missing or broken extensions, session corrupted state, or subagent failures. You MUST load this to get project-specific Pi diagnostic workflows and commands instead of relying on memory.
author: alexgorbatchev
metadata:
  created_on: 2026-08-23 13:50
  last_modified: 2026-08-23 13:50
  status: current
---

## Diagnostic Decision Tree

Follow this triage sequence to isolate the root cause before editing configurations:

1. **Classify the Failure Domain:**
   - **Provider / Model Error** (HTTP 403, 401, 400, model missing, catalog refresh warning) -> Jump to [Provider & Auth Debugging](#provider--auth-debugging) and [references/providers-and-auth.md](references/providers-and-auth.md).
   - **Extension / Header / MCP Error** (Extension not loading, custom headers ignored, tool calls missing) -> Jump to [Extension & MCP Debugging](#extension--mcp-debugging) and [references/extensions-and-mcp.md](references/extensions-and-mcp.md).
   - **Session / State Error** (Error persists after fix, corrupted turn, mid-session model switch failure) -> Jump to [Session & Storage Debugging](#session--storage-debugging) and [references/sessions-and-storage.md](references/sessions-and-storage.md).
   - **General System / Environment Error** -> Jump to [references/common-errors.md](references/common-errors.md).

---

## Core Inspection Commands

Execute these commands to gather ground-truth diagnostic evidence:

```bash
# 1. Verify active environment variables
env | grep -E 'PI_|LITELLM_|OPENAI_|GOOGLE_|ANTHROPIC_'

# 2. Inspect active settings and credentials
cat ~/.pi/agent/settings.json
cat ~/.pi/agent/auth.json

# 3. Inspect cached model store and base URLs
node -e '
  const fs = require("fs");
  const path = process.env.HOME + "/.pi/agent/models-store.json";
  if (fs.existsSync(path)) {
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    for (const [provider, store] of Object.entries(data)) {
      console.log(`Provider: ${provider}, Models: ${store.models?.length || 0}`);
      if (store.models?.[0]) console.log(" Sample:", store.models[0].id, store.models[0].baseUrl);
    }
  } else console.log("No models-store.json found.");
'

# 4. Find session JSONL logs for the current workspace
find ~/.pi/agent/sessions/ .output/pi/default/sessions/ -name "*.jsonl" -mmin -60 2>/dev/null
```

---

## Provider & Auth Debugging

### Key Resolution Order
Pi resolves provider credentials in this exact order:
1. `~/.pi/agent/auth.json` (explicit saved logins via `/login` or file).
2. Environment variables (`LITELLM_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.).
3. Helper commands (`LITELLM_API_KEY_HELPER` if configured).

### Common Provider Failure Patterns

1. **HTTP 403 "Your request was blocked"**
   - **Cause A (Cloudflare WAF User-Agent Block):** The underlying OpenAI SDK attached `User-Agent: OpenAI/JS <version>`, which Cloudflare WAF blocks.
     - *Fix:* In `settings.json`, set `litellm.providers.litellm.headers.User-Agent: "pi/0.84.2"` (nested under `providers.<provider_id>`, not at root `litellm` level).
   - **Cause B (Missing `thought_signature` on Gemini 2.5/3.x):** Multi-turn tool conversations with Gemini models via LiteLLM reject turns missing `thought_signature`.
     - *Fix:* Ensure LiteLLM proxy is updated (`>=v1.99.0`) and set `LITELLM_GEMINI_THOUGHT_SIGNATURE=True` and `LITELLM_DROP_PARAMS=True` on LiteLLM proxy.
   - **Cause C (Direct Provider Mismatch):** User selected `google/gemini-3.6-flash` instead of `litellm/gemini-3.6-flash`, hitting direct Google API without valid direct credentials.
     - *Fix:* Switch model to `litellm/gemini-3.6-flash` or set `defaultProvider: "litellm"`.

2. **"Saved API key for X, but its model catalog could not be refreshed; using cached models"**
   - **Cause:** Credentials saved successfully, but background model discovery fetch (`/model/info` or `/v1/models`) failed or timed out.
   - *Fix:* Check endpoint reachability using `curl -i -H "Authorization: Bearer KEY" <BASE_URL>/v1/models`. Increase timeout via `export LITELLM_DISCOVERY_TIMEOUT_MS=15000`.

For deep provider mechanics and auth schema details, see [references/providers-and-auth.md](references/providers-and-auth.md).

---

## Extension & MCP Debugging

1. **Inspecting External Extensions:**
   - Do NOT run system-wide `find` or `grep` across local `node_modules` or `~/.pi` when diagnosing extension issues.
   - Retrieve package metadata from `https://pi.dev/packages/<package-name>`.
   - Use `fetch_content` to read raw GitHub source files (e.g. `https://raw.githubusercontent.com/<owner>/<repo>/main/src/...`).

2. **Header Configuration Placement:**
   - Provider extensions (such as `pi-provider-litellm`) parse nested provider configurations:
     ```json
     {
       "litellm": {
         "providers": {
           "litellm": {
             "headers": {
               "User-Agent": "pi/0.84.2"
             }
           }
         }
       }
     }
     ```
   - Top-level `"litellm": { "headers": ... }` is ignored by multi-provider extension schemas.

For detailed extension lifecycle and MCP troubleshooting, see [references/extensions-and-mcp.md](references/extensions-and-mcp.md).

---

## Session & Storage Debugging

1. **Locating Session Files:**
   - Local project sessions live in `.output/pi/default/sessions/` or `~/.pi/agent/sessions/`.
   - Filenames follow `<timestamp>_<session-uuid>.jsonl`.

2. **Analyzing Session Errors:**
   ```bash
   grep -i '"errorMessage"' <session-file.jsonl>
   ```

3. **Mid-Session Provider Switching Cross-Contamination:**
   - Switching providers mid-session (e.g. `google` -> `litellm`) carries previous assistant messages formatted with the old provider's metadata (`textSignature`).
   - If the new provider expects a different signature format (`thought_signatures`), subsequent turns will fail with 403/400.
   - *Fix:* Start a fresh session when switching provider backends (`pi --session fresh`).

For session structure and repair guidance, see [references/sessions-and-storage.md](references/sessions-and-storage.md).

---

## Detailed References

- [references/providers-and-auth.md](references/providers-and-auth.md) — Complete provider auth schemas, LiteLLM routes, Cloudflare WAF bypass, and Gemini `thought_signature` rules.
- [references/extensions-and-mcp.md](references/extensions-and-mcp.md) — Extension discovery, `pi.dev` inspection, custom header injection, and MCP tools.
- [references/sessions-and-storage.md](references/sessions-and-storage.md) — Session JSONL schemas, cached state clearing, and cross-provider history migration issues.
- [references/common-errors.md](references/common-errors.md) — Comprehensive error-to-fix lookup matrix for all Pi error messages.
