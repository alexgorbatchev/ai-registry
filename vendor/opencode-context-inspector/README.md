# opencode-context-inspector

**Full visibility into how your context window budget is consumed.**

OpenCode users connect MCP servers, load skills, configure agents and rules -- all of which silently inject tokens into the system prompt on every single message. A single MCP server like GitHub can consume 20K+ tokens per message just from tool definitions, whether those tools are actually used or not.

This plugin fixes that by providing a real-time context budget breakdown.

```
Context Budget -- claude-opus-4-6 (200K)
+--------------------------------------------------+
| MCP: github             18,200 tk    9.1%  █████ |
| Agent (coder)            4,200 tk    2.1%  ██    |
| Built-in tools           3,600 tk    1.8%  █     |
| Skills                   2,400 tk    1.2%  █     |
| Rules/Instructions       1,800 tk    0.9%  █     |
| Unknown                  1,200 tk    0.6%        |
| Custom tools               800 tk    0.4%        |
| ------------------------------------------------ |
| System prompt total     32,200 tk   16.1%        |
| Conversation so far     42,000 tk   21.0%        |
| Available              125,800 tk   62.9%        |
+--------------------------------------------------+
```

## Installation

This vendored copy is used as a repo-local Bun workspace and loaded directly from source.

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["file:///path/to/opencode-context-inspector/src/index.ts"]
}
```

If you use this repository's OpenCode harness, it is already wired through `harnesses/opencode/opencode.jsonc` to load the workspace copy from `vendor/opencode-context-inspector/src/index.ts`.

## Quick Start

1. Install the plugin (see above)
2. Start OpenCode as normal
3. The budget breakdown is logged automatically on every message

That's it. No configuration required -- the plugin auto-detects your model and context window size.

## Configuration

Configure via `opencode.json` under `pluginConfig`:

```json
{
  "plugin": ["opencode-context-inspector"],
  "pluginConfig": {
    "opencode-context-inspector": {
      "model": "claude-opus-4-6",
      "contextWindow": 200000,
      "logLevel": "info",
      "logOnEveryMessage": true,
      "showBarChart": true,
      "trackToolCallResults": true,
      "warnThreshold": 0.7,
      "criticalThreshold": 0.9,
      "customSegmentPatterns": {
        "my-custom-section": "regex-pattern-here"
      }
    }
  }
}
```

### Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | string | auto-detect | Override model for context window lookup |
| `contextWindow` | number | from model map | Override context window size directly |
| `logLevel` | string | `"info"` | Minimum log level: `debug`, `info`, `warn`, `error` |
| `logOnEveryMessage` | boolean | `true` | Show budget table on every message |
| `showBarChart` | boolean | `true` | Show visual bar indicators |
| `trackToolCallResults` | boolean | `true` | Track token cost of MCP tool responses |
| `warnThreshold` | number | `0.7` | Warn when context usage exceeds this fraction (0-1) |
| `criticalThreshold` | number | `0.9` | Critical alert when context usage exceeds this fraction (0-1) |
| `customSegmentPatterns` | object | `{}` | Custom regex patterns for segment identification |

## Example Output

### Per-Message Budget Table

Logged via `client.app.log("info", ...)` on every message (configurable):

```
Context Budget -- claude-opus-4-6 (200K)
+--------------------------------------------------+
| Agent (coder)            4,200 tk    2.1%  ██    |
| Rules/Instructions       1,800 tk    0.9%  █     |
| Skills                   2,400 tk    1.2%  █     |
| Built-in tools           3,600 tk    1.8%  █     |
| MCP: github             18,200 tk    9.1%  █████ |
| MCP: context7            3,100 tk    1.6%  █     |
| Custom tools               800 tk    0.4%        |
| Unknown                  1,200 tk    0.6%        |
| ------------------------------------------------ |
| System prompt total     35,300 tk   17.7%        |
| Conversation so far     42,000 tk   21.0%        |
| Available              122,700 tk   61.3%        |
+--------------------------------------------------+
```

### Session Summary (on idle)

```
Session Summary
-------------------------------------
Messages sent:                    24
Total input tokens:         ~384,000
Total output tokens:         ~52,000
Session duration:              18min
Compactions:                       2

