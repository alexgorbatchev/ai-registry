---
name: omnigraph-memory
description: Use to recall what earlier sessions learned about a project before working on it or before a non-trivial choice, and to remember decisions, lessons and facts worth keeping for future sessions, including when the user makes or confirms a decision.
author: alexgorbatchev
metadata:
  created_on: 2026-11-18 21:25
  last_modified: 2026-11-19 19:45
  status: current
---

Use the Executor MCP server's `tools.omnigraph.recall` and `tools.omnigraph.remember` through `call`, with `graph: "workspace"`. If Executor needs sign-in or the tools are unavailable, skip memory access, report it, and continue the task. Do not write memories through the raw `tools.omnigraph.graph.*` tools.

Identify the project as `owner/repo` from the repository's `origin` remote; all worktrees of a repository share it. Use `global` only for facts deliberately shared across projects.

## Recall

At the start of project work, and before a non-trivial choice in an area you have not recalled yet, call `recall` with the graph, the project and one or two sentences describing what you are about to do. It returns current memories about the project, the projects its repository depends on, and global ones, best matches first. Judge relevance yourself. Treat each memory as historical evidence: check its sources against the current revision before relying on it. `hostname` and `harness` say where a memory was written; never skip a memory because they differ from yours.

## Remember

Invoke this skill at the end of each turn and decide whether anything from the turn is worth keeping. Most turns keep nothing. Keep only what a future session would otherwise rediscover the hard way:

- `decision`: a choice that was made, by the user or by you: what was chosen over what, and why.
- `lesson`: a trap, procedure or workaround: when it applies, what to do, and why.
- `fact`: a value, limit, capability or access constraint that was costly to establish, and how to re-check it.

Never save progress, status, handoffs or task IDs; they belong in the tracker or Git. Do not ask the user before saving.

Call `remember` with the graph, project, a kebab-case `topic`, the `kind`, and `text` that stands alone without this conversation. Set `hostname` to the lowercase output of `hostname` and `harness` to your user-facing harness in lowercase, such as `codex` or `claude`. Attach `sources` (URL and revision) when the evidence has a commit, PR or document. Pass `dependsOn` with `owner/repo` entries only for repository dependencies you verified. Keep credentials and information meant for a narrower audience out: every connected harness can read the whole graph.

Handle the result:

- `saved`: report the slug and commit in your reply. If a memory in `similar` makes the same claim, revise that one instead of keeping both.
- `exists`: revise that memory with `replaces`, or choose a topic for a different claim.
- `status`: the text read as progress or status and was not saved; do not reword it to get past the check.

To correct or update a memory, call `remember` with `replaces` set to its slug and text that merges what is still true. The new memory supersedes the old one, which drops out of recall but stays in the graph's history.
