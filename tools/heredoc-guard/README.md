# Heredoc guard

Tool overlay that blocks shell heredocs in Claude Code and Codex Bash calls and tells the agent to write the content with its file tools (Write or Edit in Claude Code, `apply_patch` in Codex) and pass the file path instead.

- `harnesses/claude-code/settings.json` and `harnesses/codex/hooks.json` add one `PreToolUse` hook each. The hook is an inline shell command that uses only builtins: it reads the one-line JSON payload with `read` and matches it with `case`, so it starts no interpreter or other process. A match exits 2 with the reason on stderr, which both harnesses treat as a block and return to the agent.
- A command is blocked when it contains `<<` (not part of a `<<<` here-string), followed by an optional `-` or one space and a delimiter that starts with a letter, `_`, or a quote, and the payload contains an escaped newline after it. Single-line uses of `<<`, such as bit shifts, and here-strings pass. A multi-line command with `<<` followed by a word, such as a bit shift in an inline script, is also blocked.
- Codex runs untrusted hooks only after approval: approve this one once per machine with `/hooks`.

Behavior is tested in `__tests__/heredocGuard.test.ts`. Delete this directory to remove the guard.
