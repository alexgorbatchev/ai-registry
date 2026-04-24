# @alexgorbatchev/opencode-session-analysis

Bun-only CLI for reporting OpenCode session history and skill-usage data from the local SQLite database.

It resolves the current project the same way OpenCode does, lists root workflow sessions newest first, aggregates descendant subagent sessions, and reports token, cost, model, tool, best-effort MCP, and skill usage.

Active time is heuristic: it merges workflow activity intervals using a default idle-gap threshold of `5m`.

## Usage

From this repository root:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts
```

After publishing:

```bash
bunx @alexgorbatchev/opencode-session-analysis
```

Aggregate skill-usage report across all projects:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts --skills
```

One skill-usage table per project:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts --skills --all-projects
```

## Flags

- `--all`: include all known sessions across all projects
- `--all-known`: include all known sessions across all projects
- `--all-projects`: with `--skills`, show one skill-usage table per project instead of the aggregate table
- `--by-project`: group `--all-known` output by project/worktree
- `--skills`: show aggregate skill-usage totals across all projects
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

With `--skills`, the CLI reports:

- one aggregate all-projects skill-usage table sorted by usage count descending, including an average-per-day column over the observed usage span

With `--skills --all-projects`, the CLI reports:

- one skill-usage table per project/worktree or global directory scope
