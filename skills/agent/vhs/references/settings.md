# Complete settings reference

Put these directives in the initial contiguous block of `Set`, `Output`, and `Require` commands. Include expansion counts as part of that ordering. The first other command, including `Env`, ends the block. After that point, only `Set TypingSpeed` is honored during interaction; other settings are warned about and ignored. `Set Shell` is also processed in the startup prepass.

Defaults below come from the v0.12.1 implementation, not starter-tape overrides.

| Setting | Type and default | Meaning / constraints |
| --- | --- | --- |
| `Shell` | string: `bash` on Unix, `cmd` on Windows | Supported names: `bash`, `zsh`, `fish`, `nu`, `osh`, `xonsh`, `powershell`, `pwsh`, `cmd`. Selected executable must be installed. Arbitrary executable paths/arguments are not accepted. |
| `Width` | integer: `1200` | Final canvas width in pixels, including appearance padding/margins. Cannot combine with Columns. |
| `Height` | integer: `600` | Final canvas height in pixels, including padding/margins/window bar. Cannot combine with Rows. |
| `Columns` | positive integer: unset (`0`) | Exact terminal character columns. Derives pixel width from measured font/grid and appearance. Cannot combine with explicit Width in either order. |
| `Rows` | positive integer: unset (`0`) | Exact terminal character rows. Derives pixel height. Cannot combine with explicit Height in either order. |
| `FontSize` | integer: `22` | Pixels. Use a positive value and inspect actual readability. |
| `FontFamily` | string: fallback list below | Installed font family name or comma-separated fallback list. Specify required fallbacks explicitly when choosing a custom family. Does not download fonts. |
| `LetterSpacing` | float: `1.0` | Additional spacing in pixels. Quote a negative numeric value if intentionally used; validate its actual rendering. |
| `LineHeight` | float: `1.0` | Line-height multiplier; use a positive value. |
| `TypingSpeed` | duration: `50ms` | Delay per character/key. Bare numeric value means seconds; supports `ms`/`s`. Can change during interaction; `@duration` overrides one command. |
| `Theme` | exact theme name or flat JSON: built-in default | Named themes from `vhs themes`; case-sensitive. Empty string resets default. Custom JSON is a replacement object, not a merge with the default. |
| `Padding` | integer: `60` | Interior space in pixels on every side. Use nonnegative values; subtracts from usable content dimensions. |
| `Margin` | integer: `0` | Exterior space in pixels on every side when MarginFill is nonempty. |
| `MarginFill` | string: `"#171717"` | `#RRGGBB` color, or image path used as the outer background. Quote hex colors; empty string disables the fill. An image path must exist from working directory. |
| `WindowBar` | string: `""` | `Colorful`, `ColorfulRight`, `Rings`, `RingsRight`, or empty for none. Spelling/case are exact. |
| `WindowBarSize` | integer: `30` | Bar height in pixels; relevant when a bar is selected. |
| `BorderRadius` | integer: `0` | Corner radius in pixels. Use a nonnegative radius that fits the terminal; add contrasting MarginFill/Margin to reveal corners. |
| `Framerate` | integer: `50` | Capture frames per second. Use a positive value; lower rates reduce capture/encoding load but affect animation and screenshot timing. |
| `PlaybackSpeed` | float: `1.0` | Output timestamp speed multiplier: 2 makes playback faster, 0.5 slower. Use positive values. Does not make typed commands finish sooner. |
| `LoopOffset` | float percent: `0` | Rotate captured frame sequence; `20` and `20%` both mean twenty percent. Does not mean a frame count or seconds; affects video outputs sharing the sequence. Keep within 0–100. |
| `CursorBlink` | boolean: `true` | Exact unquoted `true` or `false`. Disable for stable screenshots and less visual noise. |
| `WaitTimeout` | duration: `15s` | Default timeout for Wait. Use a positive value; override individual waits with `@duration`. |
| `WaitPattern` | regex: `/>$/` | Default Wait pattern; use `/^>\s*$/` for the stock prompt and replace for custom prompts. |

