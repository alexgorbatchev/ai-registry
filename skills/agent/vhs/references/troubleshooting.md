# Troubleshooting

| Symptom | Verified cause / diagnostic and correction |
| --- | --- |
| Validate exits zero but no file was checked | v0.12.1 skips file read failures. Check every input with `test -r`, expand globs in the shell, and confirm at least one matched file. |
| Validation passes but rendering fails | Parser validation does not execute settings, requirements, waits, app commands, or encoders. Capture stdout/stderr from a real render; fix the reported runtime condition. |
| Unknown command/setting | Names are case-sensitive. Consult the complete tables. Avoid Home/End, arbitrary mouse/function-key commands, or imagined Set options. |
| Quoted command breaks around embedded quotes | VHS strings have no backslash delimiter escaping. Use a different outer delimiter or separate Type directives. Do not put multiline shell text in one tape string. |
| Settings warn that they were ignored | A command outside Set/Output/Require ended the initial block. Move settings above Env/Hide/Type/Wait. Only TypingSpeed can change later. |
| First frame still shows hidden setup | Browser redraw after Ctrl+L can lag behind the input event. Leave a short redraw interval under Hide before Show, then inspect the first frame to confirm the old text is gone. |
| Env appears to take effect too early | Env is preprocessed throughout the expanded tape before starting the shell. For runtime variable changes use the selected shell's native assignment command. |
| Selected shell is ignored or unavailable | Choose a supported Set Shell name, install its executable, and verify platform dependencies. Record's `--shell` default differs from rendering's default. |
| App command is not found | Alias/function/init setup is absent, PATH differs, or host binary is incompatible with container. Install/build a compatible executable or load the required setup explicitly. |
| Missing ttyd/FFmpeg or outdated ttyd | Confirm PATH and ttyd >=1.7.2. Install actual required dependencies before retrying. |
| Browser startup fails, hangs, or cannot download | Check browser availability, network access for fallback download, writable temp storage, and v0.12.1 startup diagnostics. This release polls the DevTools endpoint with a bounded startup timeout. Do not invent browser flags; inspect pinned go-rod behavior for custom configuration. |
| Browser sandbox fails in a container | Check the actual sandbox error and execution environment. A nonempty VHS_NO_SANDBOX disables the browser sandbox, including value `0`; use only when required and keep shell isolation separate. |
| Wait immediately succeeds before result | Regex matched echoed command or stale buffer content. Use an anchored unique output line, clear state, or a verified current-line prompt condition after the observed result. |
| Wait times out on prompt | Compare the last observed line in the timeout message. CurrentLine trims trailing spaces; use `/^>\s*$/` for the stock prompt or the exact observed custom prompt. Check the command/TUI actually returned control. |
| Screen wait sees old data after scrollback | Buffer reads initial row indices in this version, not all scrollback. Keep the state within initial rows, clear/reset, or use a current-line condition that actually identifies completion. |
| Text wraps or grid dimensions differ | Fonts, spacing, padding, margin, and bar consume space. Install the chosen font; use Columns/Rows for fixed grids, or increase pixel content area. Do not combine Width/Columns or Height/Rows. |
| Colors/glyphs differ in CI | Different font or app truecolor palette, missing glyph coverage, or locale. Provision fonts and stable fixtures; inspect actual rendered text. |
| FFmpeg palette/filter/encoder failure | Inspect stderr. Confirm positive content dimensions and framerate, supported filters/encoders, and a stable initial configuration. Media geometry cannot be changed during the tape. |
| MP4 fails on dimensions | yuv420p requires even dimensions. Choose even pixel Width/Height or let Columns/Rows derive even dimensions. |
| No video output created | No Output video slot was selected. There is no automatic demo.gif path for arbitrary tapes. Add a known format or pass a recognized `-o` path. |
| More files appear despite `--output` | Flag updates specified media slots without clearing other tape outputs. Inspect the tape's full output declarations. |
| `Output image.png` creates unexpected files | PNG Output selects a raw-frame destination. Use Screenshot for a single composed still and Output frames/ for raw layers. |
| Screenshot is absent or wrong | Capture is queued for the next visible frame. Create parent directories, Show before requesting, leave a visible hold, use distinct paths, and avoid LoopOffset. |
| Raw frame destination is absent | Export uses a rename whose failure is ignored in teardown. Use an absent same-filesystem directory and check its contents after rendering; do not treat exit zero as proof of export. |
| Golden output differs or lacks late output | Snapshots are taken after commands, not continuously. Wait for observed output, pin fixtures/geometry, keep scrollback behavior in mind, and compare separate actual/baseline files. |
| Rendering passes despite command failure | VHS does not assert shell exit status. Inspect app results and use external exit-status assertions or an observed success condition. |
| Clipboard fails headlessly | Copy/Paste depend on the host clipboard service. Provision that service for an actual clipboard task; otherwise write deterministic input with Type. |
| Recording emits unsupported tokens or excessive sleeps | Recorder translates input with limited escape handling and approximate idle pauses. Edit generated tape, repair unsupported navigation, add outputs/settings/Wait, then validate and render. |
| Source fails or recurses | Include paths are relative to process cwd, must have `.tape` suffix, and must be nonempty. Remove nesting/cycles before parsing; do not rely on the nesting detector. |
| GIF preview starts on an unwanted frame | Measure a percentage for LoopOffset; it is not a frame count. For screenshots use a separate nonrotated tape. |
| Long-running work is cut off | Teardown kills the shell/ttyd at tape completion. Wait for completion and then add deliberate reading time before ending. |
| Publish fails | Requires a GIF, external SSH connectivity, local key/data storage, and accepted host identity. Capture errors; do not bypass host-key checks. |
| SSH output is corrupt | PTY is unsupported; use `ssh -T`, preserve stderr separately, match extension to selected media, and check exit status and file signature. |

When a symptom is not covered, retain a minimal reproducing tape with real inputs, collect VHS/dependency versions and both output streams, inspect the pinned source area listed in sources.md, and test one cause at a time. Do not alter an unrelated application or silently downgrade required behavior to make recording appear successful.
