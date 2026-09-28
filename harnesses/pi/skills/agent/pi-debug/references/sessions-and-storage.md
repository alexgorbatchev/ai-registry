## Session & Storage Technical Manual

## Session Log Storage Locations

Pi stores session conversation histories as JSONL (`.jsonl`) files in these paths:

1. **Local Repository Workspace:** `.output/pi/default/sessions/--<workspace-slug>--/`
2. **Global Agent Directory:** `~/.pi/agent/sessions/`

Session filenames follow the pattern:
`<ISO-8601-Timestamp>_<Session-UUID>.jsonl`

Example: `2026-08-23T13-48-34-918Z_01a02ee1-56e6-7439-913b-c5cc3d6bb82b.jsonl`

---

## Session JSONL Event Schema

Each line in a session `.jsonl` file represents a discrete event in the session graph:

```json
{"type":"session","version":3,"id":"01a02ee1-56e6-7439-913b-c5cc3d6bb82b","timestamp":"2026-08-23T13:48:34.918Z","cwd":"/path/to/project"}
{"type":"model_change","id":"fb7aafc7","parentId":null,"timestamp":"2026-08-23T13:48:35.805Z","provider":"litellm","modelId":"gemini-3.6-flash"}
{"type":"message","id":"eb1193ae","parentId":null,"timestamp":"2026-08-23T13:48:38.738Z","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}
{"type":"message","id":"03cbc38c","parentId":"eb1193ae","timestamp":"2026-08-23T13:48:38.871Z","message":{"role":"assistant","content":[],"api":"openai-completions","provider":"litellm","model":"gemini-3.6-flash","stopReason":"error","errorMessage":"403 Your request was blocked."}}
```

### Key Message Event Fields
- **`stopReason`**: `stop`, `length`, `toolUse`, `aborted`, or `error`.
- **`errorMessage`**: Contains the exact raw string returned by the provider on error.
- **`provider`**: Name of the provider used for that turn (`google`, `litellm`, `openai`, `anthropic`).

---

## Mid-Session Provider Switching & Cross-Contamination

### The Problem
When a user starts a session on `provider A` (e.g. `google`) and switches mid-session to `provider B` (e.g. `litellm`), previous assistant messages in the history retain `provider A`'s internal metadata (`textSignature`).

### The Failure Cascade
1. Turn 1 (Google provider): Assistant message recorded with Google `textSignature`.
2. Model Switch: User changes model to `litellm/gemini-3.6-flash`.
3. Turn 2 (LiteLLM provider): Pi passes Turn 1 history to LiteLLM.
4. LiteLLM's OpenAI converter does not recognize Google's `textSignature` to populate `provider_specific_fields.thought_signatures`.
5. Upstream Google API rejects Turn 2 request as `INVALID_ARGUMENT: missing thought_signature`.

### Remediation
- **Fresh Session:** Start a new session when switching provider backends:
  ```bash
  pi --session fresh
  ```
- **Session Cleanup:** Alternatively, delete or truncate corrupted error entries in the `.jsonl` session file.

---

## Clearing Stale Models Store Cache

Dynamic catalogs and model metadata are persisted in `~/.pi/agent/models-store.json`.

If cached base URLs or model capabilities become stale:

```bash
# Safely inspect models-store.json
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.env.HOME + "/.pi/agent/models-store.json")), null, 2))'

# Delete models-store.json to force a fresh catalog discovery fetch on next startup
rm ~/.pi/agent/models-store.json
```
