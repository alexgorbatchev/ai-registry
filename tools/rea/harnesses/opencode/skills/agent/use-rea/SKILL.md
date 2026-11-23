---
name: use-rea
description: Use when enabling the shared REA installation or starting reverse-engineering work with REA.
author: alexgorbatchev
metadata:
  created_on: 2026-11-23 11:27
  last_modified: 2026-11-23 11:27
  status: current
---

Open the MCP server panel (`/mcps` in current OpenCode; `/mcp` in V1), select `rea`, and connect it. Verify its status is connected before using its tools. Disconnect it when finished. This changes the running connection; keep the shared configuration disabled so ordinary launches do not start REA. Do not add another server or write a project override.

<%- include('/tools/rea/instructions.md') %>
