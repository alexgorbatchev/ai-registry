---
name: claude-remote-control
description: Use when asked to start Claude Code for connection from the Claude mobile app or claude.ai through Remote Control, including another session in a specified folder.
author: alexgorbatchev
metadata:
  created_on: 2026-10-22 08:50
  last_modified: 2026-10-22 08:50
  status: current
---

Start a persistent local Claude Code session with Remote Control and `--dangerously-skip-permissions`. This workflow intentionally bypasses Claude's tool permission checks; it does not authorize additional tasks, changes to other sessions, or global permission settings.

## Resolve and launch

1. Resolve the requested project directory from filesystem evidence and read its applicable `AGENTS.md` instructions. Search the development workspace with `rg --files --hidden` when only a folder name is given, excluding dependency and Git internals. Ask for the path only if multiple matching projects remain ambiguous. Never create a missing project folder as a substitute.
2. Check `claude --version`, `claude --help`, `termctrl --version`, and `termctrl start --help`. Consult the maintained [Remote Control documentation](https://code.claude.com/docs/en/remote-control) and [CLI reference](https://code.claude.com/docs/en/cli-reference) when flags or errors differ. If a required binary is missing, report it instead of claiming a session started.
3. Inspect `termctrl list --json`. Choose an unused terminal session name and a recognizable mobile title. A request for another session means a new persistent PTY; preserve existing sessions.
4. Substitute the verified absolute project path, unique terminal name, and mobile title in this launch command:

   ```sh
   termctrl start claude-mobile-project --cwd "$project_dir" --cols 140 --rows 45 -- claude --dangerously-skip-permissions --remote-control 'Project title'
   termctrl show claude-mobile-project --settle-ms 1500 --deadline-ms 10000
   ```

   Set `project_dir` to the resolved path before executing. Use `termctrl start` so Claude survives the Codex turn. A disposable `termctrl show -- claude ...` capture terminates its process tree. Do not send a coding prompt: leave the session ready for the user's mobile input.
5. Inspect each startup screen. Accept workspace trust only for the verified user-selected folder. Accept Remote Control and permission-bypass startup confirmations within this requested workflow; inspect the actual choices before sending keys. For a yes/no Remote Control prompt, use `termctrl send claude-mobile-project text:y enter`. For a menu, select the displayed affirmative choice. Read the screen again after each response; never blindly repeat input.

## Verify and connect

- Run `termctrl status claude-mobile-project` and `termctrl show claude-mobile-project`. Require a running process, the intended working directory and launch flags, an active Remote Control indicator, a session URL, and the displayed `bypass permissions on` state before reporting success. An interactive Claude prompt alone does not prove Remote Control connected.
- If the URL is absent, send `/remote-control` with `termctrl send claude-mobile-project text:/remote-control enter`, then inspect the status panel. Use the URL Claude actually prints; never construct or reuse another session's URL.
- Return the clickable session URL and title. Tell the user to open the Claude mobile app's **Code** tab using the same account and organization. Mention that the computer must remain awake and online. Keep the requested session running after returning; report its terminal name when useful for later management.
- If startup fails or a wait times out, inspect `status` and `show` before retrying. Resolve the reported cause within existing authorization. For sign-in, subscription, or organization-policy requirements needing the user, report the observed error and exact next action; do not expose credentials or change account-wide settings to force a connection.

## Server-mode alternative

For a request specifically requiring the `claude remote-control` server, check `claude remote-control --help` and use its native permission option:

```sh
termctrl start claude-mobile-project --cwd "$project_dir" --cols 120 --rows 36 -- claude remote-control --name 'Project title' --spawn session --permission-mode bypassPermissions
```

Verify the running command includes `--permission-mode bypassPermissions` and the server displays `Connected` with its session URL. `--spawn session` serves one session and exits when it ends. Do not pass the global `--dangerously-skip-permissions` flag to this subcommand or assume global flags propagate to its spawned sessions; the exact flag belongs to the interactive launch above. Do not silently substitute `acceptEdits` or `--allow-dangerously-skip-permissions`, which do not enable the requested full bypass.

Stop a terminal session with `termctrl stop <terminal-name>` only when the user requests stopping it or when cleaning up a disposable validation session. Use the [Terminal Control documentation](https://github.com/anomalyco/terminal-control) for lifecycle details.
