---
name: opencode-config
description: Rules and guidelines for configuring the OpenCode CLI, including Agents, Commands, Skills, and Permissions.
---

# OpenCode Configuration Guide

OpenCode is an interactive AI CLI agent. This skill provides the necessary context for understanding its configuration structure so that you can create, modify, or extend its capabilities.

## Architecture & File Locations

OpenCode configurations can be placed either globally or per-project:
- **Global:** `~/.config/opencode/`
- **Project-local:** `.opencode/`

Inside these directories, OpenCode expects the following structure:
- `opencode.json` (or `.jsonc`): The main configuration file.
- `agents/*.md`: Markdown files defining custom agents (Primary or Subagents).
- `commands/*.md`: Markdown files defining custom slash commands (e.g., `/test`).
- `skills/<name>/SKILL.md`: Markdown files defining dynamic skills loaded via the `skill` tool.

## 1. Skills
Skills are reusable behavior definitions.
- Must be located at `skills/<skill-name>/SKILL.md`.
- `SKILL.md` must start with YAML frontmatter containing `name` and `description`.
- `name` must be 1-64 characters, lowercase alphanumeric with single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- The agent loads them on-demand via the native `skill({ name: "..." })` tool.

Example `skills/git-release/SKILL.md`:
```yaml
---
name: git-release
description: Create consistent releases and changelogs
---
## What I do
- Draft release notes...
```

## 2. Agents
Agents are specialized AI assistants. There are **Primary agents** (main conversation) and **Subagents** (invoked automatically or via `@name`).
- Markdown agents are defined in `agents/*.md`.
- The filename (without `.md`) becomes the agent's name.

Example `agents/security-auditor.md`:
```yaml
---
description: Performs security audits and identifies vulnerabilities
mode: subagent
model: anthropic/claude-3-5-sonnet-20241022
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": ask
---
You are a security expert. Focus on identifying potential security issues.
```

### Agent Configuration Options:
- `description` (required): What the agent does.
- `mode`: `primary`, `subagent`, or `all`.
- `model`: Override the default model (e.g., `anthropic/claude-3-5-sonnet-20241022`).
- `temperature`: 0.0 to 1.0.
- `steps`: Max agentic iterations before forcing text-only response (replaces deprecated `maxSteps`).
- `permission`: Fine-grained tool access (`ask`, `allow`, `deny`) for `edit`, `bash`, `webfetch`, etc.

## 3. Commands
Commands let you create custom `/slash` commands in the TUI.
- Defined in `commands/*.md`.
- The filename becomes the command name (e.g., `commands/test.md` becomes `/test`).

Example `commands/analyze-coverage.md`:
```yaml
---
description: Analyze test coverage
agent: plan
---
Here are the current test results:
!`npm test`

Review the component in @src/components/Button.tsx.

Focus on the failing tests for $ARGUMENTS and suggest fixes.
```
### Command Features:
- `$ARGUMENTS` or `$1`, `$2`: Inject user-provided arguments.
- `!command`: Inject shell output into the prompt.
- `@filepath`: Inject file contents into the prompt.
- `agent`: Specify which agent should execute this command.
- `subtask`: Set to `true` to force execution as a subagent, keeping the main context clean.

## 4. Permissions
Permissions control what tools an agent can execute. They can be set globally in `opencode.json` or overridden per agent.
Values: `ask`, `allow`, `deny`.

Example `opencode.json`:
```json
{
  "permission": {
    "edit": "deny",
    "bash": {
      "*": "ask",
      "git status": "allow",
      "grep *": "allow"
    },
    "skill": {
      "internal-*": "deny"
    }
  }
}
```
**Important:** Rules evaluate in order. The *last matching rule wins*. Always place wildcards (`*`) first.

## Best Practices
1. **Prefer `permission` over `tools`:** The `tools: { write: false }` format is deprecated. Use `permission: { edit: deny }` instead.
2. **Subagents for Specific Tasks:** Keep your primary context clean by defining specialized `subagent`s with limited permissions.
3. **Use Skills for Knowledge:** Don't bloat system prompts. Put domain knowledge in `skills/` so agents can retrieve it *only* when needed.
