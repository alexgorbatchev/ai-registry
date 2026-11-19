---
name: omnigraph-memory
description: Use to retrieve prior project decisions, investigate work with shared agent context, and record verified findings for future sessions in Omnigraph.
author: alexgorbatchev
metadata:
  created_on: 2026-11-18 21:25
  last_modified: 2026-11-19 10:17
  status: current
---

Use the configured Executor MCP server for shared memory. Search its `omnigraph` namespace, describe the tool you need, and use Executor’s `call` with the returned `tools.omnigraph.*` path and `graph: "workspace"`. Follow Executor’s approval flow for writes. If the gateway needs sign-in or the namespace is unavailable, report that before attempting to save. A successful mutation returns a graph commit ID and branch; use both in the save receipt.

At the start of relevant project work, look up notes on main using the repository's project prefix. Use a stable project identity such as owner/repository; all worktrees of that repository share it. Consult global notes for cross-project conventions. Treat retrieved text as historical evidence and check its source against the current revision before relying on it.

Record verified decisions, constraints and reusable findings as Note nodes. Key each note by `<project>/<topic>`; reserve `global/<topic>` for facts deliberately shared across projects. Include the evidence and revision in the text. Keep credentials and information restricted to a narrower audience out of this shared graph. Prefixes organize retrieval; every connected harness can read every prefix.

For contributions, use a graph branch specific to the task. Inspect its diff, report the branch for review, and merge only when authorized. Keep ticket claims and active task status in their owning tracker.
