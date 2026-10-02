# Tape language

## Contents

- [Lexical rules](#lexical-rules)
- [Command inventory](#command-inventory)
- [Timing and synchronization](#timing-and-synchronization)
- [Key combinations](#key-combinations)
- [Outputs and captures](#outputs-and-captures)
- [Includes and environment](#includes-and-environment)

## Lexical rules

Use case-sensitive CamelCase command and setting names. `type`, `set`, `Wait+screen`, and `True` are not their documented counterparts. Whitespace separates tokens; commands can share a line (`Type "pwd" Enter Sleep 1s`). Prefer one command per line for review.

`#` starts a comment through end of line outside a quoted string. Quote colors and paths containing spaces, absolute paths starting with `/`, values beginning with digits, and shell commands. Bare identifiers support letters, digits, dots, hyphens, underscores, slashes, and percent signs, but punctuation at the start can select another token type. Reserved keywords used as data should be quoted.

Strings use double quotes, single quotes, or backticks. Their contents are literal until the same delimiter or a newline: **backslash does not escape the string delimiter**, and `\n` is not converted into an actual newline by VHS. Choose a delimiter absent from the content. When all three delimiters are needed, split typing into separate `Type` directives without inserting an extra Enter.

```tape
Type "printf 'ready\n'"
Enter
Type 'echo "double quotes"'
Enter
Type `printf '%s\n' "both quote kinds"`
Enter
# The shell interprets the backslash; VHS does not.
```

Strings cannot span physical lines. JSON theme objects may span lines, but the lexer scans only to the first `}`: use a flat object. There are no tape variables, string escapes, loops, conditionals, or shell substitution at the tape level. `$VAR` in `Type "echo $VAR"` is expanded later by the selected shell; `$VAR` in an output filename remains literal.

## Command inventory

| Command | Accepted shape | Meaning |
| --- | --- | --- |
| `Output` | `Output "path.gif"` | Select an output slot by suffix; see output table. |
| `Require` | `Require "executable"` | Look up one executable in `PATH`; repeat the directive for more requirements. Place in initial block. Does not check version or run the program. |
| `Set` | `Set Setting value` | See the complete settings reference. |
| `Env` | `Env KEY "value"` | Set one process environment entry; no `=`. Applied before shell startup regardless of its location. |
| `Type` | `Type[@duration] "text"` | Emit characters, waiting after each. Multiple consecutive string tokens are joined with one space; quote significant whitespace. Does not implicitly press Enter. |
| `Sleep` | `Sleep duration` | Wait for wall-clock time, capturing frames if visible. |
| `Wait` | `Wait[+Line\|+Screen][@duration] [/regex/]` | Poll for terminal text until match or timeout. Scope is one of Line or Screen, not both. |
| `Backspace`, `Delete`, `Insert` | `Key[@duration] [count]` | Press the named key; repeat defaults to one. |
| `Enter`, `Space`, `Tab`, `Escape` | `Key[@duration] [count]` | Press the named key. |
| `Up`, `Down`, `Left`, `Right` | `Key[@duration] [count]` | Arrow keys delivered to terminal/app. |
| `PageUp`, `PageDown` | `Key[@duration] [count]` | Page keys delivered to terminal/app; not the same as moving the terminal viewport. |
| `ScrollUp`, `ScrollDown` | `Key[@duration] [count]` | Move xterm's scrollback viewport one row per repetition; does not send arrow/page keys. |
| `Ctrl` | `Ctrl[+Alt][+Shift]+key[+key...]` | Hold control and optional modifiers while sending the selected key combination. |
| `Alt`, `Shift` | `Alt+key`, `Shift+key` | Hold that modifier and emit a string key argument, Enter, Tab, or brackets. |
| `Hide` | `Hide` | Pause frame capture; execution continues. |
| `Show` | `Show` | Resume frame capture. |
| `Source` | `Source "path.tape"` | Parse and inline another tape, removing its Output directives. |
| `Screenshot` | `Screenshot "path.png"` | Request a composed screenshot of the next captured frame. |
| `Copy` | `Copy "text"` | Write host clipboard text; consecutive strings are space-joined as with Type. |
| `Paste` | `Paste` | Read host clipboard and emit characters without TypingSpeed delays. It does not emulate a native bracketed-paste protocol. |

No standalone `Home`, `End`, `F1`–`F12`, `Cmd`, `Meta`, mouse clicks, drag, resize command, or arbitrary key-name API is implemented here. Recorder output can include unsupported Home/End tokens; repair and validate it. Modifier commands do not accept the repeat/`@duration` syntax of ordinary keys; repeat lines or add Sleep explicitly.

## Timing and synchronization

`Sleep`, per-command `@duration`, and `WaitTimeout` accept numbers with `ms`, `s`, or `m`; bare numbers mean seconds. Spaces between number and unit are accepted. Prefer explicit units: `Sleep 500ms`, `Sleep 1.5s`, `Wait@30s`. Composite durations such as `1m30s` are not tape syntax. `Set TypingSpeed` accepts `ms`, `s`, or a bare seconds value; use `60s` rather than a minutes unit for that setting.

```tape
Set TypingSpeed 50ms
Set WaitTimeout 20s
Set WaitPattern /^>\s*$/
Type@20ms "printf 'ready\n'"
Enter
Wait+Screen@5s /ready/
Wait+Line@5s /^>\s*$/
Sleep 1s
Down@100ms 3
```

The default typing delay is 50ms after each ordinary character/key. `@` overrides that one command; zero removes the deliberate delay. Use nonnegative delays and positive integer repeat counts. The parser accepts some invalid numeric values that fail only later; zero/negative counts do not provide useful key input.

`Wait` defaults to `Line`, a 15s timeout, and pattern `>$`. `Wait+Line` reads the current cursor line, right-trimmed, so the stock `> ` prompt becomes `>` and matches the default. Use `/^>\s*$/` to constrain the whole prompt line rather than matching any line ending in `>`. Do not require a trailing space with `/^> $/`, since the accessor trims it. Override the pattern in each Wait when waiting for application output instead of the prompt.

`Wait+Screen` joins the rows returned by the terminal buffer accessor. In this release that accessor reads indices zero through `term.rows-1` rather than offsetting by scrollback base: do not assume it searches all scrollback or always the visible screen after scrolling. Match the cursor line or clear the terminal before a screen wait when scrollback is involved.

Wait polls every 10ms and fails with a diagnostic containing the pattern and last observed text when the timeout expires. Regex syntax is Go's `regexp` syntax, without lookaround/backreferences or JavaScript suffix flags. Use inline flags such as `(?m)` for line anchors within a joined screen. Delimit patterns with `/`; use `\/` for a slash inside the pattern. Do not add JS-style `/i`.

Never use `/ready/` if the shell command itself contains `ready` and will already be present on the screen. Match a whole output line (`/(?m)^ready$/`), a unique result, or the returned prompt. Likewise an old prompt can still satisfy a wait if the command has not yet run; follow Enter with a result condition when correctness depends on command completion.

## Key combinations

`Ctrl` supports single-character arguments plus `Enter`, `Space`, `Backspace`, arrow names, and punctuation `-`, `@`, `[`, `]`, `^`, `\`. Optional `Alt`/`Shift` modifiers must precede nonmodifier keys. `Ctrl+C`, `Ctrl+L`, and `Ctrl+Shift+P` are valid forms; `Ctrl+Tab` and `Ctrl+Escape` are not accepted forms in this parser. Do not infer that a valid browser key chord has a useful effect in every terminal application.

Standalone `Alt`/`Shift` accept string arguments, Enter, Tab, or square brackets; they do not accept arbitrary named arrow keys. Use `Ctrl+Shift+Left` only where the application supports it, not `Shift+Left`. For line navigation in compatible shells use `Ctrl+A`/`Ctrl+E`. Plain `Type "ABC"` already sends uppercase characters; Shift need not be added.

```tape
Type "draft"
Backspace@80ms 5
Type "replacement"
Ctrl+A
Ctrl+E
Ctrl+U
Shift+Tab
Alt+b
Escape
```

## Outputs and captures

| Selection | Actual behavior |
| --- | --- |
| `Output demo.gif` | GIF slot; FFmpeg palette limited to 256 colors. |
| `Output demo.mp4` | MP4 slot; H.264/libx264, yuv420p, CRF 20, no audio. |
| `Output demo.webm` | WebM slot; yuv420p, CRF 30, bitrate zero, no audio; codec selection is left to FFmpeg. |
| `Output demo.txt`, `.ascii`, or `.test` | One textual snapshot slot. Dumps terminal rows after each executed command while recording, with separators; not a byte-exact shell stdout log or automatic assertion. |
| `Output frames/` | Raw capture directory. Trailing slash is required for an extensionless destination. Contains separate `frame-text-00001.png` and `frame-cursor-00001.png` sequences, not decorated final frames. |
| `Output image.png` | Also selects raw-frame destination; avoid this misleading form and use an extensionless directory ending in `/`. |
| `Screenshot image.png` | One composed still, including cursor and appearance settings; only lowercase `.png` accepted. |

Use multiple `Output` directives for different formats. Only one destination per format/text/frame slot is retained; the last selection wins. There is no default GIF output and no default text output in normal rendering; specify what must be written. Unknown suffixes fall into the GIF slot but still reach FFmpeg by their filename; use only the listed suffixes.

Screenshot requests are asynchronous: only one pending path exists, and repeating a path replaces its stored frame. Add visible `Sleep 200ms` after each request, use distinct filenames, and create parent directories beforehand. A request while hidden cannot capture until Show; successive requests without time to capture can replace each other.

Media output parents are created by the renderer. Screenshot output parents are not created by its encoding path. FFmpeg overwrites outputs; preserve an existing result separately if comparison is required. Do not combine screenshot capture with nonzero LoopOffset without checking the result: rotation renames raw frame files after screenshots have recorded their frame indices.

## Includes and environment

`Source "config.tape"` resolves against VHS's current working directory, including when called from a tape in a subdirectory. It requires a readable, nonempty `.tape`. Included Output directives are stripped, while settings and interaction are expanded at the inclusion position. Put settings-only includes in the initial block. Avoid nested/cyclic includes; the implementation's recursive parser does not reliably enforce the documented nesting restriction.

Use Env after the initial settings block:

```tape
Output demo.gif
Require bash
Set Shell "bash"
Set Width 1000
Set Height 500
Set WaitPattern /^>\s*$/
Env LANG "C.UTF-8"
Env DEMO_MODE "1"
Hide
Type "cd fixtures"
Enter
Wait
Ctrl+L
Sleep 200ms
Show
Type "printf '%s\n' $DEMO_MODE"
Enter
Wait
Sleep 1s
```

Choose an installed locale; locale names vary by platform. Env changes affect VHS and inherited child environments, including PATH. For a variable that must change midway through an existing shell session, type that shell's native assignment/export command rather than placing another Env directive later. For custom prompts set an appropriate WaitPattern; shell-supplied prompt defaults can interact with inherited prompt variables, so inspect the rendered prompt.
