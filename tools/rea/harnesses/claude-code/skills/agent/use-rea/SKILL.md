---
name: use-rea
description: Use when enabling the shared REA installation or starting reverse-engineering work with REA.
author: alexgorbatchev
metadata:
  created_on: 2026-11-23 11:27
  last_modified: 2026-11-23 11:27
  status: current
---

Start Claude Code in the target directory with:

```sh
claude --mcp-config '<%- output_dir %>/claude-code/skills/use-rea/assets/mcp.json'
```

The [bundled configuration](assets/mcp.json) adds REA for that invocation alongside existing servers. Verify `rea` is connected in `/mcp` before using its tools. Exit when finished; no global REA registration or project file is created. Relaunch an existing session with this flag to attach REA.

<%- include('/tools/rea/instructions.md') %>
