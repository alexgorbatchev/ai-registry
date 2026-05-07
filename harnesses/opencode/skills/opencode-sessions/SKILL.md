---
name: opencode-sessions
description: OpenCode session storage locations and inspection guidance. Use when asked where OpenCode stores session data, chat history, local databases, or repo-specific session metadata.
---

# OpenCode Session Storage

Use these locations when the user asks where OpenCode stores session history.

## Bundled Export Script

Use the bundled Bun script when the user asks to export a full session-analysis bundle from the local SQLite store.

Run:

```bash
bun scripts/export.ts <session-id> [output-directory]
```

Notes:

- `output-directory` is optional and defaults to `./long-session`
- The script writes a multi-file NDJSON bundle plus `SESSION.md`
- Override the database location with `--db <path-to-opencode.db>` when needed

The export includes:

- the full session subtree: root session plus all descendant/subagent sessions
- all `message`, `part`, `todo`, `event_sequence`, `event`, and `session_share` rows for that subtree
- linked `project`, `workspace`, and `permission` rows
- same-project session timeline rows for broader context
- `SESSION.md` describing the structure and counts

Use this exporter for deep analysis bundles. It intentionally excludes `account` and `account_state` because they contain auth/account state rather than session context.

## Primary Storage

- Main session store: `~/.local/share/opencode/opencode.db`
- Related SQLite files: `~/.local/share/opencode/opencode.db-shm` and `~/.local/share/opencode/opencode.db-wal`

This SQLite database stores the persisted OpenCode conversation data. The core tables are:

- `session`
- `message`
- `part`

## Repo-Local Pointer

Inside a Git worktree, OpenCode may also create `.git/opencode`.

- This file is not the full session history.
- It stores the OpenCode `project.id` for that repo/worktree.
- That project id links the repo back to rows in the main SQLite database.

## Practical Answer Format

When the user asks where sessions are stored, answer with:

- Full session history: `~/.local/share/opencode/opencode.db`
- Repo-specific OpenCode project pointer: `.git/opencode`

If relevant, add that editor integrations may maintain their own separate OpenCode databases under editor-local data directories, but the main CLI store is `~/.local/share/opencode/opencode.db`.
