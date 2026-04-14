---
name: chrome-cdp
description: Interact with local Chrome browser session (only on explicit user approval after being asked to inspect, debug, or interact with a page open in Chrome)
---

# Chrome CDP

Lightweight Chrome DevTools Protocol CLI. Connects directly via WebSocket — no Puppeteer, works with 100+ tabs, instant connection.

## Prerequisites

- Chrome (or Chromium, Brave, Edge, Vivaldi) with remote debugging enabled: open `chrome://inspect/#remote-debugging` and toggle the switch
- Node.js 22+ (uses built-in WebSocket)
- If your browser's `DevToolsActivePort` is in a non-standard location, set `CDP_PORT_FILE` to its full path

## Commands

All commands use `scripts/cdp.mjs`. The `<target>` is a **unique** targetId prefix from `list`; copy the full prefix shown in the `list` output (for example `6BE827FA`). The CLI rejects ambiguous prefixes.

### List open pages

```bash
scripts/cdp.mjs list
```

### Take a screenshot

```bash
scripts/cdp.mjs shot <target> [file]    # default: screenshot-<target>.png in runtime dir
```

Captures the **viewport only**. Scroll first with `eval` if you need content below the fold. Output includes the page's DPR and coordinate conversion hint (see **Coordinates** below).

### Accessibility tree snapshot

```bash
scripts/cdp.mjs snap <target>
```

### Evaluate JavaScript

```bash
scripts/cdp.mjs eval <target> <expr>
```

> **Watch out:** avoid index-based selection (`querySelectorAll(...)[i]`) across multiple `eval` calls when the DOM can change between them (e.g. after clicking Ignore, card indices shift). Collect all data in one `eval` or use stable selectors.

### Other commands

```bash
scripts/cdp.mjs html    <target> [selector]   # full page or element HTML
scripts/cdp.mjs nav     <target> <url>         # navigate and wait for load
scripts/cdp.mjs net     <target>               # resource timing entries
scripts/cdp.mjs click   <target> <selector>    # click element by CSS selector
scripts/cdp.mjs clickxy <target> <x> <y>       # click at CSS pixel coords
scripts/cdp.mjs type    <target> <text>         # Input.insertText at current focus; works in cross-origin iframes unlike eval
scripts/cdp.mjs loadall <target> <selector> [ms]  # click "load more" until gone (default 1500ms between clicks)
scripts/cdp.mjs evalraw <target> <method> [json]  # raw CDP command passthrough
scripts/cdp.mjs open    [url]                  # open new tab (each triggers Allow prompt)
scripts/cdp.mjs stop    [target]               # stop daemon(s)
```

## Coordinates

`shot` saves an image at native resolution: image pixels = CSS pixels × DPR. CDP Input events (`clickxy` etc.) take **CSS pixels**.

```
CSS px = screenshot image px / DPR
```

`shot` prints the DPR for the current page. Typical Retina (DPR=2): divide screenshot coords by 2.

## Troubleshooting & verification workflow

### When `list` says `No DevToolsActivePort found`

Do not assume remote debugging is actually off. First check whether the browser is listening on a debug port and whether the port file lives in a browser-specific profile directory.

Common fix:

```bash
CDP_PORT_FILE="/Users/<user>/Library/Application Support/Vivaldi/DevToolsActivePort" \
  scripts/cdp.mjs list
```

This is especially relevant for alternate Chromium-based browsers and non-default profiles.

### When working against a local web app

Do not trust process state alone. Always verify the actual HTTP endpoint before declaring success.

Recommended order:

1. `curl -si http://127.0.0.1:<port>/` to confirm the page really serves
2. if it fails, check `lsof -iTCP:<port> -sTCP:LISTEN -n -P`
3. if the port is occupied, distinguish `EADDRINUSE` from a real app crash
4. only then inspect the page in Chrome with `snap`, `eval`, or `shot`

This catches cases where:
- a duplicate server start fails even though another instance is healthy
- Bun returns an HTML build-error page with HTTP 500
- the server is up but the browser app crashes after load

### When reverse-engineering network-backed pages

Use the page itself to discover the real network contract instead of guessing.

Helpful pattern:

```bash
scripts/cdp.mjs eval <target> 'JSON.stringify(
  performance.getEntriesByType("resource").map((entry) => entry.name),
  null,
  2
)'
```

This is useful for identifying JSON/XHR endpoints after interactions such as tab switches, pagination, and detail expansion.

### When DOM state changes between actions

Avoid multi-step index-based probing across separate `eval` calls. Prefer one `eval` that captures all relevant attributes (`href`, `data-*`, `class`, nearby parent structure) at once. For pagination and JS-driven controls, inspect `data-page`, `data-id`, `aria-*`, and parent attributes before assuming query params or URL structure.

## Tips

- Prefer `snap --compact` over `html` for page structure.
- Use `type` (not eval) to enter text in cross-origin iframes — `click`/`clickxy` to focus first, then `type`.
- Use `eval` to inspect `performance.getEntriesByType("resource")` when you need to map UI actions to backend endpoints.
- After opening a local page, use both `curl` and CDP: `curl` validates HTTP behavior, CDP validates rendered/browser behavior.
- Chrome shows an "Allow debugging" modal once per tab on first access. A background daemon keeps the session alive so subsequent commands need no further approval. Daemons auto-exit after 20 minutes of inactivity.
