## Provider & Authentication Technical Manual

## Auth Resolution Cascade

Pi resolves authentication credentials per request using this hierarchy:

1. **`~/.pi/agent/auth.json` (Explicit Credential Store)**
   ```json
   {
     "litellm": {
       "type": "api_key",
       "key": "sk-...",
       "env": {
         "LITELLM_BASE_URL": "https://litellm.example.com"
       }
     }
   }
   ```
2. **Environment Variables**
   - LiteLLM: `LITELLM_API_KEY`, `LITELLM_BASE_URL`
   - OpenAI: `OPENAI_API_KEY`, `OPENAI_BASE_URL`
   - Google: `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
   - Anthropic: `ANTHROPIC_API_KEY`
3. **Helper Commands**
   - `LITELLM_API_KEY_HELPER` (executable command that prints a bearer token to stdout).

---

## LiteLLM Provider Architecture

### Endpoint Discovery Order
When model discovery runs, `pi-provider-litellm` queries proxy endpoints in this sequence:

| Order | Endpoint | Description |
| --- | --- | --- |
| 1 | `GET /model/info` | Rich admin metadata (token costs, max tokens, reasoning, mode). |
| 2 | `GET /v1/models` | OpenAI-compatible fallback when `/model/info` returns 401/403/404. |
| 3 | `GET /health` | Health check fallback for older proxies; queries per-endpoint `/model/info`. |

### Cloudflare WAF User-Agent Blocking
- **Problem:** Pi's OpenAI completions adapter uses the official `openai` JS SDK, which sends `user-agent: OpenAI/JS <version>`. Cloudflare WAF on LiteLLM endpoints blocks `OpenAI/JS` user agents with `403 Your request was blocked.`.
- **Diagnosis:**
  ```bash
  # Fails with 403
  curl -i -H "user-agent: OpenAI/JS 6.40.0" -H "authorization: Bearer $KEY" $BASE_URL/v1/chat/completions

  # Succeeds with 200
  curl -i -H "user-agent: pi/0.84.2" -H "authorization: Bearer $KEY" $BASE_URL/v1/chat/completions
  ```
- **Fix:** In `settings.json`, set custom headers under `providers.<provider_id>.headers`:
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

---

## Gemini 2.5 / 3.x Thought Signatures

### Background
Google Gemini 2.5/3.x models enforce mandatory `thought_signature` fields on function calls across multi-turn conversations.

### Mechanism & Failure Mode
1. Client sends OpenAI format `tool_calls` history without `thought_signature`.
2. LiteLLM forwards history to Google Vertex AI / AI Studio.
3. Google API rejects request with:
   `litellm.BadRequestError: VertexAIException BadRequestError - Function call is missing a thought_signature in functionCall parts.`

### Fix Requirements
- **Proxy Version:** Upgrade LiteLLM proxy to `>=v1.99.0` (which includes native `thought_signature` extraction and storage in `provider_specific_fields`).
- **Proxy Environment Variables:**
  - `LITELLM_DROP_PARAMS=True`
  - `LITELLM_GEMINI_THOUGHT_SIGNATURE=True`
- **Proxy Config (`config.yaml`):**
  Set `drop_params: true` on all Gemini/Gemma model definitions.
