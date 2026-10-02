# Version and evidence

This manual targets VHS **v0.12.1**, commit **24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53**, inspected on 2026-10-02 UTC. The local binary reported `vhs version v0.12.1 (24fa225)`. Commands and behavior were checked against that binary and the following pinned upstream files.

| Contract | Primary source |
| --- | --- |
| Root CLI, defaults, validation, dependencies | [main.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/main.go) |
| Tokens and accepted grammar | [token/token.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/token/token.go), [parser/parser.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/parser/parser.go), [lexer/lexer.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/lexer/lexer.go) |
| Directive execution, keys, settings, Wait | [command.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/command.go) |
| Settings ordering, Env prepass, includes at runtime | [evaluator.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/evaluator.go) |
| Defaults, browser lifecycle, capture, grid sizing, loop rotation | [vhs.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/vhs.go) |
| Dimensions and appearance defaults | [style.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/style.go) |
| Shell startup and ttyd | [shell.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/shell.go), [tty.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/tty.go) |
| Encoders, overwrite behavior, frame export | [video.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/video.go), [ffmpeg.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/ffmpeg.go) |
| Screenshot scheduling | [screenshot.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/screenshot.go) |
| Textual snapshots | [testing.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/testing.go) |
| Clipboard and recording conversion | [record.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/record.go), [command.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/command.go) |
| SSH service and publishing | [serve.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/serve.go), [publish.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/publish.go) |
| Theme schema and exact names | [themes.go](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/themes.go), [themes.json](https://github.com/charmbracelet/vhs/blob/24fa2254a9806091e6ee6a980e9f3bcfe0a9ba53/themes.json) |
| Distribution and release | [v0.12.1 release](https://github.com/charmbracelet/vhs/releases/tag/v0.12.1) |
| GitHub Action inputs | [vhs-action/action.yml](https://github.com/charmbracelet/vhs-action/blob/main/action.yml) (moving upstream; recheck before use) |

## Resolve documentation discrepancies

Prefer the pinned implementation and a reproducer when the README or generated manual disagrees. In this version:

- `LoopOffset 5` means five percent, not the fifth frame.
- `validate` receives literal filenames; the invoking shell expands unquoted globs. Read errors are skipped.
- `--output` updates the GIF/MP4/WebM slots it recognizes; it does not clear unrelated tape outputs.
- `Source` removes included `Output` directives. Its nested-source check does not reliably reject successfully expanded nested includes, and recursion can be unbounded.
- `Env` and `Set Shell` anywhere in the expanded tape are applied before the shell starts. Other settings must remain in the initial contiguous settings/output/require block.
- `Home` and `End` appearing in tokens or recorder output does not mean the parser and executor support them.
- `VHS_UID` and `VHS_GID` default to zero; privilege dropping occurs only when both are nonzero.

## Refresh the skill

Compare `vhs --version` with the pinned release. For a new release, inspect every source area above, capture root and subcommand help, and rerun tape validation and real renders. Update command/setting inventories, defaults, caveats, and assets together. Do not copy upstream documentation wholesale or silently label newer behavior as v0.12.1.