Default font preference: `JetBrains Mono,DejaVu Sans Mono,Menlo,Bitstream Vera Sans Mono,Inconsolata,Roboto Mono,Hack,Consolas,ui-monospace,monospace,Apple Symbols`. Font availability and glyph coverage affect layout. Choose and install the same font on local and CI renderers when exact dimensions matter.

## Geometry

For explicit pixel sizes, usable terminal width is approximately `Width - 2*Padding - 2*Margin`; height also subtracts `WindowBarSize` when a bar is enabled. Margin is applied only with nonempty fill. Ensure usable dimensions are positive and large enough for the app. Use even final width/height for yuv420p MP4/WebM.

For fixed terminal grids, use `Set Columns 80` and `Set Rows 24` and omit Width/Height. VHS measures the live browser terminal, corrects for grid rounding, then rounds derived pixel dimensions to even numbers. Grid derivation can fail if the requested viewport cannot be resolved; report that error rather than guessing a replacement geometry.

```tape
Set Columns 80
Set Rows 24
Set FontSize 24
Set Padding 24
Set Margin 16
Set MarginFill "#243040"
Set WindowBar Colorful
Set WindowBarSize 30
Set BorderRadius 12
```

Use either grid or pixel dimensions for each axis; mixing Columns with Height, or Width with Rows, is allowed. Do not add unsupported `MaxColors`, `CursorStyle`, `Scrollback`, `WorkingDirectory`, `Quality`, or `Output` settings. GIF palette and codec choices are renderer behavior, not user-settable options in this release.

## Themes

Theme JSON accepts string fields: `name`, `background`, `foreground`, `selection`, `cursor`, `cursorAccent`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, and `brightBlack`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`. Supply the colors actually needed; omitted fields become empty strings rather than inheriting VHS's defaults. Prefer a named theme unless constructing a full palette deliberately.

Set Theme updates terminal background and window-bar color. It does not automatically change the default MarginFill; set MarginFill explicitly when matching a different background. ANSI colors affect applications that use the palette; application-specific truecolor output may remain independent.

Named and complete flat custom-palette forms:

```tape
Set Theme "Catppuccin Mocha"
# Alternatively select a complete replacement palette:
Set Theme {
  "name": "Demo palette",
  "background": "#171717", "foreground": "#dddddd",
  "selection": "#444444", "cursor": "#dddddd", "cursorAccent": "#171717",
  "black": "#282a2e", "red": "#D74E6F", "green": "#31BB71", "yellow": "#D3E561",
  "blue": "#8056FF", "magenta": "#ED61D7", "cyan": "#04D7D7", "white": "#bfbfbf",
  "brightBlack": "#4d4d4d", "brightRed": "#FE5F86", "brightGreen": "#00D787", "brightYellow": "#EBFF71",
  "brightBlue": "#9B79FF", "brightMagenta": "#FF7AEA", "brightCyan": "#00FEFE", "brightWhite": "#e6e6e6"
}
```

Choose one Theme directive for normal authoring; when multiple appear in the initial block, the last determines the effective palette.

Default palette, in ANSI order 0–15:

```text
#282a2e #D74E6F #31BB71 #D3E561 #8056FF #ED61D7 #04D7D7 #bfbfbf
#4d4d4d #FE5F86 #00D787 #EBFF71 #9B79FF #FF7AEA #00FEFE #e6e6e6
```

Default background/cursorAccent is `#171717`; foreground/cursor is `#dddddd`; name/selection are empty. Get named palettes from the pinned `themes.json` or inspect an actual render. Do not assume a theme name exists because it is common in another tool.

## Shell startup

Rendering uses predefined shell commands and a stock colored `> ` prompt. Bash starts without profile/rc and disables history; Zsh starts without rc and suppresses history storage; Fish starts without config and in private mode; PowerShell/pwsh omit profiles and disable history saving; cmd sets its prompt; osh/xonsh omit rc; nu sets prompt callbacks but can still have its own startup behavior. These do not reproduce the user's interactive dotfiles automatically.

Use explicit fixture paths and native commands for the selected shell. Bash `export`, PowerShell `$env:NAME=...`, Fish `set -gx`, Nushell `$env.NAME=...`, and cmd `set NAME=...` are shell commands, not interchangeable tape syntax. If a target requires startup configuration, load the required configuration deliberately during hidden setup and recheck readiness.
