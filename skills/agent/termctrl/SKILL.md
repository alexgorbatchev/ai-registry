---
name: termctrl
description: Use when operating or testing interactive terminal applications, inspecting TUI screens, or capturing terminal screenshots and recordings.
author: alexgorbatchev
metadata:
  created_on: 2026-10-08 13:49
  last_modified: 2026-10-08 13:49
  status: current
---

Check `termctrl --version` and `termctrl <command> --help` for the installed interface. Use [Terminal Control documentation](https://github.com/anomalyco/terminal-control) for additional capabilities. If the binary is missing, report that dependency before attempting terminal control.

## Choose the session lifecycle

- Use `termctrl show -- <command> <args>` for a disposable screen read. One-off `show` and `save` terminate the launched process tree after capture; use `start` for applications that must remain alive.
- Use `start NAME` for repeated inspection and interaction in one background PTY. Persistent sessions require macOS or Linux.
- Use `run NAME -- <command>` when the user wants the application visible and interactive in their terminal while the agent controls the same session.
- Inspect `termctrl list --json` before choosing a session name. Do not stop, restart, or reuse an unrelated session. Control an existing session only when the task identifies it.

For a named session, substitute the actual command, arguments, and visible readiness text:

```bash
termctrl start tui-check --cols 100 --rows 32 -- my-terminal-app
termctrl wait tui-check 'Ready' --timeout 5000
termctrl show tui-check
termctrl send tui-check 'text:help' enter
termctrl wait tui-check 'Commands' --timeout 5000
termctrl show tui-check
termctrl stop tui-check
```

Read the initial screen to identify readiness text if it is unknown; do not invent a wait target. After input, wait for the expected visible transition and inspect the resulting screen. A successful input command does not prove the application accepted the action. On timeout, inspect `status` and `show` before deciding the next action; do not blindly resend input. Stop sessions created for the task when finished, including after failures, unless the user wants them retained.

## Observe and interact

- Use `show NAME` for the current visible screen and `logs NAME` for retained output from normal-screen commands. Logs do not represent the visible state of a full-screen alternate-screen TUI.
- Named screen reads return immediately by default. Use `wait NAME TEXT --timeout MS` for a visible condition; its timeout is a maximum, not a delay. Add `--settle-ms` and `--deadline-ms` to `show` only when waiting for quiet output is the intended condition.
- Quote text atoms containing spaces: `termctrl send tui-check 'text:search phrase' enter`. Send named keys separately, such as `down`, `tab`, `escape`, or `ctrl-c`. For exact bytes, use `--stdin`; it cannot be combined with input atoms or pacing.
- Use `termctrl mouse tui-check click 12 4` for zero-based column/row coordinates after inspecting the screen. Mouse input requires application mouse reporting; drag with `down`, `move`, then `up`.
- Use `termctrl resize tui-check --cols 120 --rows 40` to inspect layout at another viewport size, then read the screen again.
- For OpenTUI applications, add `--host opentui` to the launch. `show NAME --format semantic` reads optional application-provided semantics; an empty snapshot does not prove an empty UI.

## Capture evidence

Save only the formats needed for the task, under its artifact directory:

```bash
termctrl save tui-check --format png --format txt --out .tmp/termctrl/current
```

This writes `current.png` and `current.txt`. Inspect the generated image before claiming visual correctness; terminal text alone does not verify colors or layout.

When a retained timeline or video is requested, launch with `--record .tmp/termctrl/demo.termctrl`, add named moments with `mark NAME MARKER`, stop the session, then export:

```bash
termctrl markers .tmp/termctrl/demo.termctrl
termctrl show --recording .tmp/termctrl/demo.termctrl --at-marker done
termctrl video .tmp/termctrl/demo.termctrl --out .tmp/termctrl/demo.mp4
```

Create the `done` marker after verifying the desired screen during the live session. Video export requires `ffmpeg`; consult `video --help` for marker-based edit plans and pointer overlays. Recordings retain terminal output and input; avoid recording secrets and inspect artifacts before sharing.

Report the observed outcome, artifact paths, and any failed wait or unsupported operation. Do not claim a workflow passed solely because the commands ran.
