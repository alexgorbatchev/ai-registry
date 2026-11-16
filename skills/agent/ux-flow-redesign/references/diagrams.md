# Current and proposed flow diagrams

Phase 4 draws each flow's current diagram and Phase 6 its proposed diagram, as stages of the flow's `flow-<key>` unit; in Phase 8 the `integrate` unit re-renders whichever changed. Load the Archify skill for spec mechanics, validation and repair; this file adds the conventions both templates share and the evidence rules this workflow depends on.

- [Why a pair](#why-a-pair)
- [Tracing the current flow](#tracing-the-current-flow)
- [Spec conventions](#spec-conventions)
- [Repository evidence](#repository-evidence)
- [Running Archify](#running-archify)
- [Rendering for inspection](#rendering-for-inspection)
- [Regeneration recipe](#regeneration-recipe)
- [Without Archify](#without-archify)
- [Honest verification](#honest-verification)

## Why a pair

- The current diagram shows what the code does today, at a pinned revision, with every evidenced pain point marked on its step by its finding, cited as SKILL.md "ID conventions" says. The proposed diagram shows the target journey and, on each step, which of those findings it removes.
- Start the proposed diagram from the current one and its findings, so a reader can compare them step by step.
- The pair is the redesign's evidence: the proposal, the redesign ticket, the wireframe page's nav and the docs index row link both HTML files.
- Before filing the redesign ticket, or finishing the proposal when none is filed, check the pair against Phase 3: every finding marked on the current diagram is resolved on a proposed step, or listed under the proposal's `Related, not covered:` with the redesign that resolves it, or accounted for in `<state>/ux-flows/assignments.md` (stopgap or patch). A finding that silently disappears is orphaned.

## Tracing the current flow

1. **Pin the revision.** Trace in a clean checkout or worktree at the commit you will cite: the synced, pushed default branch, so the commit stays reachable for later regeneration. Never trace or cite the live checkout; uncommitted edits there are not evidence, and Archify verifies citations against committed bytes at the pinned revision. Trace every flow at the same revision when possible, because the docs index states one revision for all current flows.
2. **Scaffold there.** From that checkout's root, run `bun <skill>/scripts/scaffold-flow.ts --docs <docs>/ux-flows --key <key> …` (flags under [Scripts](../SKILL.md#scripts)), so the revision it writes is the one you trace (see [Repository evidence](#repository-evidence)). The scaffold edits the shared wireframe and docs indexes, so scaffold every flow before parallel agents start. One shared worktree then serves all diagram agents under the [ownership rules](orchestration.md#ownership).
3. **Read the flow's evidence:** its findings files (`<state>/ux-flows/findings/<area>.json`: problems with annotated screenshots and code references), the filed finding tickets, and the `tickets` map in each review unit's checkpoint (`<state>/ux-flows/units/review-<area>.json`) that gives each pain point its citation.
4. **Trace the journey** from every entry point (menus, buttons, routes, shortcuts, links from other flows) along the path the code takes: screens and dialogs, decisions, confirmations, waits and background jobs, results, recovery, undo, dead ends, and every context switch (navigating away, a forced trip to another page, a manual refresh). Follow call sites until each step reaches its actual write or display, and record repository-relative paths with inclusive line ranges as you read.
5. **Keep it readable.** Draw one complete journey from entry to end states rather than every branch. The workflow type has six columns (`col` 0 to 5): fold minor variations into a sublabel or explanation, and give a branch its own node only when it changes the outcome or carries a pain point. Budget about 30 minutes per diagram.
6. **Mark the pain points** on the steps where they happen (see [Spec conventions](#spec-conventions)). A defect seen while tracing that has no finding goes in the "Not yet ticketed (seen in code)" card and the proposal's section of that name, never on a marked step. The Evidence card says what was exercised in the running app and what was traced from source only.

## Spec conventions

Both templates use `diagram_type: "workflow"`, and so does every spec: the regeneration recipe runs `finalize workflow` on all of them. The templates encode these conventions; keep them when you adapt the nodes.

| Element | Current (`current-flow.workflow.json`) | Proposed (`proposed-flow.workflow.json`) |
| --- | --- | --- |
| Lanes | Entry points · `{{MAIN_VIEW}}` · Dialogs · Backend job · Failures and retry | `{{MAIN_VIEW}}`: ask · `{{MAIN_VIEW}}`: review · Backend operation · Outcome in place · Recovery in place |
| Phases | Open + set up · Confirm + run (emphasis) · Result + undo | Ask · Review + write (emphasis) · Outcome + undo |
| `mainPath` | `open → form → confirm → job → result` | `entry → ask → plan → write → receipt` |
| `external` (legend) | Entry point | Entry point |
| `frontend` | UI step | UI step where the work started |
| `backend` | Backend job | Backend operation |
| `security` | Step with an evidenced pain point, in any lane | Recovery step, handled in place |
| `tag` | The finding on that step | The finding this step resolves |
| `explanation` | The pain point and its finding | What the step does and which problems (findings) it removes |
| `sources` | The code that implements the step | Existing code the step keeps: `Reuses:` or `Replaces:` |

- **Lanes are surfaces:** one per place the person works (a page, a dialog, a separate page they are sent to), plus the backend lane and the recovery lane with `variant: "exception"`. A context switch then reads as a jump between lanes. Add a lane for every extra surface today's flow forces; justify in its explanation any surface the proposal adds.
- **Phases** span the real columns through `fromCol` and `toCol`. `variant: "emphasis"` marks the phase holding the write that changes data; a read-only flow has no emphasis phase.
- **`mainPath`** lists the happy path's node IDs in order; edges between consecutive IDs take `role: "main"`.
- **Node types** follow the legend meanings in the table. In the current diagram a step with an evidenced pain point is `security` whatever its lane, and no other step is; in the proposed diagram only recovery steps are. A step that needs another type (for example `database`) gets a plain-language `meta.legend.entries` label.
- **Labels** fit about 28 characters at the template widths; a wider one fails Archify's `layout/constraint` gate. Put exact copy, such as an outcome message, in the sublabel or explanation instead of shortening the product's wording. The proposed template's outcome node takes `{{SHORT_OUTCOME_LABEL}}` and quotes the full outcome sentence in its explanation.
- **`tag`** holds the finding's citation (SKILL.md "ID conventions"): its ticket label as the tracker writes it (`#123`), or its finding ID. When several findings land on one step, tag the most severe and name all of them in the explanation. Omit `tag` on a step that shows or resolves no finding.
- **`explanation`** is plain text of at most 1,200 characters, shown in the viewer's Explain panel and absent from screenshots and image exports. Labels, sublabels and tags must carry what a ticket reader needs, and the ticket text names the pain points itself. In proposed explanations, cite the pattern rule IDs the step follows (`REV-1`, `SEL-2`) so Phase 8 can find the steps a rule change affects.
- **`sources`:** at most three per node, each `{path, line, end_line, label}` with a repository-relative path, inclusive lines copied from the file at the pinned revision, and a label of at most 48 characters. The templates' `line: 1, end_line: 1` are placeholders that validation cannot catch; replace them. Edges carry no sources: cite the call or write site on the node that owns it. Cite every primary step in the current diagram. In the proposed diagram, cite only existing code a step keeps, labelled `Reuses: <what>` or `Replaces: <what>`; a step with no code yet has none. Never cite unrelated code to satisfy validation.
- **Placeholders:** search each spec for `{{` before finalizing. Archify accepts placeholder text in labels, explanations and cards, and the wireframe linter reads only HTML.

Edge roles:

| `role` | Use |
| --- | --- |
| `main` | The happy path between consecutive `mainPath` nodes |
| `branch` | An alternative the person chooses: another entry point, an optional step, a different gesture |
| `error` | A failure into the recovery lane |
| `return` | Going back: retry into the flow, back to edit, undo restoring an earlier state |

Add `variant: "dashed"` to a hop that is optional or happens later without the person acting (an automatic refresh, background work finishing, an undo taken later) and say which in its label. The proposed template marks the edge that performs the write `variant: "emphasis"` and labels it with the button's counted effect (illustrative: `Export 12 reports`).

Cards keep their titles and dot colours in every diagram, so all diagrams read alike. Drop a card only when it would be empty, except Contract changes, which says `None`.

| Diagram | Dot | Title | Items |
| --- | --- | --- | --- |
| Current | emerald | What already works | Behavior the redesign must keep |
| Current | rose | Tickets on this journey | `<finding citation> <one-line problem>` |
| Current | amber | Not yet ticketed (seen in code) | Defects seen while tracing |
| Current | slate | Evidence | `Traced from <repository> at <revision>; <what was exercised live>` |
| Proposed | emerald | What changes versus today | `Removed:`, `Merged:`, `New:`, `Kept:`, plus `Changed:` when a behavior flips, matching the redesign ticket |
| Proposed | rose | Tickets this journey resolves | `<step group>: <finding citations>` |
| Proposed | violet | Backend work | Each backend change the flow needs |
| Proposed | cyan | Contract changes | `CC-n` and the change, or `None` |
| Proposed | amber | Seen in code, not yet ticketed | Defects seen while designing |
| Proposed | slate | Evidence | `Designed against <repository> at <revision> and the shared UX pattern reference revision <n>` |

## Repository evidence

- **`meta.repository.revision`** is the full 40-character SHA of the traced commit: `git -C <root> rev-parse HEAD` in the checkout you pass as `--repo-root`. A short SHA fails schema validation. `scaffold-flow.ts` writes the HEAD of its `--repo-root`, which defaults to the Git top level of `--docs`; replace it when that is not the traced checkout.
- **`meta.repository.url`** comes from `git remote get-url origin` and must be credential-free: HTTP(S) without user info, or SSH. The scaffold fills it only when the origin already qualifies and otherwise leaves `{{REPOSITORY_URL}}`. Then remove the user name, password or token yourself and keep the transport, host, port, path and `.git` suffix; never rewrite an SSH origin as HTTPS.
- **`link_mode: "local-only"`** is the template default; keep it for private repositories. The Archify skill decides when a public repository may use web links.
- **Finalize with `--repo-root <root>`** so Archify verifies every citation against committed bytes at the revision. A current diagram always passes with repository evidence (the Phase 4 gate); a failure there is a wrong citation to fix.
- **Proposed-only steps:** when repository evidence cannot accept a step that exists only in the proposal, record why in the flow's checkpoint (`<state>/ux-flows/units/flow-<key>.json`, or `reconcile-<key>.json` for a step added in Phase 8), add "Sources not verified: <reason>" to its Evidence card, and finalize without `--repo-root`.

## Running Archify

1. Load the Archify skill and read what it lists for the workflow type before writing the first spec.
2. Run finalize from the root of the checkout you pass as `--repo-root`. `meta.output` resolves from the working directory and must stay inside it, so use repository-relative paths that match it:

   ```bash
   node <archify>/bin/archify.mjs finalize workflow <docs>/ux-flows/<key>-current.json <docs>/ux-flows/<key>-current.html \
     --repo-root <root> --quality showcase --out-dir <state>/ux-flows/archify/<key>-current-<n> --json
   ```

   The proposed spec runs the same way with `-proposed` names. Use a fresh `--out-dir` for every attempt (a new `<n>`), never inside the docs tree, where its receipts would match the regeneration glob.

   Whatever `--out-dir` says, Archify also writes a delivery receipt beside each render (`<key>-current.delivery.json`). It holds absolute local paths and every finalize rewrites it. Before the first finalize (in a parallel run, with the scaffold), add `<docs>/ux-flows/*.delivery.json` to the project's ignore rules; never commit one, and untrack any already committed through the project's Git workflow. `git ls-files '<docs>/ux-flows/*.delivery.json'` must print nothing, so the [privacy scan](publishing.md#privacy) and the Phase 9 gate find none tracked.
3. A non-zero exit is a failure. Repair the failed gate as the Archify skill directs, within its repair limit, and rerun the complete finalize command. Mark the stage done in the flow's checkpoint (`<state>/ux-flows/units/flow-<key>.json`, [schema](orchestration.md#checkpoints-and-resume)), or for a Phase 8 re-render in the `integrate` checkpoint, only after a passing run, recording the finalize summary (`<out-dir>/<key>-current.finalize-summary.json`), the revision and the attempt count. When a defect survives the repair limit, leave the stage undone, record the defect as the blocker with its unblock condition in that checkpoint, report it, and continue with other flows.
4. Give each concurrent agent its own browser session for Archify's browser check, through the external browser endpoint the Archify skill describes or the private browser Archify launches itself. Never share a session between agents, and close yours when done, including after a failure.
5. Archify serializes deliveries into one output directory, so all diagrams in `<docs>/ux-flows/` deliver one at a time. `delivery/concurrent-attempt` means another delivery holds the lock: wait and rerun finalize without editing the spec; it does not count as a repair. Never delete a lock file. For `delivery/lock-stale` or `delivery/lock-invalid`, follow the Archify skill's recovery.
6. Never install, upgrade or update Archify. When a receipt carries an update notice, pass it to the owner.

## Rendering for inspection

1. Open each render (its served docs URL, or its file URL with local file access allowed) in a browser automation session of your own, at a 1600×1000 viewport, and wait until the diagram has drawn.
2. Hide floating viewer controls that cover labels, such as the viewer's navigation toolbar, then take a full-page screenshot to `<state>/ux-flows/shots/<key>/<key>-current.png` (or `-proposed.png`).
3. Open the image and confirm that every label is legible and the whole diagram is in the frame. Retake with a larger viewport if anything is cut off. Close the session.
4. Never commit the images.

## Regeneration recipe

One task-runner recipe re-finalizes every spec; [publishing](publishing.md#diagram-regeneration-recipe) says when to add it and how to test it. The recipe:

- loops over `<docs>/ux-flows/*.json` and derives each HTML path by replacing `.json` with `.html`;
- skips Archify's receipt files that match the glob (`*.delivery*.json`, `*.finalize*.json`);
- guards the empty glob, so a project with no diagrams yet passes;
- runs sequentially, because of the per-directory delivery lock, and exits non-zero when any spec fails;
- finalizes a spec recorded as finalized without `--repo-root` (see [Repository evidence](#repository-evidence)) through an explicit exception without that flag, or the recipe fails on it.

```bash
shopt -s nullglob
run="$STATE/ux-flows/archify/regenerate-$(date +%Y%m%d-%H%M%S)"
status=0
for spec in "$DOCS"/ux-flows/*.json; do
  case "$spec" in *.delivery*.json | *.finalize*.json) continue ;; esac
  node "$ARCHIFY"/bin/archify.mjs finalize workflow "$spec" "${spec%.json}.html" --repo-root . \
    --quality showcase --out-dir "$run/$(basename "$spec" .json)" --json || status=1
done
exit "$status"
```

Run it from the repository root, with `DOCS` the docs directory relative to that root, `STATE` the ignored state directory and `ARCHIFY` the installed Archify package.

## Without Archify

Keep the pair, the file names, the code citations and the finding marks. Write `<docs>/ux-flows/<key>-current.html` and `<key>-proposed.html` anyway: every wireframe page's nav must link both (the linter's `nav` rule), the linter's link check and the crawl fail on missing files, and the docs index rows point to them. Render one of these into each page:

- **A Mermaid flowchart** per diagram, its source also kept in the proposal: one subgraph per lane, finding citations in node text, and the pinned revision in the page. Render it with whatever the docs site already uses for Mermaid; without one, use the step table.
- **A step table** per diagram with the columns step, surface (lane), code citation (`path:start-end` at the pinned revision), finding, and what changes. In the current table, "what changes" says what the redesign does to the step (removed, merged, changed or kept); in the proposed table, which problems the step removes.

In provisional mode ([SKILL.md](../SKILL.md#execute-the-task) step 2), the current flow may be this step table rendered into `<key>-current.html` even when Archify is available, with the finding column citing evidence (a screenshot or `path:start-end`) instead of findings.

Put the card content under the chart or table as short lists. Capture and inspect both pages as in [Rendering for inspection](#rendering-for-inspection).

## Honest verification

- A passing finalize proves Archify's automated gates (validation, delivery, strict check and browser check) and reports `visualReview: "not-requested"`. It is not visual inspection; only opening a screenshot and reading it is.
- Renders count as inspected only when step 3 of [Rendering for inspection](#rendering-for-inspection) ran on the current bytes; a regenerated diagram without a new capture is automated-only again.
- Report per batch which renders were inspected and which passed automated checks only, as [visual evidence](publishing.md#visual-evidence) requires, and whether every served diagram URL returned HTTP 200.
