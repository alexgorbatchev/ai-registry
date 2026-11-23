---
name: use-rea
description: Use when enabling the shared REA installation or starting reverse-engineering work with REA.
author: alexgorbatchev
metadata:
  created_on: 2026-11-23 11:27
  last_modified: 2026-11-23 11:27
  status: current
---

Start Pi in the target directory with:

```sh
pi -e '<%- output_dir %>/pi/skills/use-rea/scripts/enableRea.ts'
```

The [session extension](scripts/enableRea.ts) requires Pi's `registerMcpServer` API (available in Pi 1.6). It registers `rea-session` only for that invocation; verify it is connected in `/mcp` before using its tools. Exit when finished. Keep the configured `rea` entry disabled: enabling it through `/mcp` would persist the change. Do not install this extension globally. If the API is unavailable, use the CLI or upgrade Pi before requesting an MCP session.

<%- include('/tools/rea/instructions.md') %>
