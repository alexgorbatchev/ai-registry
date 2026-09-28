## Troubleshooting & Error Reference Matrix

## Quick Diagnostics Matrix

| Symptom / Error Message | Root Cause | Immediate Remediation |
| --- | --- | --- |
| **`403 Your request was blocked.`** (Cloudflare WAF) | Cloudflare WAF on LiteLLM proxy blocking OpenAI SDK's default `user-agent: OpenAI/JS <ver>`. | Add `User-Agent: pi/0.84.2` under `litellm.providers.litellm.headers` in `settings.json`. |
| **`403 Your request was blocked.`** (Mid-session switch) | Session history contains assistant turns from `google` driver without LiteLLM `thought_signatures`. | Start a fresh session: `pi --session fresh`. |
| **`Function call is missing a thought_signature`** | Gemini 2.5/3.x multi-turn tool history missing required `thought_signature`. | Upgrade LiteLLM proxy to `>=v1.99.0` and set `LITELLM_GEMINI_THOUGHT_SIGNATURE=True`. |
| **`Saved API key for X, but its model catalog could not be refreshed`** | Key saved to `auth.json`, but background discovery fetch (`/model/info` or `/v1/models`) failed/timed out. | Test URL with `curl -i -H "Authorization: Bearer $KEY" $URL/v1/models`. Set `LITELLM_DISCOVERY_TIMEOUT_MS=15000`. |
| **`no credentials for litellm. Run /login litellm or set env vars.`** | `auth.json` lacks entry for `litellm` AND `LITELLM_API_KEY` is not exported in shell. | Save credentials in `~/.pi/agent/auth.json` or export `LITELLM_API_KEY`. |
| **`Invalid model name passed in model=X`** | Selected model exists in global `/model/info`, but virtual key lacks permissions in `/v1/models`. | Update key model permissions on LiteLLM admin dashboard (`/key/update`). |
| **`HTTP 303 See Other` on `/mcp-rest/tools/list`** | PocketID or SSO proxy protecting LiteLLM MCP endpoints. | Set `litellm.mcp.enabled: false` and `litellm.skills.enabled: false` in `settings.json`. |
| **`Build cancelled. Generated outputs changed outside the build`** | Hand-edited files in `.output/pi/` directly without modifying `harnesses/pi/`. | Edit source files under `harnesses/pi/` and run `bun run build -- --yes && bun run bootstrap`. |

---

## Detailed Repair Workflows

### 1. Fixing Cloudflare WAF Block on LiteLLM
In `harnesses/pi/settings.json`:
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
Run build and bootstrap:
```bash
bun run build -- --yes && bun run bootstrap
```

### 2. Fixing Corrupted Credential Store
If `~/.pi/agent/auth.json` becomes corrupted:
```json
{
  "litellm": {
    "type": "api_key",
    "key": "sk-YOUR_LITELLM_KEY",
    "env": {
      "LITELLM_BASE_URL": "https://litellm.example.com"
    }
  }
}
```

### 3. Verification Command Template
Always verify provider connectivity outside of Pi before debugging Pi internals:
```bash
curl -s -i -X POST "$LITELLM_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -H "User-Agent: pi/0.84.2" \
  -d '{"model":"gemini-3.6-flash","messages":[{"role":"user","content":"hi"}]}'
```
