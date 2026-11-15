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

Phase 2 detail. `<state>` is the project's ignored durable state directory and `<skill>` is this skill's directory; run scripts from the project root as `bun <skill>/scripts/<name>.ts`. [Orchestration](orchestration.md) owns unit sizing, checkpoints, skip lists, bounded pools and the filer's mechanics; this file owns what reviewers, verifiers and the filer do. Each area runs as unit `review-<area>` with the stages `review`, `verify` and `deliver`, checkpointed at `<state>/ux-flows/units/review-<area>.json`; re-verifying a filed ticket runs as unit `verify-<ticket>`. Units never commit: the orchestrator publishes the files they write, Markdown tickets included, under the commit and claim rules in [SKILL.md](../SKILL.md#execute-the-task) "Scope boundaries".

## Preflight

Do these inline, in one context, before starting any parallel unit.

1. **Current build.** Fetch the app and every backend it depends on. Fast-forward a clean checkout of the default branch and rebuild. When a checkout is dirty, diverged or on another branch, report it, build the review instances from a clean worktree at the freshly fetched default branch, and continue; never move, reset, stash or switch the user's checkout. If a run started on a stale build, stop it and restart on the current one; findings against stale code are wasted.
2. **Existing-ticket digest.** List the open tickets for the product (number or ID, title, one-line scope) from the tracker, or from `<docs>/ux-flows/tickets/` without one, and put the digest in every brief. Agents inspect a ticket's body when its title is ambiguous.
3. **Disposable dataset.** Build scratch data shaped like real use and deliberately messy, never the owner's real data or data store; copies of a few real items are fine. For an illustrative reporting app: titles in ALL CAPS and in lowercase, one value spelled several ways, empty fields that are usually filled, near-duplicates in different formats, an empty folder, deep nesting, one folder holding hundreds of reports, a name long enough to overflow. Hide the real data from review instances; when the app's default commands open the real store, wrap them so they open the scratch one.
4. **Write sandboxes.** Give each reviewer its own sandbox in the dataset (illustratively, a folder "UX review sandboxes / Bulk edit" holding 12 reports) and enumerate what it may write: which items, how many imports or deletions, "apply at most two merges, then undo one", "preview only, never apply moves or deletions". Reading and previews may target anything. Forbid by default: other data stores, installing or upgrading tools, changing connection or server settings, editing repository files, running git, starting or stopping servers.
5. **Scout pass.** Drive the app once in a browser: map the surfaces in scope, confirm screenshots save, test [annotate.js](../assets/annotate.js), and record the selectors of development overlays to hide. Choose units from this map.
6. **Helpers and validators.** Before fan-out, place annotate.js, the validator command, the filer and the service launch scripts in durable project paths, never session temp or a scratch directory that gets cleaned.
7. **Capacity.** Check free memory and measure one app instance's footprint; size the instance count and reviewer pool from them.
8. **Isolated instances.** When the app keeps per-user state (saved selections, filters, last location, preferences), run one app instance per concurrent reviewer and verifier, each with its own port and state store, against one shared sandboxed backend. Allow those origins in the backend if it checks origins. Give each reviewer its URL and name the isolation artifacts that are not findings, such as a loopback address shown as the server name. Backend data stays shared, so sandboxes and the environment-issue rule cover data churn.
9. **Supervised services.** Start the backend and instances as [orchestration](orchestration.md#services) specifies, and health-check every instance before launch, on resume and between waves.

## Units and briefs

- Partition the in-scope roster into areas, each a slice of roster features that one reviewer covers in about 30 minutes. Add 1–3 end-to-end journeys that cross areas, phrased as a user goal in the owner's words (illustrative: "a quarterly report is due tomorrow: gather the sources, clean them up, build the report, export and share it").
- Every in-scope roster ID appears in at least one brief.
- Each brief states:
  - the area key (kebab-case; it prefixes finding IDs and names the epic);
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
  "epic": { "title": "F040–F052 Bulk editing of reports", "body": "One-paragraph goal naming the target experience." },
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
- `featureIds` is an array matching `--feature-pattern`; `codeRefs` is an array; `needsBackend` is a boolean; `confidence` is `high`, `medium` or `low`; `existingTicket` is null, a ticket number or a Markdown ticket ID; `mergeInto`, when present, names the surviving finding ID.
- `category` is one of `bug`, `workflow`, `information-architecture`, `feedback-and-state`, `discoverability`, `consistency`, `density-and-layout`, `accessibility-keyboard`, `copy`, `performance`, `safety`.
- `severity` is one of:
  - **P0:** blocks a core workflow, risks data loss, or is a functional bug that breaks the flow.
  - **P1:** major friction in a frequent workflow, confusing to most people, or a high-risk misclick.
  - **P2:** moderate friction, inconsistency or a missing affordance.
  - **P3:** polish.

`epic` (`{title, body}`) is optional and unvalidated; set it for an area that has no epic yet so the filer can create one. `wireframe` is optional. A unit that found nothing cannot pass the validator (findings must be non-empty): it records its coverage, `"count": 0` and the reason in its checkpoint, marks the unit done without running `verify` or `deliver`, returns `findingCount: 0`, and **Completeness** reruns its area once under a new key. If the rerun also finds nothing, its checkpoint records the area as reviewed with no findings.

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
- `duplicate`: `duplicateOf` (a finding ID) or `existingTicket` (a ticket number or a Markdown ticket ID).
- Any verdict may add `updatedScreenshots: [{path, caption}]`, absolute and existing; save the verifier's own captures as `<state>/ux-flows/shots/<area>/verify-NN-slug.png`.

Give every finding exactly one verdict. The validator does not compare the verdicts against the findings file, so check that the two ID sets match before returning.

Expect severity inflation: in practice most P0s drop a level on independent reproduction. So after filing, run one short `verify-<ticket>` unit per filed P0 ticket:

1. If its receipt `<state>/ux-flows/receipts/verify-<ticket>.json` exists with `"commented": true`, stop and return it. Otherwise resume from the receipt, which records each step as it completes.
2. Read the ticket and open its screenshots (the tracker's attachments, or the listed paths without a tracker).
3. Reproduce from a clean state and capture an annotated screenshot of its own under `<state>/ux-flows/shots/verify-<ticket>/`. Take writes only up to their review or confirmation step and cancel; where a write is essential, write only inside a sandbox named in the verifier's brief, and undo it afterwards when the app offers undo.
4. Check the cited code and decide: confirmed, adjusted (say exactly what), or not reproduced.
5. Post exactly one comment starting `Independent verification: confirmed.`, `Independent verification: adjusted.` or `Independent verification: not reproduced.`, followed by a one-paragraph verdict, then `## What I did` (viewport, exact inputs, what was and was not written), `## What I saw`, `## Corrections` (over-broad claims, claims verified only by code, backend-work corrections, overlap with other tickets) and the recommended severity, with its screenshots embedded and attached. Without a tracker, add it to the ticket's file with screenshots listed as plain-text paths, as [Markdown tickets](proposals-and-tickets.md#markdown-tickets) describes.
6. Write `"commented": true` to the receipt only after the comment is written successfully.

The verifier does not change labels or status or close the ticket. Afterwards the orchestrator applies each raised severity to the finding ticket this review filed, and raises a redesign when the highest priority among its covered findings rises; other tickets follow the queue rule in [Filing](proposals-and-tickets.md#filing). Never lower a filed ticket's priority automatically, a redesign's included: propose each lower one to the owner as an ID'd action.

## Dedupe

- **Existing ticket:** set `existingTicket`. The filer posts one comment per area and existing ticket ("UX review follow-up: N additional observations from a hands-on review"), carrying the new evidence and acceptance criteria with its screenshots placed as **Filing** says, instead of a new ticket.
- **Same area:** the verifier marks `duplicate` with `duplicateOf`; the duplicate is not filed.
- **Across areas:** before filing findings files that are ready at the same time, one pass over them merges by root cause, not only by surface. The same cause seen on different surfaces (illustratively, "every write dumps you on the Jobs list" seen from bulk edit, find-and-replace and import) is one problem. Keep the stronger finding as survivor and set `mergeInto: "<survivor id>"` on the others; a survivor never has `mergeInto` or `existingTicket` itself. Rewrite the survivor's title, observed text and acceptance criteria to cover every surface. Never delete a finding, and revalidate every file the pass edited.
- A unit filing after others have filed checks the filed tickets as well as the digest; a match with an already-filed ticket is an `existingTicket` comment, not a merge.
- Never hold a verified area's filing to wait for other areas' dedupe.

## Filing

Each unit's `deliver` stage files its area as soon as it is verified, into a tracker only when [Filing](proposals-and-tickets.md#filing) allows it and otherwise as [Markdown tickets](proposals-and-tickets.md#markdown-tickets), which also says what replaces epics, labels and ticket numbers. When a request asks for tickets but names no tracker, the hold in [SKILL.md](../SKILL.md#execute-the-task) "Scope boundaries" applies to the `deliver` stage only. [Orchestration](orchestration.md#delivery) owns the filer's receipts, lock, privacy and image refusals, canary and batch checks. The filer renders each area:

- Creates one epic per area on first use, titled with the area's roster IDs and the outcome (illustrative: "F040–F052 Bulk editing of reports"), from the findings file's `epic` or a predefined one. The body is a one-paragraph goal naming the target experience.
- Files one ticket per surviving finding from [finding-ticket.md](../assets/templates/finding-ticket.md), titled with up to four roster IDs and then the problem. Labels: the review label, `priority:<final severity>`, and `bug` for the `bug` category; the epic carries the area.
- Applies verdicts first: refuted findings and duplicates of another finding are not filed; a duplicate of an existing ticket joins that ticket's comment; adjusted fields replace the originals; replacement screenshots come first; a finding without a verdict files as unverified.
- Fills the template: `observed` under Problem, `impact` as Impact, screenshots with captions under Evidence, `reproSteps` under Reproduce, `suggestion` and `wireframe` under Proposal, acceptance criteria as checkboxes, and roster IDs, `codeRefs`, `needsBackend` and the source under Notes. It deletes the template's instruction comment.
- Places screenshots by mode, never committing them: with a tracker, embedded by absolute path and attached so the tracker hosts them; without one, never embedded, left under `<state>/ux-flows/shots/` and listed as plain-text paths.
- Folds each merged finding into its survivor as "**Also observed (<id>):**" with its observed text and screenshots, appends its acceptance criteria, and records the survivor's ticket in its receipt.
- Writes a Notes line that states verification honestly: "Verified by an independent reviewer (adjusted from P0 to P1)" or "Not yet re-verified by an independent reviewer".
- Rewrites isolated-instance URLs to "the app" before the filer's privacy check.

## Completeness

After the first wave, one critic, with no browser, reads every coverage list, every finding title, the filed tickets, the in-scope roster and the user's recurring jobs. It returns `{gaps: [{key, brief, why}]}` (possibly empty): up to about 5 uncovered or shallowly covered surfaces, each a brief in the usual shape with write permissions, sized for one 30-minute unit. It skips surfaces that are well covered or already in flight, and names roster IDs that no brief or coverage entry reached.

- Expect cross-cutting concerns to be under-covered by a surface-based partition: interruption, offline and error states during batch work (a lost response that replays a write), scale (very large selections and collections), accessibility of bulk operations, features derived from history, and rule editors.
- Each gap runs as a new unit `review-<key>`, with the gap's key as its area key, through the same pipeline, and receives the earlier finding titles: report only new problems or materially new evidence.
- Rerun every area that produced nothing once, as a first-class unit with area key `<area>-2` (unit `review-<area>-2`), the same brief and the same epic; the original unit stays done and on the skip list.
- The completeness pass is done when the critic returns no gaps or every gap unit it proposed has finished.

## Salvage

When units die before writing a findings file but leave screenshots or transcripts, rebuild their findings instead of re-exploring:

1. Condense each dead unit's transcript into `<state>/ux-flows/shots/<area>/transcript-digest.md`, beside its screenshots: assistant text in full, tool calls and results clipped to a few hundred characters.
2. Run one short agent per area with no browser and no servers. Its evidence is the area's screenshots (the primary evidence; open each before relying on it, and read annotation labels as the reviewer's problem statements), the digest (search it for annotation calls and screenshot saves rather than reading it whole) and the code.
3. Every finding is visibly shown by at least one existing screenshot. Never invent behavior the screenshots, digest or code do not support. Aim for 6–18 findings, highest value first, within about 30 minutes.
4. Record the result as the dead unit's `review` stage in `<state>/ux-flows/units/review-<area>.json`, then validate, verify, dedupe and deliver as for any unit. Requeue an area whose evidence is empty or unusable as a fresh review unit.
