# Visual QA of screenshots

- [Captures](#captures)
- [Whole-frame checklist](#whole-frame-checklist)
- [Measuring](#measuring)
- [Blind review](#blind-review)
- [Chrome review](#chrome-review)
- [What to do with a defect](#what-to-do-with-a-defect)

Apply this to every app screenshot an implementation run captures, and to the screenshots of a UX review that sends its readers here. `programming`'s UI evidence workflow requires that screenshots are accepted only through a blind review and that nobody signs off their own; this file says how that review runs in a wave. A review that looks at screenshots through a ticket's lens judges only the changed state and treats chrome that appears in every frame as background: borderless buttons, misaligned header rows and near-invisible dark-theme borders survive dozens of reviewed changes that way.

## Captures

- Capture each affected screen at 320×640, 390×844 and 1440×900 CSS px, in the light and the dark theme. Name each file `<state>-<phase>-<width>-<theme>.png`, where `<state>` is a lowercase hyphenated slug for the screen state and `<phase>` is `before` or `after`. [audit-screen.ts](../scripts/audit-screen.ts) with `--shots` captures, names and audits the whole matrix in one command (see **Measuring**).
- Hide development overlays (dev-server toolbars, debug badges) before capturing; `--ignore` hides them in the screenshots and leaves them out of the audit.
- After rebuilding or restarting the app, close the browser session and open a fresh one before capturing: a session that lived through the rebuild can keep serving stale dev-server modules across reloads, so the frames show the old build.
- Open every image before relying on it. A saved file or a passing check is not an inspected screenshot.

## Whole-frame checklist

Check the whole image, not only a changed region. The bold keys are what blind reviews cite and justify:

1. **affordance:** every control reads as a control (a border, a fill or a conventional icon distinguishes it from text); nothing inert looks clickable.
2. **alignment:** controls on one row share a centre line; stacked items share a left edge.
3. **sizing:** sibling controls of one kind share a height; stacked buttons share a width unless the difference carries meaning.
4. **space:** no empty bands, oversized padding, or content squeezed while space next to it sits idle.
5. **clipping:** no cut-off or overlapping text, no controls pushed off screen, no horizontal scrolling of the page.
6. **wording:** text that names a control uses the control's exact label; nothing is said twice in one view.
7. **contrast:** text at 4.5:1 (3:1 for large text), and control boundaries and focus indicators at 3:1 against what surrounds them. Measure instead of judging by eye: dark-theme borders that look acceptable can measure 1.2:1 while all text passes.

## Measuring

Run audit-screen on every captured state, on the unit's open browser session or on a URL. Without `--viewport` it covers the whole matrix in both themes:

```bash
bun <skill>/scripts/audit-screen.ts --session <session> --shots <shots-dir> --state <state> --phase after --ignore '<overlay selector>'
```

Before measuring each cell it waits until no finite animation or transition is running, so a color scheme switch is not measured mid-transition. It prints `{ failing, screens: [...] }`, one report per cell, and exits 1 when any cell has text or control-boundary contrast failures, a text-only button with no border or fill distinct from its surroundings (`borderlessText`), horizontal overflow, touch targets under 24 px without the spacing exception, or sibling controls whose heights, centres, left edges or widths differ by more than `--tolerance` px (default 1). Confirm each reported item on the screenshot; the selectors locate it. Two lists are not failures: `borderlessIcon` (borderless buttons that draw an icon; check the icon is a conventional one, checklist item 1) and `unresolved` (text over images or gradients; check item 7 by eye). `--session` leaves that session at the last viewport and color scheme it audited; `--url` uses and closes its own session. The script needs `agent-browser`; on another platform, capture with the platform's tools under the same names, apply the checklist by eye, and record that the measurement did not run. The blind review still runs.

## Blind review

The orchestrator owns it. Run one for every wave's after frames, and in a UX review for every review unit's frames:

1. **Manifest.** `bun <skill>/scripts/review-frames.ts manifest --out <reviews>/wave-<n>.manifest.json <shots-dir>...` over the wave's unit shot directories. It lists the after frames only, under neutral IDs, because a before and after pair tells the reviewer what changed. A missing matrix cell exits 1: send the unit back to capture it before the review starts.
2. **Reviewer.** Start one independent reviewer per manifest: a fresh agent, or a fresh session, that has not seen the tickets, diffs, unit returns or proposals. Never the implementing unit or the orchestrator. Brief it from [the blind review brief](../assets/blind-review.md) with wave scope, giving it the manifest, this file's checklist, the pattern reference and the config's `design.rules`, and nothing about intent. It lists everything wrong in each frame and justifies each frame it passes with a note per checklist item; it runs `review-frames.ts check` until it prints OK. When no independent reviewer can run, the wave is not accepted: report the blocker and keep the tickets open.
3. **Triage.** Rerun `review-frames.ts check <manifest> <review>` yourself, then give every finding a `disposition` and `ref` in the review file: `fixed` with the fixing revision when it lies inside a ticket's change (send it back to that unit, or to a fix unit, and recapture); `ticket` with the number of the ticket you file for it now, in the run's epic, with the frame and the audit output, when it lies outside every change; `duplicate` with the existing ticket it repeats, after adding the frame to that ticket; `rejected` with the reason, quoting the settled rule it contradicts. Nothing is dismissed because it is outside the change.
4. **Gate.** `review-frames.ts check <manifest> <review> --triaged` must print OK. Frames recaptured after a fix go through a follow-up blind review of just those frames, under a new manifest and a fresh reviewer. A ticket is accepted when its frames' findings are all dispositioned and every finding inside its change is fixed and re-reviewed clean.

Keep the manifests and reviews under `<state>/implementation/reviews/` and log each gate's result in the run log.

## Chrome review

The persistent chrome (shell, sidebars, headers, panels, toolbars, bars) gets its own blind review every wave, against the design rules, because it appears in every frame and no ticket owns it. The orchestrator runs it after the wave deploys, before the next wave starts:

1. Capture each screen in the config's `qa.screens` from production (from the wave's build when the project does not deploy): `bun <skill>/scripts/audit-screen.ts --url <app-url><path> --shots <local>/shots/wave-<n>-chrome --state <screen-name>`. When production sits behind authentication (the config's `deploy.access`), open the screen in an authenticated browser session first and pass `--session <name>` instead of `--url`.
2. Build its manifest and brief a fresh reviewer with chrome scope, as in **Blind review**.
3. Triage the same way. File every chrome defect before the next wave's units start, so they include those tickets.

## What to do with a defect

- **Inside the change** (the unit's ticket, the reviewed area, the flow being redesigned): fix it in the same unit and recapture.
- **Outside it:** file it through `issue-tracker` in the same wave, with the screenshot and the audit output, and list it in the unit's return or the review's triage. In a UX review whose findings are its product, record it as a finding of the unit that saw it instead. Never leave it only in a report or a checkpoint.
