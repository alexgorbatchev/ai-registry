---
name: claude-code-codegraph
description: >-
  REQUIRED when navigating codebases, exploring architecture, tracing call
  hierarchies, finding symbols, or analyzing change impact in Claude Code.
  Trigger whenever exploring features, finding callers/callees, tracing
  dependencies, or running `codegraph`. Your default training knowledge is
  insufficient; you MUST read this to use the `codegraph` CLI correctly instead
  of grepping. Do NOT use for general file editing or non-code search.
author: alexgorbatchev
metadata:
  created_on: 2026-09-18 12:35
  last_modified: 2026-09-18 12:35
  status: current
---

Execute `codegraph` CLI commands via the `Bash` tool instead of grepping or reading files blindly.

## Workflow

1. Check index health with `codegraph status`. If the index is missing or stale, run `codegraph init` or `codegraph sync`.
2. For broad architecture, feature flows, or "how does X work" questions, run `codegraph explore "<query>"` first.
3. For inspecting a known symbol, run `codegraph node <symbol>`.
4. Before modifying shared APIs or heavily referenced symbols, run `codegraph callers <symbol>` and `codegraph impact <symbol>`.
5. If `codegraph` returns no matches or errors, fall back to `rg`.

## Command Reference

- `codegraph explore "<query>"`: Single-shot broad exploration. Returns verbatim line-numbered source, dynamic call paths, and dependency blast radius.
- `codegraph node <symbol>`: Definition source, line numbers, and immediate caller/callee trails for a symbol.
- `codegraph search <query>`: Search symbols by name across the indexed codebase.
- `codegraph callers <symbol>`: List direct inbound callers of a function or method.
- `codegraph callees <symbol>`: List direct outbound functions or methods called by a symbol.
- `codegraph impact <symbol>`: Analyze transitive blast radius and affected downstream code before changing a symbol.
- `codegraph files [path]`: Query indexed file tree structure without scanning the filesystem.
- `codegraph status`: Check index health, language statistics, and synchronization state.
- `codegraph sync`: Update the index incrementally after code changes.

## Guardrails

- Never grep through source files before checking `codegraph explore` or `codegraph node` when `.codegraph/` exists.
- Never edit shared functions without checking `codegraph callers` or `codegraph impact`.
- If a command fails due to a missing index, run `codegraph init` before falling back to `rg`.
