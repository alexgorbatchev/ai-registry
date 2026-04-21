# @alexgorbatchev/opencode-session-analysis

Bun-only CLI for reporting OpenCode session history from the local SQLite database.

It resolves the current project the same way OpenCode does, lists root workflow sessions newest first, aggregates descendant subagent sessions, and reports token, cost, model, tool, and best-effort MCP usage.

Active time is heuristic: it merges workflow activity intervals using a default idle-gap threshold of `5m`.

## Usage

After publishing:

```bash
bunx @alexgorbatchev/opencode-session-analysis
```

From this repository:

```bash
bun run packages/opencode-session-analysis/src/cli.ts
```

## Flags

- `--all`: include all known sessions across all projects
- `--all-known`: include all known sessions across all projects
- `--by-project`: group `--all-known` output by project/worktree
- `--session <id>`: show detailed output for one session
- `--help`: show help text

## Data Source

The CLI reads OpenCode's current SQLite storage at `~/.local/share/opencode/opencode.db` and expects Bun because it uses `bun:sqlite`.

## Output

For each root workflow session, the CLI reports:

- project/worktree scope
- session id
- model usage
- total tokens
- cost
- output tokens per second
- active time
- elapsed time
- tool-call breakdown
- best-effort MCP/server breakdown when structured metadata is present
