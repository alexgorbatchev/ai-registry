# Visual QA of screenshots

- [Captures](#captures)
- [Whole-frame checklist](#whole-frame-checklist)
- [Measuring](#measuring)
- [What to do with a defect](#what-to-do-with-a-defect)
- [Fresh-eyes chrome review](#fresh-eyes-chrome-review)

Apply this to every screenshot any phase captures (review evidence, implementation before and after pairs, Phase 9 page captures) and to every unit screenshot the orchestrator reviews. A review that looks only at the states a ticket or finding changed misses defects in the persistent chrome (headers, navigation, side panels, toolbars, dialog frames): chrome appears in every frame, so it stops being seen, and borderless buttons, misaligned header rows and near-invisible dark-theme borders survive dozens of reviewed changes.

## Captures

- Capture each affected screen at 320, 390 and 1440 CSS px wide, in the light and the dark theme. Phase 2 finding evidence keeps its own viewports ([review](review.md#screenshots)); this matrix is the QA pass over each screen the unit touched.
- Hide development overlays (dev-server toolbars, debug badges) before capturing; they are not product UI.
- Open every image before relying on it. A saved file or a passing check is not an inspected screenshot.

## Whole-frame checklist

Check the whole image, not only the changed region, against each item:

1. **Affordance:** every control reads as a control (a border, a fill or a conventional icon distinguishes it from text); nothing inert looks clickable.
2. **Alignment:** controls on one row share a centre line; stacked items share a left edge.
3. **Consistent sizing:** sibling controls of one kind share a height; stacked buttons share a width unless the difference carries meaning.
4. **Wasted space:** empty bands, oversized padding, or content squeezed while space next to it sits idle.
5. **Clipping and overlap:** cut-off or overlapping text, controls pushed off screen, horizontal scrolling of the page.
6. **Wording:** text that names a control uses the control's exact label.
7. **Contrast:** text at 4.5:1 (3:1 for large text), and control boundaries and focus indicators at 3:1 against what surrounds them. Measure instead of judging by eye: dark-theme borders that look acceptable can measure 1.2:1 while all text passes.

## Measuring

Run [audit-screen.ts](../scripts/audit-screen.ts) on each captured screen at each width and theme, either on the unit's open browser session or on a URL:

```bash
bun <skill>/scripts/audit-screen.ts --session <unit-session> --viewport 390x844 --color-scheme dark --ignore '<overlay selector>'
```

It reports JSON and exits 1 when it finds text or control-boundary contrast failures, horizontal overflow, touch targets under 24 px without the spacing exception, or sibling controls whose heights, centres, left edges or widths differ by more than `--tolerance` px (default 1). Confirm each reported item on the screenshot before acting; the selectors locate it. `unboundedActions` (buttons with no distinct border or fill) and `unresolved` (text over images or gradients) are not failures: check them against checklist items 1 and 7 by eye. `--session` leaves that session open with the viewport and color scheme the audit set; `--url` uses and closes its own session. The script needs `agent-browser`; for another platform, apply the checklist by eye and record that the measurement did not run.

## What to do with a defect

- **Inside the change** (the unit's ticket, the reviewed area, the flow being redesigned): fix it in the same unit and recapture.
- **Outside it:** in Phase 2, record it as a finding of the unit that saw it ([Dedupe](review.md#dedupe) merges repeats); in other phases, file it through `issue-tracker` with the screenshot and the audit output, and list it in the unit's return. Never leave it only in a report or a checkpoint.

## Fresh-eyes chrome review

Run a dedicated review of the shell chrome by a reviewer given no ticket, finding or change context: the app URL (or its screens), the capture matrix, this checklist and audit-screen. Context anchors a reviewer on the change; this reviewer looks only at what stays on screen. Run it once in Phase 2 as its own unit (`review-chrome`) and, during implementation, after every deploy wave and before the run reports complete. File what it finds as above.
