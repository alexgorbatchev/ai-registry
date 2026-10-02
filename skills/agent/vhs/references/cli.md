# CLI reference

## Contents

- [Commands](#commands)
- [Flags](#flags)
- [Environment](#environment)
- [Streams, errors, and side effects](#streams-errors-and-side-effects)

## Commands

| Invocation | Arguments and behavior |
| --- | --- |
| `vhs <file> [flags]` | At most one input. Appends `.tape` when the supplied filename lacks that suffix. Executes the tape and renders its selected outputs. |
| `vhs -` or `vhs < demo.tape` | Reads stdin; no argument also reads piped stdin. An interactive invocation without input prints help after dependency checks. Empty input fails. |
| `vhs new <name>` | Exactly one name; strips a trailing `.tape`, creates `<name>.tape` with an annotated starter, and adjusts the starter GIF path. **Truncates an existing destination.** |
| `vhs validate <file>...` | One or more literal filenames. Parses each readable file and any `Source` includes without starting the recording. Syntax errors cause nonzero exit. |
| `vhs record [-s <shell>] > recorded.tape` | No positional arguments; starts an interactive PTY and converts input into tape instructions. Requires terminal stdin. Exit the shell with `exit` or EOF to finish. stdout holds the tape, stderr shows the interactive session. |
| `vhs themes` | No arguments; lists embedded theme names, sorted without regard to case. Theme selection itself requires exact case. |
| `vhs themes --markdown` | Hidden boolean flag; default false. Emits a heading and Markdown list. |
| `vhs publish <file.gif>` | Exactly one lowercase `.gif` path. Uploads an existing GIF and returns a shareable URL. Rejects tapes and other suffixes. |
| `vhs serve` | Starts a long-running SSH renderer. Configured through environment, with no command-specific flags. See setup for the protocol. |
| `vhs manual` or `vhs man` | Hidden command/alias, no arguments. Prints rendered Markdown on terminal stdout and roff on redirected stdout. The manual is incomplete relative to the parser/settings map. |
| `vhs help [command...]` | Generated command help. Use `vhs help completion zsh` for nested help. |
| `vhs completion <shell>` | Hidden generated group; shells: `bash`, `zsh`, `fish`, `powershell`. Emits a shell completion script to stdout. |

Before validation, check readability; an unreadable filename can otherwise produce exit zero:

```sh
test -r demo.tape && vhs validate demo.tape
vhs validate tapes/*.tape
vhs demo.tape
vhs - < demo.tape
```

Do not pass a quoted glob expecting VHS to expand it. Avoid launching `vhs new` over an existing authored tape. Review recorded tapes, add `Output`, settings, requirements, and synchronization, then validate and render; the recorder is an input-capture starting point rather than a production-ready script.

## Flags

| Scope | Flag | Type/default | Behavior |
| --- | --- | --- | --- |
| Root | `-o`, `--output` | string slice / empty | Recognizes lowercase `.gif`, `.mp4`, `.webm`. Repeat the flag or provide comma-separated names. Updates only recognized format slots, after tape execution; other outputs remain. Last path for each format wins. |
| Root | `-p`, `--publish` | boolean / false | Upload the selected GIF after a successful render. No GIF output means nothing is published. |
| All commands | `-q`, `--quiet` | boolean / false | Suppress normal logging and execution trace. Publication still prints the URL. Does not guarantee silence for warnings/errors. |
| All command help paths | `-h`, `--help` | boolean / false | Print help for the selected command. |
| Root | `-v`, `--version` | boolean / false | Print build version and abbreviated commit when available. |
| `record` | `-s`, `--shell` | string | Default: basename of `SHELL`, otherwise the platform default (`bash` on Unix, `cmd` on Windows). Recording starts that executable; replay still needs a supported `Set Shell` value. |
| `themes` | `--markdown` | boolean / false | Hidden Markdown output selector. |
| Each completion shell | `--no-descriptions` | boolean / false | Disable descriptions in the generated completion script. |

Root-only output/publish flags do not apply to the subcommands. Use `--` to end flag parsing when passing a tape filename that starts with a dash.

```sh
vhs demo.tape -o artifacts/demo.gif -o artifacts/demo.mp4
vhs demo.tape --output artifacts/demo.gif,artifacts/demo.webm
vhs manual > vhs.1
vhs themes 2> themes.txt
vhs completion zsh > _vhs
```

Completion loading: Bash requires bash-completion; source the generated script. In Zsh enable `compinit` and source it or put `_vhs` on `fpath`. Fish can load `vhs completion fish | source`; persist in its completions directory. PowerShell can use `vhs completion powershell | Out-String | Invoke-Expression` in an authorized shell setup. These commands install completion in the invoking environment, not inside the VHS recording shell.

## Environment

| Variable | Effective default / semantics |
| --- | --- |
| `VHS_PUBLISH` | Unset: no automatic upload; exact value `true` enables upload. Setting it to another value disables automatic upload and suppresses the publishing suggestion, but does not override `--publish`. |
| `VHS_NO_SANDBOX` | Empty/unset: browser sandbox stays enabled. **Any nonempty value, including `0`, disables it.** Use only when the execution environment requires that browser setting. It does not sandbox tape commands. |
| `SHELL` | Supplies the `record --shell` default. Does not choose the render shell. |
| `VHS_RECORD` | Recorder sets `true` in its child shell; shell configuration can use it to recognize interactive capture. |
| `PATH` | Dependency and `Require` lookup; inherited by child commands. |
| `VHS_HOST` | SSH server bind host, default `localhost`. |
| `VHS_PORT` | SSH server port, integer, default `1976`. |
| `VHS_KEY_PATH` | SSH server host key; empty selects `.ssh/vhs_ed25519` relative to working directory. |
| `VHS_AUTHORIZED_KEYS_PATH` | Optional authorized keys file; empty means no configured authorized-key restriction. |
| `VHS_UID`, `VHS_GID` | Integers, both default zero. Privilege dropping is attempted only when both are nonzero; platform support varies. |

Browser selection/download and caches belong partly to the pinned go-rod dependency. Do not invent VHS-specific browser-path flags or environment settings; verify go-rod's current contract if configuring it directly. VHS can download a browser when no installed candidate is found. OS temporary directories are used for browser profiles and capture layers.

## Streams, errors, and side effects

- Render execution trace normally goes to stdout; general logging, theme listings, and encoder messages use stderr. Main command errors can also be printed on stdout. In automation capture both streams and use the exit code.
- CLI failures exit nonzero. Unknown syntax, missing dependencies, failed waits, unsupported settings values, and encoder failures can stop recording. Shell command failures inside `Type` do not automatically fail VHS.
- Relative input, output, includes, images, and typed commands use the process working directory; VHS does not change into the input tape's directory.
- Media and screenshot encoding uses FFmpeg overwrite mode. Text outputs are created/truncated on first snapshot. Frame exports move a temporary directory at teardown; choose an absent destination on the same filesystem and verify export actually occurred.
- Rendering starts ttyd, a headless browser, and the selected shell. It writes temporary captures, executes shell side effects, writes requested outputs, and attempts cleanup. Clipboard commands access the host clipboard.
- Publishing creates/uses an Ed25519 key and `known_hosts` in the platform's VHS user data directory, connects to `ghost.charm.sh:22`, and sends the GIF. Unknown host keys are recorded on first use; changed known keys are rejected. SSH serving creates/uses a server host key.
