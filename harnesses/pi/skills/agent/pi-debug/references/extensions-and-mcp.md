## Extension & MCP Technical Manual

## Pi Extension Architecture

Pi extensions are registered in `~/.pi/agent/settings.json` under `packages`:

```json
{
  "packages": [
    "npm:pi-provider-litellm",
    "npm:@aliou/pi-processes",
    "npm:@isac322/pi-codegraph"
  ]
}
```

### Extension Loading & Execution Lifecycle
1. Pi initializes extensions during startup before painting the TUI.
2. Extensions register providers (`pi.registerProvider`), tools (`pi.registerTool`), and session event hooks (`pi.on("session_start", ...)`).
3. If an extension initialization throws an error or times out, Pi logs a warning and proceeds with remaining features.

---

## Extension Source Discovery

When troubleshooting or analyzing external Pi extensions (`npm:<package-name>`):

1. **Do NOT run broad local disk searches:** Do not execute `find` or `grep` across `/tmp`, `node_modules`, or system directories.
2. **Consult `pi.dev` Registry:** Look up extension metadata and canonical repository links at:
   `https://pi.dev/packages/<package-name>`
3. **Fetch Source Files directly from GitHub:**
   Use `fetch_content` to fetch raw source files directly from GitHub:
   `https://raw.githubusercontent.com/<owner>/<repo>/main/src/index.ts`

---

## Header Configuration Mapping in Extensions

Extension settings must match the exact schema expected by the extension module.

### `pi-provider-litellm` Settings Schema

Incorrect (headers at root of `litellm` object are ignored):
```json
{
  "litellm": {
    "headers": {
      "User-Agent": "pi/0.84.2"
    }
  }
}
```

Correct (nested under `providers.<provider_id>.headers`):
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

## LiteLLM MCP & Skills Integration

`pi-provider-litellm` attempts to discover MCP tools and Skill Hub prompts from LiteLLM proxy routes:

- **MCP Tools:** `GET /mcp-rest/tools/list`, `POST /mcp-rest/tools/call`
- **Skill Hub:** `GET /claude-code/marketplace.json` or `GET /v1/skills`

### Disabling Unused Proxy Extensions
If these endpoints are protected by SSO/OAuth proxies (e.g. PocketID returning 303 redirects), disable them in `settings.json` to prevent connection overhead:

```json
{
  "litellm": {
    "skills": { "enabled": false },
    "mcp": { "enabled": false }
  }
}
```
