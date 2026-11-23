---
name: use-rea
description: Use when enabling the shared REA installation or starting reverse-engineering work with REA.
author: alexgorbatchev
metadata:
  created_on: 2026-11-23 11:27
  last_modified: 2026-11-23 11:27
  status: current
---

Start Codex in the target directory with `codex -c 'mcp_servers.rea.enabled=true'`. This override lasts for that invocation; exiting leaves the shared default disabled. Verify `rea` is connected in `/mcp` before using its tools. An existing session needs a relaunch with the override; starting a server from a shell does not attach it to that session.

<%- include('/tools/rea/instructions.md') %>
