---
name: vhs
description: Use when operating Charmbracelet VHS, writing or debugging .tape files, or creating terminal recordings, screenshots, demos, and golden tests.
author: alexgorbatchev
metadata:
  created_on: 2026-10-02 04:35
  last_modified: 2026-10-02 04:47
  status: current
---

## Read the relevant contracts

Use the bundled references as the operational manual for VHS v0.12.1:

| Task | Read |
| --- | --- |
| Install, check dependencies, use containers or SSH | [references/setup.md](references/setup.md) |
| Invoke any command, flag, or environment variable | [references/cli.md](references/cli.md) |
| Write or edit any `.tape` | [references/tape.md](references/tape.md) and [references/settings.md](references/settings.md) |
| Build demos, TUI interactions, screenshots, golden tests, or CI | [references/workflows.md](references/workflows.md) |
| Diagnose syntax, waiting, encoding, fonts, or portability | [references/troubleshooting.md](references/troubleshooting.md) |
| Check provenance or update for a different version | [references/sources.md](references/sources.md) |

Copy [assets/demo.tape](assets/demo.tape) for a reproducible multi-format demo or [assets/screenshot.tape](assets/screenshot.tape) for a still image. Run these from a scratch working directory; their outputs use relative paths.

## Execute the workflow

1. Establish the recording's purpose, target command, execution directory, intended formats, terminal dimensions, and platform. Inspect the target CLI's actual help and a successful manual run. If an input or expected result cannot be established, obtain it before scripting that step.
2. Run `vhs --version`, `ttyd --version`, and `ffmpeg -version`. Check the selected shell and target executables on `PATH`. Use `references/setup.md` for missing dependencies. Match the installed VHS version to this reference; verify changed behavior in upstream source before using features from another version.
3. Prepare reproducible fixtures and build/install the target program before recording. Use fixture data with no credentials, personal data, private paths, or proprietary names. A tape executes real shell commands with the user's filesystem and environment access; inspect every `Type`, `Paste`, and included tape before execution.
4. Write `Output`, `Require`, and all `Set` directives as the initial contiguous block. Place `Env` after that block and before `Hide` or interaction. VHS applies all tape `Env` directives and shell selections before starting its shell, but `Env` also ends the initial settings block. Only `TypingSpeed` can be changed during interaction.
5. Put setup commands under `Hide`. Wait for setup to finish, clear the terminal, allow the redraw to settle while hidden, then `Show`. Inspect the first rendered frame to verify setup is absent. Hiding excludes frames; it does not hide secrets from tape files, shell side effects, textual logs, or the environment.
6. Pair `Type` with `Enter` to execute a command. Synchronize with an observed prompt or application-specific output using `Wait`; use `Sleep` for deliberate reading time. Do not substitute a guessed duration for an available readiness condition. Avoid regexes that match the command being typed or stale output.
7. Verify every input tape exists and is readable, then run `vhs validate demo.tape` from the intended working directory. Validation parses syntax and includes; it does not verify executables, numeric constraints, themes, shell behavior, command success, or encoder availability. It silently skips unreadable input files.
8. Render with `vhs demo.tape`. Check the exit code, nonempty expected files, media metadata, actual frames/screenshots, and application output. A successful VHS run alone does not establish that a typed shell command succeeded. When using a golden output, compare it explicitly against the approved baseline.
9. Inspect the beginning, important intermediate states, and final frame for clipping, wrapping, unreadable text, unintended setup, incorrect commands, and premature termination. Adjust and rerender until those observable defects are absent.
10. Report the tape and artifact paths, VHS version, executed validation/render commands and results, and remaining limitations. Never describe an unrendered tape as verified, replace unavailable real output with fabricated imagery, or claim a golden test passed without a comparison.

## Apply operational boundaries

- Keep local rendering separate from publication. `--publish`, `vhs publish`, and `VHS_PUBLISH=true` upload the GIF externally; use them only when uploading is part of the requested work. Check inherited `VHS_PUBLISH` before rendering.
- Run untrusted tapes only in an isolated environment appropriate for arbitrary command execution. A headless browser and `Hide` do not sandbox the shell.
- Use the native tape commands documented in the references. VHS has no tape variables, interpolation engine, loops, assertions, arbitrary `Exec`, generic mouse commands, or arbitrary `Set` options. Generate distinct tapes externally when those features are needed.
- Keep included tapes acyclic and one level deep. Do not rely on nested `Source` rejection: the parser recursively expands successful includes and lacks robust cycle protection.
- Use `Screenshot path.png` for a composed still image. `Output frames/` preserves raw text/cursor layers; `Output path.png` is routed as a raw-frame destination, not a single screenshot.
- Keep screenshots visible and leave time after each request for the next capture frame. Do not request a screenshot while hidden or terminate immediately after requesting one.
- Do not infer support from keyword names or the generated manual. `Home` and `End` are not executable tape commands in this version; use a verified application binding such as `Ctrl+A` or `Ctrl+E` where appropriate.
