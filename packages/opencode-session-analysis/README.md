# @alexgorbatchev/opencode-session-analysis

Bun-only CLI for reporting OpenCode session history and skill-usage data from the local SQLite database.

It resolves the current project the same way OpenCode does, lists root workflow sessions newest first, aggregates descendant subagent sessions, and reports token, cost, model, tool, best-effort MCP, and skill usage.

Active time is heuristic: it merges workflow activity intervals using a default idle-gap threshold of `5m`.

## Usage

From this repository root:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts --help
```

After publishing:

```bash
bunx @alexgorbatchev/opencode-session-analysis --help
```

Show session summaries for the current project:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts sessions
```

Show one skill-usage table for the current project:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts skills
```

Aggregate all projects into one skill-usage table:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts skills --all
```

Aggregate root sessions across all projects into one table:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts sessions --all
```

Show details for one root session in the current scope:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts sessions --session <id>
```

Interactively choose used skills from the current project and sync them into the project's `.opencode/skills` directory:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts sync-skills --pick
```

Reuse the saved selection manifest and refresh the synced copies without reopening the picker:

```bash
bun run --cwd packages/opencode-session-analysis src/cli.ts sync-skills
```

## Commands

- `skills`: show one skill-usage table for the current project scope
- `skills --all`: aggregate all projects into one skill-usage table
- `sessions`: show root session summaries for the current project scope
- `sessions --all`: aggregate root sessions from all projects into one table
- `sessions --session <id>`: show detailed output for one root session in the selected scope
- `sync-skills --pick`: interactively choose used skills to copy into `.opencode/skills`
- `sync-skills`: reuse the saved `.opencode/skills-manifest.json` selection and refresh the synced skill copies
- `sync-skills --yes`: overwrite drifted managed skill files without prompting
- `sync-skills --registry-dir <path>`: point the command at an `ai-registry` checkout when auto-detection is unavailable
- `--help`: show command help

## Data Source

The CLI reads OpenCode's current SQLite storage at `~/.local/share/opencode/opencode.db` and expects Bun because it uses `bun:sqlite`.

## Output

For each root workflow session, the CLI reports:

- session id
- model usage
- total tokens
- cost
- output tokens per second
- active time
- elapsed time
- tool-call breakdown
- best-effort MCP/server breakdown when structured metadata is present

With `skills`, the CLI reports:

- one skill-usage table sorted by usage count descending, including an average-per-day column over the observed usage span for the selected scope

With `sessions`, the CLI reports:

- one root-session summary table for the selected scope without echoing full project-directory paths per session row

With `sync-skills`, the CLI:

- lists skills used in the current project scope and lets you pick which ones should be copied into the project's `.opencode/skills/` directory
- writes `.opencode/skills-manifest.json` with the selected skill names plus SHA-256 checksums for the managed files
- reuses that manifest on later runs so the same skills can be refreshed automatically
- warns when the manifest selection misses newly used skills and blocks overwriting drifted managed files unless you confirm or pass `--yes`
