---
created_on: 2026-09-28 11:26
last_modified: 2026-09-28 11:26
status: current
---

# Skills vs. Commands (Prompt Templates) in Agent Harnesses

## Purpose
This document provides a technical comparison between **non-model-invokable Agent Skills** (`disable-model-invocation: true`) and **custom slash commands / prompt templates** across AI coding agent harnesses—specifically focusing on **Pi** and **Claude Code** (as well as Codex and OpenCode within the `ai-registry` ecosystem). It defines behavioral contracts, execution lifecycles, known edge cases (such as silent argument dropping), and migration guidelines for converting single-file skills into commands.

---

## Architectural Overview

At a high level, both non-model-invokable skills and custom commands provide user-facing prompt shortcuts triggered via slash syntax. However, their internal registration, lifecycle, invocation payloads, and execution mechanics differ significantly.

| Characteristic | Non-Model-Invokable Skill (`disable-model-invocation: true`) | Slash Command / Prompt Template |
| :--- | :--- | :--- |
| **Specification** | [Agent Skills Standard](https://agentskills.io) (`SKILL.md`) | Harness-specific command/prompt format |
| **Filesystem Layout** | Directory bundle: `skills/<name>/SKILL.md` (plus optional `scripts/`, `references/`, `assets/`) | Single flat Markdown file: `commands/<name>.md` (Claude/OpenCode) or `prompts/<name>.md` (Pi/Codex) |
| **Pi Invocation** | `/skill:<name> [args]` (requires `skills.enableSkillCommands: true`) | `/<name> [args]` |
| **Claude Code Invocation** | `/<name> [args]` | `/<name> [args]` |
| **Payload Delivery to LLM** | Injected with harness context wrappers (e.g., `<skill name="..." location="...">` XML block in Pi) | Injected directly into the conversation as expanded prompt text |
| **Argument Mechanics** | Trailing arguments are automatically appended after the skill content | Interpolated via template placeholders (`$1`, `$@`, `$ARGUMENTS`). **Dropped if placeholders are absent.** |
| **Model Autonomy (Claude Code)** | Prohibited via `Skill` tool; Claude refuses and instructs the user to invoke it | Permitted via `SlashCommand` tool unless `disable-model-invocation: true` is set in frontmatter |
| **Subagent Delegation** | Supports background subagent forking via `context: fork` (Claude Code) | Runs within the current session context |
| **Dynamic Execution** | Static markdown instructions; references helper scripts via paths | Claude Code commands can execute inline bash (`!cmd`) and embed files (`@file`) |

---

## Harness-Specific Mechanics

### 1. Pi Coding Agent (`pi`)

#### Skills Lifecycle
- **Discovery:** Pi scans configured skill directories (`~/.pi/agent/skills/`, `.pi/skills/`, `.agents/skills/`).
- **Exclusion from System Prompt:** When `disable-model-invocation: true` is set in `SKILL.md` frontmatter, Pi filters the skill out of `formatSkillsForPrompt`. The skill name and description are not advertised in the `<available_skills>` system prompt block.
- **Invocation & Expansion:** When invoked via `/skill:<name> [args]`, Pi's `_expandSkillCommand` wraps the stripped body into an XML structure before sending it to the model:
  ```xml
  <skill name="<name>" location="/path/to/SKILL.md">
  References are relative to /path/to/skillDir.

  <body content>
  </skill>

  [trailing args]
  ```
- **Argument Handling:** Pi automatically appends any arguments passed to `/skill:<name>` to the end of the expanded text.

#### Commands (Prompt Templates) Lifecycle
- **Discovery:** Pi loads `.md` files directly under `prompts/` (e.g., `~/.pi/agent/prompts/*.md`, `.pi/prompts/*.md`).
- **Invocation & Expansion:** Invoked as `/<name> [args]`. Pi's `expandPromptTemplate` performs argument substitution using `substituteArgs`.
- **Supported Variables:**
  - `$1`, `$2`, etc.: Positional arguments.
  - `$@` or `$ARGUMENTS`: All arguments joined with spaces.
  - `${1:-default}` or `${@:-default}`: Positional or all arguments with fallback defaults.
  - `${@:N}` or `${@:N:L}`: Sliced argument ranges.
- **CRITICAL FAILURE MODE (Silent Argument Dropping):**
  If a prompt template in Pi does **not** contain any `$1`, `$@`, or `$ARGUMENTS` tokens, all arguments typed by the user after `/<name>` are completely discarded during substitution. Unlike skills, prompt templates do not automatically append unused trailing arguments.

---

### 2. Claude Code (`claude`)

#### Skills Lifecycle
- **Discovery:** Claude Code discovers skills under `skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, and plugin roots.
- **Model Invocations:** The model has access to a built-in `Skill` tool. When a skill specifies `disable-model-invocation: true`:
  - The model is blocked from calling the skill programmatically.
  - If Claude attempts to invoke the skill, the runtime prompts Claude to ask the user to run the slash command instead.
- **User Invocation:** Users invoke skills directly in the prompt input using `/<name> [args]`. Claude Code displays skills in the slash menu autocomplete with a `(skill)` or plugin tag.
- **Advanced Skill Capabilities:**
  - `context: fork`: Runs the skill execution inside an isolated background subagent session.
  - `${CLAUDE_SKILL_DIR}`: Dynamic variable resolving to the skill's filesystem directory.

#### Commands Lifecycle
- **Discovery:** Claude Code loads Markdown files under `commands/*.md` or `.claude/commands/*.md`.
- **Model Invocations via `SlashCommand` Tool:** By default, custom commands defined in `commands/` can be programmatically invoked by Claude via the built-in `SlashCommand` tool.
  - **CRITICAL:** To make a command manual-only, you must explicitly declare `disable-model-invocation: true` in the command's YAML frontmatter.
- **Dynamic Syntax:**
  - Dynamic arguments: `$ARGUMENTS` or positional `$1`, `$2`.
  - Static or dynamic file inclusion: `@path/to/file` or `@$1` reads the target file and injects its content directly into the prompt before dispatch.
  - Inline bash context: Commands can execute shell commands inline using `!command` syntax (e.g., `!git status`) to inject dynamic context.

---

## Migration Guide: Moving a Single-File Skill to Commands

When a skill consists of only a `SKILL.md` file without supplementary directories (`scripts/`, `references/`, `assets/`) and has `disable-model-invocation: true`, it can be migrated to `commands/<name>.md`. This eliminates directory nesting and enables cleaner invocation (`/<name>` instead of `/skill:<name>` in Pi).

### Migration Checklist

1. **Add Argument Tokens (`$@` or `$ARGUMENTS`):**
   Ensure trailing arguments are not lost. If the skill expected user instructions or flags, place `$@` or `$ARGUMENTS` in the command body (usually at the end):
   ```markdown
   ---
   description: Run code quality check
   ---
   Execute quality review according to the following guidelines:
   ...

   $@
   ```

2. **Retain `disable-model-invocation: true` for Claude Code:**
   In Claude Code, files in `commands/` are exposed to the `SlashCommand` tool by default. To keep the command restricted to manual user execution only:
   ```yaml
   ---
   description: Production deployment checklist
   disable-model-invocation: true
   ---
   ```

3. **Verify File & Path Dependencies:**
   Skills provide contextual paths (`references are relative to ...` in Pi, `${CLAUDE_SKILL_DIR}` in Claude Code). If the instructions reference relative paths, ensure those references remain valid from the project root or use template tokens.

4. **Consider Ecosystem Portability:**
   - Use `skills/<name>/SKILL.md` if the capability must be distributed as an open Agent Skills package (`npx skills`) or shared with non-slash-command agents.
   - Use `commands/<name>.md` if the primary use case is a human-triggered slash workflow across unified harnesses.

---

## AI Registry Build Mapping

In this repository (`ai-registry`), source assets placed under `commands/` are automatically processed by `bun run build` and compiled for all supported harnesses:

- **OpenCode:** `.output/opencode/commands/<name>.md`
- **Codex:** `.output/codex/<profile>/prompts/<name>.md`
- **Pi:** `.output/pi/<profile>/prompts/<name>.md`
- **Claude Code:** `.output/claude-code/<profile>/commands/<name>.md`

Any template tags (`{{repo_root}}`, `{{file_path}}`, etc.) inside the command files are expanded at build time.
