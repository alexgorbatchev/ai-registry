# Reviewing the real app and filing findings

- [Preflight](#preflight)
- [Units and briefs](#units-and-briefs)
- [Shared reviewer rules](#shared-reviewer-rules)
- [Screenshots](#screenshots)
- [Findings file](#findings-file)
- [Verification](#verification)
- [Dedupe](#dedupe)
- [Filing](#filing)
- [Completeness](#completeness)
- [Salvage](#salvage)

Phase 2 detail. `<state>` is the project's ignored durable state directory and `<skill>` is this skill's directory; run scripts from the project root as `bun <skill>/scripts/<name>.ts`. [Orchestration](orchestration.md) owns unit sizing, checkpoints, skip lists and bounded pools; this file owns what reviewers and verifiers do and what a filed finding carries. Every ticket read or write goes through the `issue-tracker` skill (SKILL.md "Setup"). Each area runs as unit `review-<area>` with the stages `review`, `verify` and `deliver`, checkpointed at `<state>/ux-flows/units/review-<area>.json`; re-verifying a filed ticket runs as unit `verify-<ticket>`. Units never commit: the orchestrator publishes the files they write under the commit rules in [SKILL.md](../SKILL.md#execute-the-task) "Scope boundaries".

## Preflight

Do these inline, in one context, before starting any parallel unit.

1. **Current build.** Fetch the app and every backend it depends on. Fast-forward a clean checkout of the default branch and rebuild. When a checkout is dirty, diverged or on another branch, report it, build the review instances from a clean worktree at the freshly fetched default branch, and continue; never move, reset, stash or switch the user's checkout. If a run started on a stale build, stop it and restart on the current one; findings against stale code are wasted.
2. **Existing-ticket digest.** List the product's open tickets through `issue-tracker` (number, title, one-line scope) and put the digest in every brief. Agents read a ticket's body when its title is ambiguous.
3. **Disposable dataset.** Build scratch data shaped like real use and deliberately messy, never the owner's real data or data store; copies of a few real items are fine. For an illustrative reporting app: titles in ALL CAPS and in lowercase, one value spelled several ways, empty fields that are usually filled, near-duplicates in different formats, an empty folder, deep nesting, one folder holding hundreds of reports, a name long enough to overflow. Hide the real data from review instances; when the app's default commands open the real store, wrap them so they open the scratch one.
4. **Write sandboxes.** Give each reviewer its own sandbox in the dataset (illustratively, a folder "UX review sandboxes / Bulk edit" holding 12 reports) and enumerate what it may write: which items, how many imports or deletions, "apply at most two merges, then undo one", "preview only, never apply moves or deletions". Reading and previews may target anything. Forbid by default: other data stores, installing or upgrading tools, changing connection or server settings, editing repository files, running git, starting or stopping servers.
5. **Scout pass.** Drive the app once in a browser: map the surfaces in scope, confirm screenshots save, test [annotate.js](../assets/annotate.js), and record the selectors of development overlays to hide. Choose units from this map.
6. **Helpers and validators.** Before fan-out, place annotate.js, the validator command and the service launch scripts in durable project paths, never session temp or a scratch directory that gets cleaned.
7. **Capacity.** Check free memory and measure one app instance's footprint; size the instance count and reviewer pool from them.
8. **Isolated instances.** When the app keeps per-user state (saved selections, filters, last location, preferences), run one app instance per concurrent reviewer and verifier, each with its own port and state store, against one shared sandboxed backend. Allow those origins in the backend if it checks origins. Give each reviewer its URL and name the isolation artifacts that are not findings, such as a loopback address shown as the server name. Backend data stays shared, so sandboxes and the environment-issue rule cover data churn.
9. **Supervised services.** Start the backend and instances as [orchestration](orchestration.md#services) specifies, and health-check every instance before launch, on resume and between waves.

## Units and briefs

- Partition the in-scope roster into areas, each a slice of roster features that one reviewer covers in about 30 minutes. Add 1–3 end-to-end journeys that cross areas, phrased as a user goal in the owner's words (illustrative: "a quarterly report is due tomorrow: gather the sources, clean them up, build the report, export and share it").
- Every in-scope roster ID appears in at least one brief.
- Each brief states:
  - the area key (kebab-case; it prefixes finding IDs);
  - the roster IDs and the flows to exercise, with "exercise every flow in this brief";
  - the enumerated write permissions;
  - related existing tickets ("#N already covers X; add only new evidence");
  - the unit's resources: app URL, browser session name, sandbox, `<state>/ux-flows/shots/<area>/`, `<state>/ux-flows/findings/<area>.json`;
  - recent product changes to expect, so nobody files against an older version of the app.
- Journeys report clicks and context switches, lost state, dead ends, places the person must remember or retype IDs or paths, missing bulk affordances, and where the app should have guided them ("does the app surface problems, or must the person hunt for them?").

## Shared reviewer rules

Every reviewer gets the same rules block, the product direction and owner rules from Setup, the existing-ticket digest, and its brief.

- **Role:** senior product designer and front-end engineer doing a hands-on review; honest, concrete and thorough.
- **Observe, then ground.** Exercise every flow in the brief in the running app first. Then read the code and name the root cause with `path:line` references. When a fix needs backend or API work, confirm it against the API documentation or catalog and set `needsBackend: true`.
- **Respect contracts.** Suggestions keep the project's binding contracts and stated intent, or name the contract change explicitly. Read the owning component's documented intent before calling behavior a defect.
- **Benchmark.** Name the best tools for the same job in the project's domain, plus general conventions (the operating system's multi-select, best-in-class bulk editing), and propose the better experience, not parity with the app or any competitor.
- **A good finding** is one concrete, observed, reproducible problem, or a tight group of related problems on one surface, stated in the user's terms: what they try to do, what goes wrong, what it costs them and how often. Its suggestion is specific about layout, interaction model, defaults, copy, keyboard support and states (empty, loading, partial, error, success), includes an ASCII wireframe when layout matters, and ends in acceptance criteria a developer can test. Functional bugs hit along the way count (category `bug`).
- **Volume.** 6–12 strong findings per 30-minute unit. No trivia padding; no skipped real problems.
- **Environment artifacts are not findings.** The isolated instance's labels, server restarts and outages, other reviewers' data churn and stale saved state go in the unit result's `environmentIssues`. A genuine recovery-UX problem reproduced within the reviewer's own session is a finding.
- **Browser hygiene.** Use your own session name, wait on visible text or a condition instead of fixed sleeps, and close the session at the end. Never start or stop servers; report an unresponsive app as an environment issue.
- **Handoff.** Checkpoint the findings file after every finding as [orchestration](orchestration.md) specifies, validate it as **Findings file** describes, then return `{area, findingsFile, findingCount, titles, environmentIssues}`.

## Screenshots

[annotate.js](../assets/annotate.js) draws numbered, high-contrast boxes and callouts in the page, so the capture carries the annotation.

1. After every navigation or reload, evaluate the file's contents in the page with the browser automation tool; it returns `uxr ready`.
2. Hide the development overlays the scout found: `__uxr.hide('<selector>')` returns how many it hid.
3. Mark the problem and check the return value: on a miss `mark` returns `no match for …`, `markText` returns `no element contains …` and `markAll` returns an empty list instead of box numbers.
   - `__uxr.mark('<selector>', 'label')` boxes the first match; `__uxr.markAll('<selector>', 'label')` boxes every match.
   - `__uxr.markText('visible text', 'label')` boxes the smallest visible element containing the text.
   - `__uxr.markRect(x, y, w, h, 'label')` boxes a viewport rectangle in CSS pixels.
   - `__uxr.note('text', x, y)` places a free callout.

   Labels state the problem ("Selection bar pushes the table down 52px"), not the element name. Boxes are fixed to the viewport: scroll first, then mark, and clear and mark again after any scroll. They attach to the topmost open `<dialog>`, so they render above modals.
4. Save to an absolute path, `<state>/ux-flows/shots/<area>/NN-short-slug.png`; browser tools can ignore or misresolve relative paths.
5. Open the saved image and confirm it shows the problem legibly with correctly placed boxes; recapture otherwise. Never cite an image you have not opened.
6. Run `__uxr.clear()` before interacting again.

- One focused image per problem; before and after pairs for interaction problems.
- Default viewport 1600×1000; add 1280×800, 900×900, and light and dark themes where layout or contrast is part of the problem.
- Each caption says what the numbered boxes show.

## Findings file

Write `<state>/ux-flows/findings/<area>.json` and validate it from the project root:

```bash
bun <skill>/scripts/validate-handoff.ts findings <state>/ux-flows/findings/<area>.json --feature-pattern '<roster ID regex>'
```

Pass the roster's ID pattern (for example `'^F\d{3}$'`); without it any non-empty string passes as a roster ID. Fix and rerun at most three times. If it still fails, return the validator output, under `environmentIssues` when the environment caused it (for example screenshots that cannot be captured); the orchestrator marks the unit failed for re-queue in `<state>/ux-flows/units/review-<area>.json`. Shape, with illustrative values:

```json
{
  "area": "bulk-edit",
  "coverage": [{ "flow": "Edit several reports at once", "exercised": true, "notes": "12 sandbox reports" }],
  "findings": [{
    "id": "bulk-edit-01",
    "title": "Apply clears the selection, so a second edit starts over",
    "featureIds": ["F041", "F044"],
    "category": "workflow",
    "severity": "P1",
    "observed": "What happens now, precisely.",
    "impact": "Who is hurt, how often, what it costs.",
    "reproSteps": ["Select 12 reports in the sandbox", "Edit, change Owner, Apply"],
    "suggestion": "Specific improvement.",
    "wireframe": "Optional ASCII wireframe.",
    "acceptanceCriteria": ["After Apply the 12 reports stay selected"],
    "screenshots": [{ "path": "/abs/project/.state/ux-flows/shots/bulk-edit/01-selection-lost.png", "caption": "1. Selection count resets to 0 after Apply" }],
    "codeRefs": ["src/bulk/EditDialog.tsx:212"],
    "needsBackend": false,
    "existingTicket": null,
    "confidence": "high"
  }]
}
```

The validator enforces:

- `area` non-empty; every finding `id` starts with `<area>-` and is unique.
- `coverage` is an array; each entry has a `flow` string and an `exercised` boolean (`notes` optional). List every flow in the brief, including those you could not exercise and why.
- `findings` is non-empty; `title`, `observed`, `impact` and `suggestion` are non-empty; `reproSteps`, `acceptanceCriteria` and `screenshots` each have at least one entry.
- Every screenshot `path` is absolute and exists on disk, with a non-empty `caption`.
- `featureIds` is an array matching `--feature-pattern`; `codeRefs` is an array; `needsBackend` is a boolean; `confidence` is `high`, `medium` or `low`; `existingTicket` is null or a ticket number; `mergeInto`, when present, names the surviving finding ID.
- `category` is one of `bug`, `workflow`, `information-architecture`, `feedback-and-state`, `discoverability`, `consistency`, `density-and-layout`, `accessibility-keyboard`, `copy`, `performance`, `safety`.
- `severity` is one of:
  - **P0:** blocks a core workflow, risks data loss, or is a functional bug that breaks the flow.
  - **P1:** major friction in a frequent workflow, confusing to most people, or a high-risk misclick.
  - **P2:** moderate friction, inconsistency or a missing affordance.
  - **P3:** polish.

`wireframe` is optional. A unit that found nothing cannot pass the validator (findings must be non-empty): it records its coverage, `"count": 0` and the reason in its checkpoint, marks the unit done without running `verify` or `deliver`, returns `findingCount: 0`, and **Completeness** reruns its area once under a new key. If the rerun also finds nothing, its checkpoint records the area as reviewed with no findings.

## Verification

An independent adversarial verifier runs each unit's `verify` stage as soon as its review returns, before delivery. Its brief: kill weak, wrong, duplicated or inflated findings, sharpen the real ones, and default to skepticism. For every finding it:

1. Opens each screenshot and checks that it truly shows the problem and that the annotations are accurate and legible.
2. Reproduces every P0 and P1, and any finding whose screenshot is not self-evident, from a clean state. A verifier that shares the reviewer's instance first resets saved filters, selection and location.
3. Checks the cited code.
4. Checks for duplicates within the area and against existing tickets.
5. Judges the severity, and whether the suggestion is sound, fits the project's contracts and is better for the user.

It writes `<state>/ux-flows/findings/<area>.verdicts.json` and validates it with `bun <skill>/scripts/validate-handoff.ts verdicts <file>`, under the same three-attempt cap. Each verdict has `id`, `verdict`, `severity` (the final one) and `notes` (the evidence), plus:

- `confirmed`: nothing more.
- `adjusted`: any of `revisedTitle`, `revisedObserved`, `revisedSuggestion`; the final `severity` says what changed.
- `refuted`: the notes say why.
- `duplicate`: `duplicateOf` (a finding ID) or `existingTicket` (a ticket number).
- Any verdict may add `updatedScreenshots: [{path, caption}]`, absolute and existing; save the verifier's own captures as `<state>/ux-flows/shots/<area>/verify-NN-slug.png`.

Give every finding exactly one verdict. The validator does not compare the verdicts against the findings file, so check that the two ID sets match before returning.

Expect severity inflation: in practice most P0s drop a level on independent reproduction. So after filing, run one short `verify-<ticket>` unit per filed P0 ticket:

1. If the unit checkpoint `<state>/ux-flows/units/verify-<ticket>.json` records the verdict as posted, stop and return it. Otherwise resume from the checkpoint, which records each step as it completes.
2. Read the ticket and its screenshots through `issue-tracker`, and open each screenshot.
3. Reproduce from a clean state and capture an annotated screenshot of its own under `<state>/ux-flows/shots/verify-<ticket>/`. Take writes only up to their review or confirmation step and cancel; where a write is essential, write only inside a sandbox named in the verifier's brief, and undo it afterwards when the app offers undo.
4. Check the cited code and decide: confirmed, adjusted (say exactly what), or not reproduced.
5. Record one verdict on the ticket (confirmed; adjusted, saying exactly what; or not reproduced) with what was done (viewport, exact inputs, what was and was not written), what was seen, the corrections (over-broad claims, claims verified only by code, backend-work corrections, overlap with other tickets) and a recommended severity, plus its own screenshots.
6. Record in the checkpoint that the verdict was posted, only after it was.

The verifier changes nothing else on the ticket. The orchestrator then applies each raised severity to that finding's ticket and follows [Tracker restructure](proposals-and-tickets.md#tracker-restructure) for redesigns, other tickets and lower severities.

## Dedupe

- **Existing ticket:** set `existingTicket`; its new evidence, screenshots and acceptance criteria go onto that ticket instead of a new one.
- **Same area:** the verifier marks `duplicate` with `duplicateOf`; the duplicate is not filed.
- **Across areas:** before filing findings files that are ready at the same time, one pass over them merges by root cause, not only by surface. The same cause seen on different surfaces (illustratively, "every write dumps you on the Jobs list" seen from bulk edit, find-and-replace and import) is one problem. Keep the stronger finding as survivor and set `mergeInto: "<survivor id>"` on the others; a survivor never has `mergeInto` or `existingTicket` itself. Rewrite the survivor's title, observed text and acceptance criteria to cover every surface. Never delete a finding, and revalidate every file the pass edited.
- A unit filing after others have filed checks the filed tickets as well as the digest; a match with an already-filed ticket is an `existingTicket` case, not a merge.
- Never hold a verified area's filing to wait for other areas' dedupe.

## Filing

When tickets are in scope, each unit's `deliver` stage files its findings through `issue-tracker` as soon as its verifier finishes ([orchestration](orchestration.md#delivery)).

- One ticket per surviving finding, carrying its reproduction steps and annotated, captioned screenshots, plus observed behavior, impact, suggestion (with its wireframe, when there is one), acceptance criteria, roster IDs, code references and whether it needs backend work.
- Apply verdicts first: refuted findings and duplicates of another finding are not filed; a duplicate of an existing ticket goes onto that ticket as **Dedupe** says; adjusted fields and replacement screenshots replace the originals; a finding without a verdict is marked unverified.
- Fold each merged finding into its survivor's ticket with its observations, screenshots and criteria, and map it to the survivor's ticket number.
- State verification honestly: "Verified by an independent reviewer (adjusted from P0 to P1)" or "Not yet re-verified by an independent reviewer".
- Replace isolated-instance URLs with "the app".

## Completeness

After the first wave, one critic, with no browser, reads every coverage list, every finding title, the filed tickets, the in-scope roster and the user's recurring jobs. It returns `{gaps: [{key, brief, why}]}` (possibly empty): up to about 5 uncovered or shallowly covered surfaces, each a brief in the usual shape with write permissions, sized for one 30-minute unit. It skips surfaces that are well covered or already in flight, and names roster IDs that no brief or coverage entry reached.

- Expect cross-cutting concerns to be under-covered by a surface-based partition: interruption, offline and error states during batch work (a lost response that replays a write), scale (very large selections and collections), accessibility of bulk operations, features derived from history, and rule editors.
- Each gap runs as a new unit `review-<key>`, with the gap's key as its area key, through the same pipeline, and receives the earlier finding titles: report only new problems or materially new evidence.
- Rerun every area that produced nothing once, as a first-class unit with area key `<area>-2` (unit `review-<area>-2`) and the same brief; the original unit stays done and on the skip list.
- The completeness pass is done when the critic returns no gaps or every gap unit it proposed has finished.

## Salvage

When units die before writing a findings file but leave screenshots or transcripts, rebuild their findings instead of re-exploring:

1. Condense each dead unit's transcript into `<state>/ux-flows/shots/<area>/transcript-digest.md`, beside its screenshots: assistant text in full, tool calls and results clipped to a few hundred characters.
2. Run one short agent per area with no browser and no servers. Its evidence is the area's screenshots (the primary evidence; open each before relying on it, and read annotation labels as the reviewer's problem statements), the digest (search it for annotation calls and screenshot saves rather than reading it whole) and the code.
3. Every finding is visibly shown by at least one existing screenshot. Never invent behavior the screenshots, digest or code do not support. Aim for 6–18 findings, highest value first, within about 30 minutes.
4. Record the result as the dead unit's `review` stage in `<state>/ux-flows/units/review-<area>.json`, then validate, verify, dedupe and deliver as for any unit. Requeue an area whose evidence is empty or unusable as a fresh review unit.
