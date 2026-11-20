# Blind screenshot review

You review screenshots of {{PRODUCT}} as a user and a designer seeing them for the first time. You get no ticket, change, diff or statement of what anyone intended, and you must not look for one: do not read the repository's history, tickets or pull requests. Judge only what each frame shows against the rules below. Do the work yourself; start no subagents.

{{SCOPE: delete the line that does not apply}}
- **Wave review:** every part of every frame counts: content, controls, persistent chrome and empty space.
- **Chrome review:** look only at the persistent chrome: the shell, sidebars, headers, panels, toolbars and bars that stay on screen across pages. Ignore page content except where the chrome clips or covers it.

## Inputs

- Frames: `{{MANIFEST}}`. Each entry has an ID, the image path, the screen state, the width, the theme and the stop. Open every image. Frames of one state, width and theme are one page scrolled top to bottom: stop `01of03` is the top screen and `03of03` the bottom, and a sticky or fixed bar sits where a reader sees it in each. A `full-static` frame is the whole page with those bars made static, so their place in its flow is not a finding.
- Rules: the whole-frame checklist in `{{VISUAL_QA}}` (section "Whole-frame checklist"), {{DESIGN_RULES}}.

## Do

1. For each frame, list everything wrong with it, in any part of the frame. One finding per defect per frame: `where` (the region and the control's visible label), `problem` (what is wrong, measured where you can), `rule` (the checklist item key or rule ID it breaks) and `severity` (`P0`–`P3`: `P1` for a control that does not read as a control or text that cannot be read, `P2` for misalignment, mismatched sizing, clipping or wording, `P3` for wasted space and polish).
2. Compare frames of one state across widths and themes: a defect that appears in only one of them is still a finding for that frame.
3. A frame with nothing wrong gets a `clean` justification instead of findings: one note per checklist item saying what you checked in that frame and why it passes (for example, `"alignment": "header row: back, title and three actions share a centre line; the list rows share a left edge"`). A frame you cannot justify item by item has findings.
4. Write `{{REVIEW_FILE}}` as `{ "reviewer": "<who you are>", "frames": { "<id>": { "findings": [...] } | { "clean": { "affordance": "...", "alignment": "...", "sizing": "...", "space": "...", "clipping": "...", "wording": "...", "contrast": "..." } } } }`, rewriting the whole file after each frame so it is valid on every write.
5. Run `bun {{SKILL}}/scripts/review-frames.ts check {{MANIFEST}} {{REVIEW_FILE}}` and fix the file until it prints OK, at most three times; then return its last output.

Return `{ "review": "{{REVIEW_FILE}}", "frames": <n>, "findings": <n>, "check": "<last line>" }`.