MCP Tool Call Costs (responses):
  github     -- 12 calls -- ~24,800 tk
  context7   -- 4 calls  -- ~3,200 tk

Top context consumers (static, per message):
  System prompt             35,300 tk
-------------------------------------
```

### Threshold Alerts

When context usage approaches configured thresholds:

```
WARNING: Context usage at 72% -- approaching warn threshold.
  Consider disabling unused MCP servers to free up context.
  Largest consumer: MCP: github (18,200 tk / 9.1%)
```

```
CRITICAL: Context usage at 91% -- session will compact soon.
  Largest consumer: Conversation (140,000 tk)
```

### Inline Context Budget Tool

Ask the LLM "how's my context budget looking?" and it can call the `context_budget` tool to report inline:

```
Context Budget for claude-opus-4-6 (200K window):

- MCP: github: 18,200 tokens (9.1%)
- Agent: 4,200 tokens (2.1%)
- Built-in tools: 3,600 tokens (1.8%)

System prompt total: 32,200 tokens (16.1%)
Conversation so far: 42,000 tokens (21.0%)
Available: 125,800 tokens (62.9%)
```

## How It Works

### Hooks

The plugin uses five OpenCode integration points:

1. **`chat.message`** -- Fires for the current user message before the model runs. This is used for cumulative session input totals in the idle summary.

2. **`experimental.chat.messages.transform`** -- Fires with the full retained message list before it is converted into model input. This is used to estimate the full retained conversation budget for the active session.

3. **`experimental.chat.system.transform`** -- Fires before every message. Captures the full assembled system prompt, segments it into categories, counts tokens per segment, and logs the budget breakdown.

4. **`tool.execute.after`** -- Fires after each tool call. Tracks the token cost of MCP tool call responses (the dynamic cost on top of the static definition cost).

5. **`event`** -- Subscribes to `session.idle`, `session.compacted`, and `session.deleted` so summaries, compaction warnings, and tracker cleanup stay aligned with the active session.

### Segmentation

The system prompt is parsed using regex patterns to identify:

- **MCP tool definitions** -- Tool schemas with server-prefixed names (e.g., `github_list_repos`)
- **Agent instructions** -- The core system prompt for the active agent
- **Skills** -- Loaded from `.opencode/skill/`
- **Rules/Instructions** -- From `AGENTS.md`, instruction files, custom rules
- **Built-in tools** -- OpenCode's native tools
- **Custom tools** -- Plugin-defined tools
- **Unknown** -- Anything that doesn't match the above categories

Users can add custom patterns via the `customSegmentPatterns` config option.

### Custom Tool

The plugin exposes a `context_budget` tool that the LLM can call to report the current budget breakdown inline in conversation.

## Accuracy Disclaimer

Token counts are **estimates** using tiktoken with the `cl100k_base` encoding. This is not the exact tokenizer for each provider:

- Claude uses its own tokenizer (not publicly available as a local library)
- OpenAI models use various tiktoken encodings
- Google models use SentencePiece

However, `cl100k_base` provides **directionally accurate** results that are close enough for budget analysis. The goal is relative comparison between segments and trend tracking over time, not exact token counts. For most practical purposes, estimates are within 5-15% of actual values.

## Contributing

### Development Setup

```bash
# From the ai-registry repo root
bun install

# Run tests
bun run --cwd vendor/opencode-context-inspector test

# Type check
bun run --cwd vendor/opencode-context-inspector lint
```

### Running Tests

```bash
# Run all tests
bun run --cwd vendor/opencode-context-inspector test

# Watch mode
bun run --cwd vendor/opencode-context-inspector test:watch
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Run `bun run --cwd vendor/opencode-context-inspector test` and `bun run --cwd vendor/opencode-context-inspector lint` to verify
5. Commit with a descriptive message
6. Push to your fork and open a pull request

## Roadmap

- **TUI widget** -- Real-time budget display in the OpenCode terminal UI
- **Per-provider tokenizers** -- Use provider-specific tokenizers for better accuracy
- **Export to CSV** -- Export session budget data for offline analysis
- **Budget alerts via notifications** -- OS-level notifications for threshold breaches
- **Historical tracking** -- Track budget trends across sessions
- **MCP server recommendations** -- Suggest which servers to disable based on usage patterns

## License

MIT
