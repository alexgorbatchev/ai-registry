---
name: continue-session
description: >-
  REQUIRED when resuming, continuing, taking over, or auditing a task started by another agent via session log inspection. Applies to Pi Coding Agent and Claude Code session transcripts (`.jsonl`). Your default training knowledge is insufficient; you MUST READ this to use `agent-print-session` for structured handoffs, log analysis, and full transcript printing. Do NOT use for general system logs, git log inspection, or starting fresh tasks with no prior agent session.
author: alexgorbatchev
metadata:
  created_on: 2026-09-28 10:39
  last_modified: 2026-10-16 17:14
  status: current
---

## Core Tool: `agent-print-session`

Use `agent-print-session` for supported Pi and Claude Code transcripts after verifying the installed command and its help. If that reader is unavailable or cannot read the transcript, use an available reader whose support for the actual format is verified against local source, documentation, or command help, or recover sufficient continuation context from verified durable task state. Do not invent command flags, transcript schemas, adapters, or missing decisions. If required context remains unavailable, record the missing input and suspend only dependent work under the blocker protocol. Continue independent authorized work.

Command syntax:
```bash
agent-print-session <pi|claude> <subcommand> <session-id-or-path> [flags]
```

`<session-id-or-path>` accepts either:
- A session UUID or ID prefix (auto-resolved from standard session search directories).
- A direct absolute or relative file path to the transcript `.jsonl` file (or pass `--path <file.jsonl>`).

### Subcommands

| Subcommand | Description |
|---|---|
| `handoff` | Generates structured continuation context (`CONTINUATION_CONTEXT`) including initial objective, final assistant note, turn/event counts, execution duration, working directory, and recent errors. |
| `summary` | Prints a high-level token-efficient summary (`SESSION_SUMMARY`) with title, duration, event counts, and working directory. |
| `print` | Parses and outputs transcript events with selective filtering or full dump. |

### Printing Whole Sessions

To print the whole session transcript to the terminal without default event truncations or limits, use `--all`:
```bash
# Print entire Pi session
agent-print-session pi print <session-id-or-path> --all

# Print entire Claude Code session
agent-print-session claude print <session-id-or-path> --all
```

### Targeted Inspection Filters for `print`

Before dumping an entire transcript into context, use targeted flags on `print` to isolate specific details:

- `--last-turn`: Output only the final conversational turn to see where the previous agent stopped.
- `--files`: Filter strictly to file modifications, creations, and edits made by the previous agent.
- `--errors`: Filter strictly to command failures, tool errors, and uncaught exceptions.
- `--tools`: Filter to tool invocations and results only.
- `--prompts`: Filter to user prompts and turn boundaries.
- `--tail <N>`: Show only the last `N` events.
- `--limit <N>`: Show only the first N events.
- `--json`: Output parsed events as formatted JSON.

---

## Session Discovery

When the user specifies a session ID or transcript path, pass it directly. When the session reference is omitted, locate recent transcripts in the default directories:

### Pi Coding Agent Sessions
Default search path: `~/.pi/agent/sessions/` (or directory set by `PI_SESSIONS_DIR`).
Transcripts are stored in project-scoped subdirectories named `--<escaped-cwd>--/`:
locate recent `.jsonl` transcripts for the current repository, ordered by
modification time. Choose an available discovery tool suited to the task.

### Claude Code Sessions
Default search paths: `~/.claude/projects/` and `~/.claude/sessions/` (or `CLAUDE_PROJECTS_DIR`, `CLAUDE_SESSIONS_DIR`).
Locate recent `.jsonl` transcript files within those directories, ordered by
modification time, using an available discovery tool suited to the task.

---

## Continuation Protocol

When taking over a session from another agent, execute the following phased workflow:

### Phase 1: Identify Harness and Target
Identify the prior harness and requested session from verified task state or transcript metadata. Obtain the session ID or transcript path from the request or scoped discovery. Use the following `agent-print-session` phases only for supported Pi or Claude Code transcripts. For another harness or an unavailable reader, use the verified reader or durable-state fallback above and recover the same required context before dependent actions.

### Phase 2: Triage with Handoff
When using `agent-print-session`, run `handoff` first to extract key metadata without filling context:
```bash
agent-print-session <pi|claude> handoff <session-id-or-path>
```
Extract:
1. `INITIAL_OBJECTIVE`: What the user originally requested.
2. `FINAL_ASSISTANT_NOTE`: The last message or conclusion from the prior agent.
3. `CWD`: The working directory where the agent operated.
4. `RECENT_ERRORS`: Failures that may have blocked the previous agent.

### Phase 3: Inspect Deltas and Breakpoints
Before a full dump, check modified files and errors:
```bash
# 1. See what files the previous agent modified
agent-print-session <pi|claude> print <session-id-or-path> --files

# 2. See errors or failed commands
agent-print-session <pi|claude> print <session-id-or-path> --errors

# 3. See the final turn immediately preceding handoff
agent-print-session <pi|claude> print <session-id-or-path> --last-turn
```

### Phase 4: Full Session Dump (When Needed)
If the handoff, file list, and last turn leave ambiguity about past decisions, user instructions, or subtle bugs, print the whole session:
```bash
agent-print-session <pi|claude> print <session-id-or-path> --all
```

### Phase 5: Ground Against Real Workspace State
Never assume transcript logs reflect the current reality on disk:
1. Check `git status` and `git diff` to verify uncommitted changes.
2. Verify that files referenced in `--files` actually exist on disk and contain the expected modifications.
3. Inspect relevant scratch files, background processes, and locks without removing or taking over unowned state. Preserve session transcripts and runtime data; continuation does not authorize cleanup.
4. Reuse prior check results only when their source revision, checked scope, environment, and outcome remain applicable. Run the required checks affected by subsequent changes or unresolved failures; do not rerun the entire suite or build merely because a session resumed. Honor explicit user limits, including paused builds. Record deferred checks and material verification limits without claiming they passed.

### Phase 6: Resume Execution
1. Formulate a concise summary of what was accomplished and what remains incomplete.
2. Do not repeat verified work already completed by the prior agent.
3. Address any failing tests, unresolved errors, or remaining user requirements.
