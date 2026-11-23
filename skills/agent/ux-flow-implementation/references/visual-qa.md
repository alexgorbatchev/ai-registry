# Visual QA of screenshots

- [Captures](#captures)
- [Whole-frame checklist](#whole-frame-checklist)
- [Measuring](#measuring)
- [Blind review](#blind-review)
- [Chrome review](#chrome-review)
- [What to do with a defect](#what-to-do-with-a-defect)

Apply this to every app screenshot an implementation run captures, and to the screenshots of a UX review that sends its readers here. `programming`'s UI evidence workflow requires that screenshots are accepted only through a blind review and that nobody signs off their own; this file says how that review runs in a wave. A review that looks at screenshots through a ticket's lens judges only the changed state and treats chrome that appears in every frame as background: borderless buttons, misaligned header rows and near-invisible dark-theme borders survive dozens of reviewed changes that way. A review that checks only conformance to the design rules fails the other way: when the specified design is wrong, every frame conforms and the defect passes.

## Captures

- Capture each affected screen at 320×640, 390×844 and 1440×900 CSS px, in the light and the dark theme. [audit-screen.ts](../scripts/audit-screen.ts) with `--shots` captures, names and audits the whole matrix in one command (see **Measuring**).
- Capture each cell as viewport-sized frames at scroll stops: the top, one per screenful, and the bottom. Each step advances by the height left visible between bars stuck to the top and bottom edges, so content a bar covers in one frame shows uncovered in the next. Never use a full-page screenshot of the live page as evidence: it paints sticky and fixed elements (headers, hand-back bars) at their first-viewport position, over unrelated content halfway down a tall page. Name each frame `<state>-<phase>-<width>-<theme>-<NN>of<NN>.png`, where `<state>` is a lowercase hyphenated slug for the screen state, `<phase>` is `before` or `after`, and `01of03` is the first of three stops from the top.
- Take the stops on whatever scrolls the content. In an app shell whose page column scrolls inside its own container while the document stays still, the stops belong to that container, and the bars stuck to its edges set the step. audit-screen scrolls the nearest scrolling ancestor of `--content` (else `main`) even when the document also scrolls. When the document does not scroll, it scrolls the widest scrolling element taller than half the viewport, inside the content when there is one, else anywhere on the page, so a side panel loses to the page's column. Otherwise it scrolls the document. Each report's `frames.scroller` names what it scrolled. A cell with a single `01of01` frame on a screen longer than the window means the stops missed the content's scroller: pass `--content` for the scrolling column and capture again.
- Add a full-page image only when a reader needs the whole layout at once, and take it with sticky and fixed elements made static so they sit at their place in the flow; name it `<state>-<phase>-<width>-<theme>-full-static.png`. `--full-page` does this, and saves none for content that scrolls inside a container, which a full-page image cannot show past its first screen. It supplements the viewport frames, which remain the evidence of what a reader sees.
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

Items 8–10 judge the design itself. Each applies even when the design rules require what it finds, and every frame accounts for each of them, with a finding or a note, including frames whose other findings fail them:

8. **redundancy:** no two visible controls reach the same outcome, such as separate whole-item, picker and region buttons beside an inline select-and-act path that already does the job.
9. **density:** the measured whitespace fits its content: the height from the top of the window to the first actionable content, the content column's share of the viewport, and each gutter and margin. A reserved gutter or margin wider than its content needs is a finding: a badge column several times the badge's width, or a narrow centred column with empty bands on both sides. Cite the numbers.
10. **hidden:** primary content (replies, answers, history) shows without expanding anything. A disclosure is a finding unless what it hides is secondary and long.

**Rule challenges.** When a finding exists because the screen follows a design rule, it names that rule and proposes the change to it (`challenge` in the review file), and triage routes it to the rule's owner. Conforming screens keep the defect until the rule changes.

Worked example: a document page with a comment panel passed a blind review on contrast, sibling heights and clipping, all of which measured clean. The owner then found three design defects the design rules themselves specified: the panel offered three buttons that all start a comment (whole page, a target picker, a region selector) beside an inline select-and-comment path that already covers text; comment replies sat behind a collapsed "1 reply" row; and the page wasted space, with a loose vertical rhythm, a narrow centred column, and a wide gutter reserved for a small comment-count badge between the content and the panel. Items 8–10 make each of these a finding, the density measurements make the wasted space visible, and each finding challenges the rule that required it.

## Measuring

Run audit-screen on every captured state, on the unit's open browser session or on a URL. Without `--viewport` it covers the whole matrix in both themes:

```bash
bun <skill>/scripts/audit-screen.ts --session <session> --shots <shots-dir> --state <state> --phase after --ignore '<overlay selector>' > <shots-dir>/<state>-after-audit.json
```

Keep that output beside the frames: the blind reviewer reads its density measurements.

Before measuring each cell or saving a frame it waits until the page has held still in the requested color scheme for 200 ms: the media query matches, no finite animation or transition runs, and the root's and body's colors and theme attributes stay unchanged. Apps that set their theme from script switch after the browser does, so a cell is never measured in the other theme or mid-transition. It prints `{ failing, screens: [...] }`, one report per cell, and exits 1 when any cell has text or control-boundary contrast failures, a text-only button with no border or fill distinct from its surroundings (`borderlessText`), horizontal overflow, touch targets under 24 px without the spacing exception, or sibling controls whose heights, centres, left edges or widths differ by more than `--tolerance` px (default 1). Confirm each reported item on the screenshot; the selectors locate it. Three lists are not failures: `borderlessIcon` (borderless buttons that draw an icon; check the icon is a conventional one, checklist item 1), `unresolved` (text over images or gradients; check item 7 by eye) and `wideGaps` (margins and gutters wider than `--gap-limit` px, default 32; check item 9). Each report's `density` block measures the content area, the element `--content` selects, else the visible `main`, else the body without its header, navigation, aside and footer landmarks: `firstContent.top` (CSS px from the top of the page to its first control or heading), `column` (its occupied extent and `share` of the viewport width), `columns` (the occupied bands between empty ones) and `gaps` (every margin and gutter, with its width). Fixed elements are left out, because they float over the layout instead of taking space in it. Pass `--content` when the app has no `main` landmark or puts persistent chrome inside it. `--session` leaves that session at the last viewport and color scheme it audited; `--url` uses and closes its own session. The script needs `agent-browser`; on another platform, capture with the platform's tools under the same names, apply the checklist by eye, and record that the measurement did not run. The blind review still runs.

## Blind review

The orchestrator owns it. Run one for every wave's after frames, and in a UX review for every review unit's frames:

1. **Manifest.** `bun <skill>/scripts/review-frames.ts manifest --out <reviews>/wave-<n>.manifest.json <shots-dir>...` over the wave's unit shot directories. It lists the after frames only, under neutral IDs, because a before and after pair tells the reviewer what changed. A missing matrix cell exits 1: send the unit back to capture it before the review starts.
2. **Reviewer.** Start one independent reviewer per manifest: a fresh agent, or a fresh session, that has not seen the tickets, diffs, unit returns or proposals. Never the implementing unit or the orchestrator. Brief it from [the blind review brief](../assets/blind-review.md) with wave scope, giving it the manifest, the units' `-after-audit.json` files (never the before ones), this file's checklist, the pattern reference and the config's `design.rules`, and nothing about intent. It lists everything wrong in each frame, accounts for items 8–10 in every frame, challenges the rules behind design findings, and justifies each frame it passes with a note per checklist item; it runs `review-frames.ts check` until it prints OK. When no independent reviewer can run, the wave is not accepted: report the blocker and keep the tickets open.
3. **Triage.** Rerun `review-frames.ts check <manifest> <review>` yourself, then give every finding a `disposition` and `ref` in the review file: `fixed` with the fixing revision when it lies inside a ticket's change (send it back to that unit, or to a fix unit, and recapture); `ticket` with the number of the ticket you file for it now, in the run's epic, with the frame and the audit output, when it lies outside every change; `duplicate` with the existing ticket it repeats, after adding the frame to that ticket; `rejected` with the reason, quoting the settled rule it contradicts. Nothing is dismissed because it is outside the change, and nothing is rejected because a rule requires it. A finding with a `challenge` takes `ticket` or `duplicate` only: file it against the rule's owner (the pattern reference, the project's instructions or the `design.rules` file that states the rule), quoting the rule and the proposed change, so the owner's reference changes and then the screens that follow it. Changing a rule is a product call: the ticket carries it to the owner as the owner's instructions require.
4. **Gate.** `review-frames.ts check <manifest> <review> --triaged` must print OK. Frames recaptured after a fix go through a follow-up blind review of just those frames, under a new manifest and a fresh reviewer. A ticket is accepted when its frames' findings are all dispositioned and every finding inside its change is fixed and re-reviewed clean.

Keep the manifests and reviews under `<state>/implementation/reviews/` and log each gate's result in the run log.

## Chrome review

The persistent chrome (shell, sidebars, headers, panels, toolbars, bars) gets its own blind review every wave, against the design rules, because it appears in every frame and no ticket owns it. The orchestrator runs it after the wave deploys, before the next wave starts:

1. Capture each screen in the config's `qa.screens` from production (from the wave's build when the project does not deploy): `bun <skill>/scripts/audit-screen.ts --url <app-url><path> --shots <local>/shots/wave-<n>-chrome --state <screen-name> > <local>/shots/wave-<n>-chrome/<screen-name>-after-audit.json`. When production sits behind authentication (the config's `deploy.access`), open the screen in an authenticated browser session first and pass `--session <name>` instead of `--url`.
2. Build its manifest and brief a fresh reviewer with chrome scope, as in **Blind review**.
3. Triage the same way. File every chrome defect before the next wave's units start, so they include those tickets.

## What to do with a defect

- **Inside the change** (the unit's ticket, the reviewed area, the flow being redesigned): fix it in the same unit and recapture.
- **Outside it:** file it through `issue-tracker` in the same wave, with the screenshot and the audit output, and list it in the unit's return or the review's triage. In a UX review whose findings are its product, record it as a finding of the unit that saw it instead. Never leave it only in a report or a checkpoint.
