# Authoring and verification workflows

## Contents

- [Deterministic CLI demo](#deterministic-cli-demo)
- [Interactive application](#interactive-application)
- [Screenshots and raw frames](#screenshots-and-raw-frames)
- [Golden integration tests](#golden-integration-tests)
- [CI](#ci)
- [Visual verification and delivery](#visual-verification-and-delivery)
- [Publication](#publication)

## Deterministic CLI demo

Start from `assets/demo.tape`, read relative to the skill folder. It uses only Bash built-ins, fixed data, pixel dimensions, multiple output formats, one screenshot, and a terminal text snapshot. Copy it to a writable scratch directory and run from there.

```sh
test -r demo.tape && vhs validate demo.tape
vhs demo.tape
```

For an actual target, build/install it first, add `Require target-program`, and verify its documented arguments manually. Prefer fixture files to network-dependent live data. Set the shell explicitly, use an installed font, choose stable terminal geometry, and define the readiness regex from observed output. Keep setup under Hide and ensure Show occurs before the main demonstration.

Do not assume aliases/functions from interactive dotfiles exist: VHS shells intentionally suppress much of that setup. Use a real executable on PATH or load the needed project environment explicitly.

Use `Sleep` after command completion to make results readable. For a loop, rotate the video with a measured LoopOffset when needed, or clear/reset to a deliberate final state. LoopOffset rotates every video format's sequence; it does not create seamless app state transitions by itself. Reduce dimensions/framerate or increase PlaybackSpeed only after confirming readability and interaction timing.

## Interactive application

Use a target-specific sequence after inspecting its actual key bindings and prompts. This fragment illustrates the structure; replace command, regex, selection, and quit key with observed application behavior before running:

```tape
Type "target-program --interactive"
Enter
Wait+Screen@10s /Choose an item/
Down@150ms 2
Enter
Wait+Screen@10s /Selection accepted/
Sleep 1s
Type "q"
Wait+Line@10s /^>\s*$/
```

For a full-screen app, wait for a distinct initialized panel or label, not a shell prompt that is no longer displayed. Prefer matched app output over fixed startup sleeps. Arrow/Page keys drive the app; ScrollUp/ScrollDown move the browser terminal viewport. Leave a visible hold before quitting if the selected screen is the important result. Confirm the app exits and background work completes before the tape ends, as teardown kills its shell/terminal.

Use `Copy`/`Paste` only when the task explicitly involves clipboard behavior and the environment has a clipboard service. Their host clipboard effects and character-based paste behavior make them unsuitable as a substitute for testing native paste handling.

## Screenshots and raw frames

Start from `assets/screenshot.tape`. It has no media Output, waits for a fixed output line, requests a PNG, and leaves a visible capture interval. Run from a writable directory; it writes `screenshot.png` there.

For multiple captures, create their parent directory before VHS starts, request distinct paths after app readiness, and leave time between requests:

```tape
Wait+Screen /(?m)^Finished$/
Sleep 200ms
Screenshot "artifacts/finished.png"
Sleep 200ms
```

Use `Set CursorBlink false` for stills. Avoid LoopOffset in the same screenshot tape. For raw captures use `Output frames/` with a previously absent destination on the same filesystem as capture temporaries. Check both layer sequences exist; they require composition to reproduce a decorated frame. Do not rename a raw text layer and present it as the final screenshot.

## Golden integration tests

`Output artifacts/actual.ascii` selects terminal snapshot output. VHS writes the buffer after each command executed while visible, including separators and blank rows. This verifies terminal states, not process exit status, exact stdout bytes, hidden setup, colors, or a pixel image. It does not compare a baseline automatically.

1. Select stable shell, locale, font, dimensions, fixtures, command sequence, and waits.
2. Observe the application's correct output and approve the baseline from that successful run.
3. Render into a separate actual file; preserve the expected file.
4. Compare with `diff -u` or the project's existing assertion tool. Fail CI on a difference.
5. Change a meaningful application behavior or expected result and confirm the comparison fails; restore and confirm it passes.

```sh
test -r test.tape && vhs validate test.tape
vhs test.tape
diff -u fixtures/expected.ascii artifacts/actual.ascii
```

Use Wait immediately after asynchronous command output; otherwise the snapshot at Enter may be captured before output arrives. Stabilize timestamps, random values, terminal size, user paths, and network input at the fixture/application level. Do not erase a substantive regression by normalizing it away or regenerating the expected file on every test run. Use a real process-exit assertion outside VHS when exit status is the contract.

Run separate VHS processes for separate golden outputs. The implementation's snapshot writer is process-global; embedding multiple evaluations in one process is not equivalent to fresh CLI executions. After extensive scrollback, the buffer accessor may read initial buffer rows rather than the current viewport; clear/reset or choose a test that keeps the relevant state within the captured buffer.

## CI

Use the project's CI to install/build the actual application, provide fixtures and fonts, validate tapes, render, compare any golden output, and upload generated media as artifacts. Treat an asset-only update and a baseline change as reviewable changes. Avoid unattended external publication and automatic commits unless requested.

The official [VHS Action](https://github.com/charmbracelet/vhs-action) declares inputs `version` (default `latest`), `path` (default empty), `token` (default GitHub token), and `install-fonts` (default string `false`). Pin the action to a verified commit under the project's dependency policy and set the VHS version explicitly. The relevant step, inside an existing workflow after checkout/build/setup, is:

```yaml
- name: Render terminal demo
  uses: charmbracelet/vhs-action@main
  with:
    version: v0.12.1
    path: demos/demo.tape
    install-fonts: 'true'
```

`@main` is a discovery/example ref, not a reproducible pin: resolve the actual upstream commit and replace it before adopting this step. Do not invent a commit hash. `install-fonts` does not guarantee an arbitrary requested font; inspect the action's current install implementation and explicitly provision missing fonts. Confirm its runner/platform contract before choosing a CI host. No publishing flag is needed to render locally in CI.

An installed VHS CLI can also be used directly in CI; that gives the same validation, render, and golden comparison commands used locally. Install dependencies before invoking it, and preserve stderr in failure logs. Check outputs even when command exit status is zero.

## Visual verification and delivery

Inspect media metadata and representative frames with the available media/image viewer. FFprobe and FFmpeg examples:

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size -of json artifacts/demo.mp4
ffmpeg -y -i artifacts/demo.gif -frames:v 1 artifacts/first.png
ffmpeg -y -sseof -0.1 -i artifacts/demo.mp4 -frames:v 1 artifacts/last.png
```

Choose intermediate timestamps from the actual media duration; use `-ss` to extract a known important state. Check dimensions, clipped lines, glyph coverage, contrast, cursor, setup visibility, command correctness, readiness, and final hold. An artifact's existence or size alone does not prove its content is correct. If rendering or viewing is unavailable, report that exact limitation and deliver the authored tape as unverified.

Deliver relative tape/output paths, dependencies/version, execution directory, validation/render results, golden comparison result when applicable, and any known cross-platform requirements. For embedding, provide descriptive alt text for GIF/PNG, or a video element for MP4/WebM under the destination's documented support. Do not upload merely to obtain an embedding URL.

## Publication

After authorization to upload the actual GIF:

```sh
vhs publish artifacts/demo.gif
# Or render and upload in one operation:
vhs demo.tape --publish
```

Check the returned URL, and make clear the file was transmitted to the upstream hosting service. Publishing uses SSH over port 22 and can fail on restricted networks or host-key changes. Do not disable host-key validation to conceal that failure. Publishing supports GIF; use an authorized hosting destination for other formats.
