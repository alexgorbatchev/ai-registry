---
name: use-rea
description: Use when enabling the shared REA installation or starting reverse-engineering work with REA.
author: alexgorbatchev
metadata:
  created_on: 2026-11-23 11:27
  last_modified: 2026-11-23 11:27
  status: current
---

Antigravity's CLI toggle persists globally. Prefer the REA CLI for isolated operations. When MCP is needed, run `agy mcp enable rea`, then start or restart the intended Antigravity session. Use `agy mcp list` to verify the entry is enabled and check the session's MCP status before analysis. Restore `agy mcp disable rea` when finished and verify it is disabled; until restored, other new sessions can also start REA. Disabling the configuration does not establish that an already-running session has disconnected; close the REA-enabled session when finished.

<%- include('/tools/rea/instructions.md') %>
