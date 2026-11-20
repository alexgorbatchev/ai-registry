# Heredoc guard

Tool overlay that blocks shell heredocs in Claude Code and Codex Bash calls and tells the agent to write the content with its file tools (Write or Edit in Claude Code, `apply_patch` in Codex) and pass the file path instead.

- `harnesses/claude-code/settings.json` and `harnesses/codex/hooks.json` add one `PreToolUse` hook each. The hook is an inline shell command that runs one `grep -E` over the JSON payload on stdin and starts no interpreter. A match exits 2 with the reason on stderr, which both harnesses treat as a block and return to the agent.
- Matching stays in `grep` because shell `case` and `${var%pattern}` matching backtrack quadratically on long lines: a 100 KB command full of `<<` took seconds to minutes in bash 3.2 and zsh, past the hook's timeout. `grep -E` decides the same input in milliseconds.
- A command is blocked when it contains `<<` (not part of a `<<<` here-string), followed by an optional `-`, an optional space and a delimiter that starts with a letter, `_`, a backslash or a quote, and the command contains a newline after it. A literal `\n` in the command text, such as one inside a quoted string, does not count. Single-line uses of `<<`, such as bit shifts, and here-strings pass. A multi-line command with `<<` followed by a word, such as a bit shift in an inline script, is also blocked.
- Codex runs untrusted hooks only after approval: approve this one once per machine with `/hooks`.

Behavior is tested in `__tests__/heredocGuard.test.ts`. Delete this directory to remove the guard.
