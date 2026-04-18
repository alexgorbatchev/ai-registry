# Changelog

## 0.1.0 (2026-02-16)

### Features

- Initial release
- Per-message context budget breakdown via `experimental.chat.system.transform` hook
- System prompt segmentation into categories: MCP tools, agent instructions, skills, rules, built-in tools, custom tools, unknown
- Token counting using tiktoken `cl100k_base` encoding
- Session summary on `session.idle` with cumulative stats
- MCP tool call response token tracking via `tool.execute.after`
- Conversation token growth tracking via `message.updated` events
- Configurable warn/critical threshold alerts
- Custom segment patterns via plugin configuration
- `context_budget` custom tool for inline budget reports
- Model context window auto-detection with manual override
