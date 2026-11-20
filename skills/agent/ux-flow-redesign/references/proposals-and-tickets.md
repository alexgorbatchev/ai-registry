# Writing flow proposals and redesign tickets

- [Design heuristics for the proposed flow](#design-heuristics-for-the-proposed-flow)
- [The proposal](#the-proposal)
- [Acceptance criteria](#acceptance-criteria)
- [Priority](#priority)
- [Research notes for a risky flow](#research-notes-for-a-risky-flow)
- [The redesign ticket](#the-redesign-ticket)
- [Tracker restructure](#tracker-restructure)
- [Linking the ticket](#linking-the-ticket)
- [Stopgaps](#stopgaps)

Use this in Phase 3 (assigning findings to redesigns), Phase 6 (designing each flow) and Phase 8 (re-syncing tickets). Every ticket read or write goes through the `issue-tracker` skill, as SKILL.md "Setup" requires; this file says only what the workflow's tickets must carry and how the tracker changes. Examples use an invented reporting app with reports, exports, documents and folders; they are illustrative only.

## Design heuristics for the proposed flow

Apply these to every proposed flow, starting from its current-flow diagram, its findings and the pattern reference:

- **Fewer steps and context switches.** Count the main path's steps today and proposed, and state both ("Today: 7 steps. Proposed: 4 steps: hint, panel, rows, toast."). Remove forced navigation to other pages, generic dialogs and manual refreshes.
- **Preview before write, with per-item control.** A read-only preview at the target becomes the plan: each item can be included or excluded, and the primary button counts what it will do ("Export 9 to Archive"). A key that used to start a blind write starts the preview instead.
- **Inline progress and results where the work started.** The same rows show progress and then become the receipt. The person keeps their location, scroll position and selection.
- **One obvious undo.** One inline Undo for the whole operation, backed by one undo record per write. When undo needs review (a later change conflicts), show that review inline instead of applying.
- **Keyboard paths.** Every step is reachable without a pointer; list the keys inline in the step.
- **Sensible defaults.** State every default (what starts selected, what is preselected, which destination is used). A default that is a threshold or otherwise contested goes to Phase 7 as a product decision with a recommended value.
- **Clear empty, partial and failure states.** Say what an empty result shows, how partial results report counts and per-item reasons, how failed items retry, and how a lost response recovers through the product's own mechanism without replaying the write.
- **Beat the incumbent rather than copy it.** Follow the project's product direction. Benchmark named best-in-class products and say what each contributes. Competitor behavior is evidence, never a requirement.
- **Warn about hazards of intended behavior; do not gate them.** When the owner's rule makes an action intended, put the warning at the point of choice and in the result, naming the concrete effect and the choices, and keep the action available. Check the owning component's stated intent before treating behavior as a defect.
- **Respect binding contracts.** Keep the project's guarantees (confirmations before destructive actions, undo, data-ownership boundaries, and whatever blocks writes when something does). Every change the design needs to a contract or the backend is called out under **Backend and contract changes**, never implied.
- **Cite the pattern reference.** Use its rule IDs in steps and criteria. When the flow must differ from a rule, propose the exception for the reference and add the disagreement to the wireframe index's conflicts list; do not invent a divergent pattern. When the reference lacks a pattern the flow needs, propose a new rule for it.

## The proposal

`bun <skill>/scripts/scaffold-flow.ts --key` creates `proposals/<key>.md` from [proposal.md](../assets/templates/proposal.md) and fills the timestamps, the flow key and title, the repository name and its current `HEAD`, and the ticket label when `--ticket-label` or `--ticket-url` is passed. Fill every remaining `{{PLACEHOLDER}}` and delete the ones the template marks optional.

Front matter and opening lines:

- **Front matter.** Exactly `created_on`, `last_modified` (local time, `YYYY-MM-DD HH:MM`) and `status: current`. Update `last_modified` on every edit.
- **Title.** `# <Flow title>: proposed experience`, or `# <Flow title>: proposed <target in a phrase>` when that names the target better.
- **Links line.** Current and proposed diagram renders and the wireframe. When a visual does not exist yet, say so ("Diagrams and wireframe: not generated yet.") and link the research notes if they exist.
- **Status line.** Keep it verbatim: `Status: design proposal, not implemented behavior. The [shared UX pattern reference](../patterns.md) wins where this proposal disagrees with it.`
- **Source revision, features, ticket.** The revision you actually read (the scaffold records `HEAD` at scaffold time; correct it if you read a different one), the roster IDs the flow owns, and the redesign ticket. The ticket is filed after the proposal; replace the label with a link once it exists ([Linking the ticket](#linking-the-ticket)).
- **Product rule (optional).** When a binding contract governs the flow, quote it and say where it lives, then name the behaviors it makes intended and end with the reframed gap: "The ordering rule below is intended, not a defect; the gap is the missing warning and the missing review around it."

Sections, in template order:

- **Target experience.** One paragraph telling the journey end to end from the person's side: where it starts, what stays in place, what the primary button says, how progress, the outcome and undo appear. End with `Benchmarks:` naming each product and what it contributes.
- **Target steps.** Numbered steps, each opening with a bold step name ending in a period. Each step says what the person does, sees and gets, then the backend operation in backticks with its effect class, `read only` or `one write`, naming the project's guarantee where it has one (`one undoable write`): "3. **Preview the export (`export.plan`, read only).**"
  - Put example copy in quotes for every label, header and outcome sentence ("12 reports · 9 ready · 2 missing data · 1 failed").
  - State defaults ("Ready reports start selected; failed ones start cleared.").
  - List keys inline ("Keys: ↑/↓ move, X toggles, Shift-click selects a range, Mod+A selects all ready, Enter focuses the footer button.").
  - When something can block writes in this product, state per surface what stays usable, what waits, and that drafts and plans survive, following the reference's rules for it.
  - Write recovery as in-place actions ("Retry 1 failed", "Undo this export"), never as "go to page X".
- **Branches and edge states.** One bold-labeled bullet per alternate gesture or keyboard path, per write-blocking state or unavailable backend, per partial or lost result (counts, per-item reasons, recovery without replaying the write), and per undo that needs review.
- **What changes versus today.** `Removed`, `Merged` ("Preview and Export become one plan → export flow."), `New`, `Changed` (behavior that flips relative to today) and `Kept`. `Kept` is the safety inventory that stops a redesign from silently dropping safeguards: walk the current-flow diagram and list every confirmation, refusal, undo path and other project guarantee that survives, and every block on writes when something blocks them. A safeguard that does not survive is listed under `Removed` with what replaces it.
- **Tickets resolved.** The flow's covers list, which the redesign ticket's covers copy and `<state>/assignments.md` agrees with. Cite findings as SKILL.md "ID conventions" says and put each in exactly one of two categories:
  - `Resolves:` the findings this redesign resolves, grouped by priority ("P0: #n. P1: #n."). A partial cover names the slice resolved here and the redesign that resolves the rest ("P1: #n (export part only; the rest: `archive`)").
  - `Related, not covered:` findings this journey meets, touches or depends on that another redesign, a stopgap, or work another worker has claimed resolves, each with that owner. Use no other category ("owned elsewhere", "touches", "addressed where they meet"): [Tracker restructure](#tracker-restructure) blocks findings by these two categories only.

  When relevant, add `Removed from this journey:` (findings that leave the journey, and why) and `Moves out of other flows:` (criteria taken over from a neighboring redesign ticket).
- **Acceptance criteria.** A `- [ ]` list written under [Acceptance criteria](#acceptance-criteria).
- **Backend and contract changes.** Under `**Backend**` (naming the backend and the contracts it preserves: confirmations, undo, whatever the project guarantees), a numbered list of bold-named changes with field names, parameters and stable error codes, the finding each serves, and a grade: required, recommended or optional later. Under `**Project contracts**`, quote each current contract and its replacement with its `CC-n` from the reference: `"<quoted current text>" becomes: <new text> (CC-3).` Prefix a change whose design is still open with `**[discuss]:**`, which marks it undecided for implementers, and name who must settle it ("the backend owners must confirm this against the affected contract").
- **Not yet ticketed (seen in code).** Defects found while tracing source, each marked fixed by this redesign or out of scope.
- **Recommended priority.** Written under [Priority](#priority).

## Acceptance criteria

Write them only in the proposal. The redesign ticket carries the proposal's section verbatim, never a separately written, condensed or reworded draft: drafts drift, dropping criteria, adding others and swapping rule IDs. Produce the ticket's section with `bun <skill>/scripts/ticket-criteria.ts print <docs>/ux-flows/proposals/<key>.md`, and before writing a ticket body run `bun <skill>/scripts/ticket-criteria.ts check <proposal> <ticket body file>`; it must print OK. To change a criterion, change the proposal and regenerate the ticket's section from it.

Each criterion is one `- [ ]` item an implementer can test without asking:

- Write observable, present-tense behavior with concrete inputs and outputs: "With 12 reports of which 9 are selected, Export writes exactly 9 files and the folder lists them in report order."
- Use exact viewports and counts: "At 1280×800, the query field, the summary strip and the first plan row are visible together without scrolling." Take the viewports from the pattern reference's per-flow conformance section.
- Add a "never" clause for each forbidden path: "Pressing Enter in the query starts `export.plan`, never `export.run`."
- Name the test layer that asserts it: state machine, component, browser or end-to-end, in the project's own terms.
- State red/green intent where a step is easy to drop silently: "A state-machine test fails when the folder re-read after the write is skipped."
- Quote exact copy when the copy is the requirement: the button reads "Export 9 to Archive"; the footer reads "↑↓ Choose · Enter Export · Esc Cancel".
- Make guards and recovery criteria too. Keep a never-replay criterion for every write, phrased for the product's own recovery mechanism (a job resumed by ID, a request retried with its idempotency key, state re-read after a sync): "A lost response resumes the export job by ID and never resubmits the write." Add a blocking-state criterion only when the product has a state that blocks writes: "While writes are blocked, the footer button is disabled with the reason visible without hover, and every plan choice survives until writing is possible again."
- End each criterion with the rule IDs it depends on and the findings it closes, cited as SKILL.md "ID conventions" says: "(REV-1, FB-2, #412)", or "(REV-1, FB-2, export-03)" without a ticket.
- Close the list with the tests that cover the journey: which machine tests cover which states, which component tests cover which surfaces, and which end-to-end test runs the main path through to undo.

## Priority

Use P0–P3. Write the proposal's **Recommended priority** in this order:

1. Bold priority first ("**P1.**"; with a stopgap, "**P1, with #418 shipped first as a P0 fix.**").
2. The realistic trigger and its consequence: what ordinary use hits it and what it costs ("Enter starts a 30-item export that overwrites files already in the folder").
3. Recoverability: an intended, undoable write ranks lower than silent loss.
4. Frequency relative to sibling flows ("less frequent than single-report export, which is P0").
5. The delivery order: the smallest independent high-value slice first (often a UI-only slice with no backend dependency, or the in-place write → re-read → result → undo loop), then the rest. Order slices so no intermediate release breaks an owner rule: when a backend fix would change outcomes before the rule that governs them exists, the rule ships first. Write it as a numbered list, one slice per item in the form `<n>. **<Slice name> (<library or backend work it needs>).** <what ships>. Resolves <findings>.`, then one paragraph starting `Seams:` naming what each slice takes from or waits for in other flows. Implementation files one ticket per item from this list.

The level is the redesign's priority under [Tracker restructure](#tracker-restructure); use the reasoning above to explain it and to order the slices.

## Research notes for a risky flow

Write `<docs>/ux-flows/proposals/<key>-research.md` before the proposal when a flow can damage data or its behavior is contested (the owner and the findings disagree on whether it is a defect). Use the proposal's front matter, then:

- Title `# <Flow title>: research`, a links line (`Proposal: [<Flow title>](<key>.md). Shared patterns: [UX pattern reference](../patterns.md).`), and a scope line naming the journey from first intent to finished, undoable outcome and the operations involved.
- An evidence line pinning the revision of every repository read and defining the tags: "'Verified' means read in code or tests at those revisions; 'Hypothesis' means inferred and not tested." Tag every claim, and give each hypothesis the condition under which it holds.
- The owner-confirmed product rule, quoted, followed by the reframed gap ("The ordering rule is intended, not a defect; the gap is the missing warning and the missing review around it."). Do not draft a fix for intended behavior.
- **Today's flow, step by step:** entry points, the surface, the backend's internal sequence as numbered steps, results, failures and undo, with a `path:line` citation for every step, backend internals included.
- **The contested behavior:** a bold headline claim with its tag, supporting evidence, and negative searches recorded as evidence ("No retry logic exists in `internal/export/` (searched for retry, backoff, resume)."). List what the behavior means in practice as numbered, tagged consequences. Note reusable capabilities with their quantitative limits. Put other products' behavior in its own subsection, cite their documentation, and mark anything unverified as general knowledge.
- **What else changes:** a table with columns `Data | Today | Evidence`, one row for every data item the operation changes, each with code citations. It exposes side effects the UI must surface, such as a changed file mode, dropped metadata or a cleared status flag.
- **Related tickets:** a table with columns `Ticket | Source | One line`, where Ticket is cited as SKILL.md "ID conventions" says, Source is the originating finding ID and the one-liner classifies the ticket as core, feeds this flow, dependency or adjacent; then name the other redesign tickets that hold pieces of this journey.
- **Open questions:** numbered and bold-titled, each with what is unknown, why it matters, the evidence needed to close it, a proposed default, and who decides. Carry each into the pattern reference's product decisions (`O<n>`) or a rule, then update the proposal when it is decided.

## The redesign ticket

One per flow, filed when tickets are in scope, after the proposal and both diagrams exist and the flow's docs are published (SKILL.md "Scope boundaries"). Until it is filed, the wireframe nav and docs index row read "not filed yet", and the report lists the flow.

- It references the proposal, both diagram pages and the wireframe at their published repository locations, never a local preview URL.
- It carries the proposal's acceptance criteria verbatim, as [Acceptance criteria](#acceptance-criteria) produces and checks them.
- Its covers list is the proposal's **Tickets resolved**, with the same `Resolves:` and `Related, not covered:` entries. The list matches `<state>/assignments.md`; a mismatch fails the Phase 6 gate.
- A diagram image it carries is a render of the committed spec it shows. A changed spec makes the image stale: re-render it from the committed spec, inspect it, and upload it through `issue-tracker` in place of the old one. In Phase 8 the integration step does this for every diagram it regenerates ([shape D](orchestration.md#d-reconcile), Integrate).

When Phase 7 decisions, owner reversals or Phase 8 conformance change the proposal, regenerate the ticket's criteria and covers from it in the same pass, drop withdrawn `CC-n` items and resolved `**[discuss]:**` items, and search the ticket for wording of the superseded framing.

## Tracker restructure

Once redesign tickets exist they become the work. Apply the restructure whenever tickets are in scope, without asking: its links and priorities are derived bookkeeping and reversible. Skip it only when the project's instructions forbid it. Make each change through `issue-tracker` and list the changes in the report.

- Each open finding under a redesign's `Resolves:` ([Tickets resolved](#the-proposal)) is blocked by that redesign, so it stops being claimable as patch work and becomes the redesign's acceptance evidence. A partially covered finding is blocked by every redesign that resolves a slice of it. A finding under `Related, not covered:` is never blocked by the redesign that lists it, only by the redesigns that resolve it. So the blockers on a finding are exactly the redesigns that resolve it.
- A finding another worker has already claimed stays out of the restructure, the same as a stopgap: the redesign lists it under `Related, not covered:` with the claimed work as its owner, adds no blocker to it, and takes no priority from it. Check claims through `issue-tracker` when applying the restructure; a finding whose claim is released later is assigned again by the next restructure.
- Each non-foundation redesign is blocked by the foundation redesigns: the cross-cutting flows the others build on, typically selection, background work and activity, and undo and history. Another example is a command foundation: each action is declared once, with its label, group, shortcut, an "applies when" check and a "disabled because" reason, and that one declaration is rendered in menus, the command palette, the shortcut bar and the key handler. These are examples; name the foundations the product's flows actually build on. Between foundations, add a blocker only when one cannot start any slice without the other. When the coupling runs both ways through seams (one reads the other's model; the other registers into the first), add no blocker in either direction, because a ticket-level blocker would hold slices that do not depend on it; record each seam and the slice that waits for it in both proposals.
- Each redesign carries exactly the highest verified priority among the open findings under its `Resolves:`. Recompute it on every restructure and whenever a covered finding's priority changes, including the owner's own change, and set it up or down to match; keep the proposal's priority paragraph at the same level in the same pass. The restructure never changes a finding's priority; raising the severity of a finding this run filed follows [review](review.md#verification) "Verification".
- Findings no redesign resolves keep their priority and stay claimable; bugs that damage data now get [stopgaps](#stopgaps) ahead of their redesign.

## Linking the ticket

Once the redesign ticket exists, link it from the four places below and record each link in the flow's checkpoint; the flow is done only when all four are recorded.

| Link | File |
| --- | --- |
| Wireframe nav | `<docs>/ux-flows/wireframes/<key>.html` |
| Wireframe index card | `<docs>/ux-flows/wireframes/index.html` |
| Proposal metadata line | `<docs>/ux-flows/proposals/<key>.md` |
| Docs index row | `<docs>/index.md` |

A scaffold run with `--ticket-url` filled the nav, the card and the row; it writes only the label into the proposal, so make that a link by hand. For a ticket filed after scaffolding, edit all four by hand: the nav's "Redesign ticket: not filed yet" span becomes a link, the card gains a link in its `.links`, and the row's "not filed yet" becomes `[<label>](<ticket URL>)`.

In a public project, where issue-tracker keeps tracker identity out of commits, link nothing: the nav's span and the proposal's metadata line read "Redesign ticket: tracked privately", the card keeps no ticket link, and the row reads "tracked privately". Record the four as done once they read so; the `nav-ticket` lint warning stays, as expected there.

## Stopgaps

- File a standalone stopgap only for a bug that damages data now and cannot wait for the redesign. Everything else is covered by the redesign.
- Confirm under the product rule that the behavior is a defect first. A stopgap that refuses an intended action is wrong; a hazard of intended behavior gets a warning in the redesign instead.
- The stopgap's fix matches what the redesign specifies, so the redesign builds on it instead of undoing it.
- It is its own ticket. List it under the redesign's `Related, not covered:` as resolved by the stopgap, never under `Resolves:`, so the redesign does not block it and it ships first; name it in the priority line ("P1, with #418 shipped first as a P0 fix"), cited like a finding (SKILL.md "ID conventions").
