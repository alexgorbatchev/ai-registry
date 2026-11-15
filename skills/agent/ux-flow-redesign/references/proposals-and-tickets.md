# Writing flow proposals and redesign tickets

- [Design heuristics for the proposed flow](#design-heuristics-for-the-proposed-flow)
- [The proposal](#the-proposal)
- [Acceptance criteria](#acceptance-criteria)
- [Priority](#priority)
- [Research notes for a risky flow](#research-notes-for-a-risky-flow)
- [The redesign ticket](#the-redesign-ticket)
- [Filing](#filing)
- [Markdown tickets](#markdown-tickets)
- [Stopgaps](#stopgaps)

Use this in Phase 3 (assigning findings to redesigns), Phase 6 (designing each flow) and Phase 8 (re-syncing tickets). Examples use an invented reporting app with reports, exports, documents and folders; they are illustrative only.

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
- **Warn about hazards of intended behavior; do not gate them.** When the owner's rule makes an action intended, put the warning at the point of choice and in the result, and keep the action available. Check the owning component's stated intent before treating behavior as a defect.
- **Respect binding contracts.** Keep the project's protections (external write locks, confirmations before destructive actions, snapshot and undo guarantees, data-ownership boundaries). Every change the design needs to a contract or the backend is called out under **Backend and contract changes**, never implied.
- **Cite the pattern reference.** Use its rule IDs in steps and criteria. When the flow must differ from a rule, propose the exception for the reference and add the disagreement to the wireframe index's conflicts list; do not invent a divergent pattern. When the reference lacks a pattern the flow needs, propose a new rule for it.

## The proposal

`bun <skill>/scripts/scaffold-flow.ts --key` creates `proposals/<key>.md` from [proposal.md](../assets/templates/proposal.md) and fills the timestamps, the flow key and title, the repository name and its current `HEAD`, and the ticket label when `--ticket-label` or `--ticket-url` is passed. Fill every remaining `{{PLACEHOLDER}}` and delete the ones the template marks optional.

Front matter and opening lines:

- **Front matter.** Exactly `created_on`, `last_modified` (local time, `YYYY-MM-DD HH:MM`) and `status: current`. Update `last_modified` on every edit.
- **Title.** `# <Flow title>: proposed experience`, or `# <Flow title>: proposed <target in a phrase>` when that names the target better.
- **Links line.** Current and proposed diagram renders and the wireframe. When a visual does not exist yet, say so ("Diagrams and wireframe: not generated yet.") and link the research notes if they exist.
- **Status line.** Keep it verbatim: `Status: design proposal, not implemented behavior. The [shared UX pattern reference](../patterns.md) wins where this proposal disagrees with it.`
- **Source revision, features, ticket.** The revision you actually read (the scaffold records `HEAD` at scaffold time; correct it if you read a different one), the roster IDs the flow owns, and the redesign ticket. The ticket is filed after the proposal; replace the label with a link once it exists (step 6 of [Filing](#filing)).
- **Product rule (optional).** When a binding contract governs the flow, quote it and say where it lives, then name the behaviors it makes intended and end with the reframed gap: "The ordering rule below is intended, not a defect; the gap is the missing warning and the missing review around it."

Sections, in template order:

- **Target experience.** One paragraph telling the journey end to end from the person's side: where it starts, what stays in place, what the primary button says, how progress, the outcome and undo appear. End with `Benchmarks:` naming each product and what it contributes.
- **Target steps.** Numbered steps, each opening with a bold step name ending in a period. Each step says what the person does, sees and gets, then the backend operation in backticks with its effect class, exactly `read only` or `one protected write`: "3. **Preview the export (`export.plan`, read only).**"
  - Put example copy in quotes for every label, header and outcome sentence ("12 reports · 9 ready · 2 missing data · 1 failed").
  - State defaults ("Ready reports start selected; failed ones start cleared.").
  - List keys inline ("Keys: ↑/↓ move, X toggles, Shift-click selects a range, Mod+A selects all ready, Enter focuses the footer button.").
  - State external-lock behavior per surface, following the reference's lock rules: what stays usable, what waits, and that drafts and plans survive.
  - Write recovery as in-place actions ("Retry 1 failed", "Undo this export"), never as "go to page X".
- **Branches and edge states.** One bold-labeled bullet per alternate gesture or keyboard path, per external lock or unavailable backend, per partial or lost result (counts, per-item reasons, recovery without replaying the write), and per undo that needs review.
- **What changes versus today.** `Removed`, `Merged` ("Preview and Export become one plan → export flow."), `New`, `Changed` (behavior that flips relative to today) and `Kept`. `Kept` is the safety inventory that stops a redesign from silently dropping protections: walk the current-flow diagram and list every confirmation, lock, refusal, snapshot and undo record that survives. A protection that does not survive is listed under `Removed` with what replaces it.
- **Tickets resolved.** Findings grouped by priority ("P0: #n. P1: #n (export part only)."), then `Not resolved here:` with the ticket that owns each, and when relevant `Removed from this journey:` (findings that leave the journey, and why) and `Moves out of other flows:` (criteria taken over from a neighboring redesign ticket).
- **Acceptance criteria.** A `- [ ]` list written under [Acceptance criteria](#acceptance-criteria).
- **Backend and contract changes.** Under `**Backend**` (naming the backend and the protection, snapshot and undo contracts it preserves), a numbered list of bold-named changes with field names, parameters and stable error codes, the finding each serves, and a grade: required, recommended or optional later. Under `**Project contracts**`, quote each current contract and its replacement with its `CC-n` from the reference: `"<quoted current text>" becomes: <new text> (CC-3).` Tag unresolved design `**[discuss]:**` and name who must confirm it ("the backend owners must confirm this against the protection contract").
- **Not yet ticketed (seen in code).** Defects found while tracing source, each marked fixed by this redesign or out of scope.
- **Recommended priority.** Written under [Priority](#priority).

## Acceptance criteria

The same rules apply to the proposal and the ticket. Each criterion is one `- [ ]` item an implementer can test without asking:

- Write observable, present-tense behavior with concrete inputs and outputs: "With 12 reports of which 9 are selected, Export writes exactly 9 files and the folder lists them in report order."
- Use exact viewports and counts: "At 1280×800, the query field, the summary strip and the first plan row are visible together without scrolling." Take the viewports from the pattern reference's per-flow conformance section.
- Add a "never" clause for each forbidden path: "Pressing Enter in the query starts `export.plan`, never `export.run`."
- Name the test layer that asserts it: state machine, component, browser or end-to-end, in the project's own terms.
- State red/green intent where a step is easy to drop silently: "A state-machine test fails when the folder re-read after the write is skipped."
- Quote exact copy when the copy is the requirement: the button reads "Export 9 to Archive"; the footer reads "↑↓ Choose · Enter Export · Esc Cancel".
- Make guards and recovery criteria too. Keep a never-replay criterion for every write, phrased for the product's own recovery mechanism (a job resumed by ID, a request retried with its idempotency key, state re-read after a sync): "A lost response resumes the export job by ID and never resubmits the write." Add a blocking-state criterion only when the product has a state that blocks writes: "While the external lock is held, the footer button is disabled with the reason visible without hover, and every plan choice survives until the lock clears."
- End each criterion with the rule IDs it depends on and the finding tickets it closes: "(REV-2, FB-4, #412)".
- Close the list with the tests that cover the journey: which machine tests cover which states, which component tests cover which surfaces, and which end-to-end test runs the main path through to undo.

## Priority

Use P0–P3. Write the proposal's **Recommended priority** and the ticket's **Priority** paragraph in this order:

1. Bold priority first ("**P1.**"; with a stopgap, "**P1, with #418 shipped first as a P0 fix.**").
2. The realistic trigger and its consequence: what ordinary use hits it and what it costs ("Enter starts a 30-item export that overwrites files already in the folder").
3. Recoverability: an intended, snapshotted, undoable write ranks lower than silent loss.
4. Frequency relative to sibling flows ("less frequent than single-report export, which is P0").
5. The delivery order: the smallest independent high-value slice first (often a UI-only slice with no backend dependency, or the in-place write → re-read → result → undo loop), then the rest. Order slices so no intermediate release breaks an owner rule: when a backend fix would change outcomes before the rule that governs them exists, the rule ships first.

The level itself is not a free choice: it is the highest verified priority among the covered findings, never lowered automatically (see [The redesign ticket](#the-redesign-ticket)). Keep the proposal's and the ticket's paragraphs at that level, and use the reasoning above to explain it and to order the slices.

## Research notes for a risky flow

Write `<docs>/ux-flows/proposals/<key>-research.md` before the proposal when a flow can damage data or its behavior is contested (the owner and the findings disagree on whether it is a defect). Use the proposal's front matter, then:

- Title `# <Flow title>: research`, a links line (`Proposal: [<Flow title>](<key>.md). Shared patterns: [UX pattern reference](../patterns.md).`), and a scope line naming the journey from first intent to finished, undoable outcome and the operations involved.
- An evidence line pinning the revision of every repository read and defining the tags: "'Verified' means read in code or tests at those revisions; 'Hypothesis' means inferred and not tested." Tag every claim, and give each hypothesis the condition under which it holds.
- The owner-confirmed product rule, quoted, followed by the reframed gap ("The ordering rule is intended, not a defect; the gap is the missing warning and the missing review around it."). Do not draft a fix for intended behavior.
- **Today's flow, step by step:** entry points, the surface, the backend's internal sequence as numbered steps, results, failures and undo, with a `path:line` citation for every step, backend internals included.
- **The contested behavior:** a bold headline claim with its tag, supporting evidence, and negative searches recorded as evidence ("No retry logic exists in `internal/export/` (searched for retry, backoff, resume)."). List what the behavior means in practice as numbered, tagged consequences. Note reusable capabilities with their quantitative limits. Put other products' behavior in its own subsection, cite their documentation, and mark anything unverified as general knowledge.
- **What else changes:** a table with columns `Data | Today | Evidence`, one row for every data item the operation changes, each with code citations. It exposes side effects the UI must surface, such as a changed file mode, dropped metadata or a cleared status flag.
- **Related tickets:** a table with columns `Ticket | Source | One line`, where Source is the originating finding ID and the one-liner classifies the ticket as core, feeds this flow, dependency or adjacent; then name the other redesign tickets that hold pieces of this journey.
- **Open questions:** numbered and bold-titled, each with what is unknown, why it matters, the evidence needed to close it, a proposed default, and who decides. Carry each into the pattern reference's product decisions (`O<n>`) or a rule, then update the proposal when it is decided.

## The redesign ticket

After the proposal and both diagrams exist, draft the body from [redesign-ticket.md](../assets/templates/redesign-ticket.md) at `<state>/ux-flows/units/flow-<key>/ticket.md` and delete its leading comment. File it only when tickets are in scope ([Filing](#filing)); until it is filed, the wireframe nav and docs index row read "not filed yet", and the report lists the draft. The filer embeds the marker `<!-- ux-flow: <unit-key>:<item-id> -->` in every body it files and searches for it before creating ([orchestration](orchestration.md#delivery)); keep the marker through every later edit of the body.

- **Title.** Roster IDs first, then `Redesign <journey> as <target experience>`, under about 100 characters. It states the target, not the defect: "F21 F22 F23 Redesign report export as a preview-first plan with inline undo".
- **Labels and epic.** `ux`, `ux-flow` and `priority:<P0–P3>`, in the findings epic of the flow's area (the epic or bucket from Phase 1).
- **Priority.** The highest verified priority among the covered findings. When a verification re-grade raises that highest priority, raise the tracker field (or a Markdown ticket's `Labels:` line) and edit the **Priority** paragraph in the same pass so the ticket does not contradict itself. When a re-grade lowers it, keep the redesign's priority and propose the lower one to the owner as an ID'd action; on approval, change the field and the paragraph together.
- **Attachments.** Both diagram renders, captured, checked and embedded as in [Rendering for tickets](diagrams.md#rendering-for-tickets). A Markdown ticket links the diagram pages instead (see [Markdown tickets](#markdown-tickets)).

Sections:

- **Problem.** A "Today, …" paragraph that walks the current journey in the person's terms, including the workarounds people use. Then `Main pain points:` with one bullet per verified finding, in behavior terms, ending with its ticket and flagging P0s inline ("(#401, P0)"). Name the mechanism when it explains the defect ("the post-write refresh re-reads the folder list only, so the open folder shows stale rows").
- **Current flow.** The current render and one sentence starting "Today:".
- **Proposed flow.** The proposed render, one sentence starting "Proposed:", the target steps and branches as in the proposal, and the line naming the wireframe, the proposal and the conformance sentence: `Conformance: the shared UX pattern reference (<path>, section 4, <flow-key>) wins where this ticket disagrees with it.` Use published repository paths or URLs (see [Filing](#filing)), never a local development URL; a Markdown ticket links them relatively.
- **What changes.** Bold sub-headings `Removed`, `Merged`, `New`, `Changed` (each with "today it is …") and `Kept`, matching the proposal.
- **Acceptance criteria.** As in the proposal. Fill the template's lost-response line (`{{RECOVERS_HOW}}`) whenever the flow writes, and delete its lock line when the product has no state that blocks writes, per the guard and recovery rule in [Acceptance criteria](#acceptance-criteria).
- **Covers.** Two groups:
  - `Resolved by this redesign (epic <epic>):` one bullet per finding, restated as the problem. A finding this ticket resolves only in part says which slice it resolves here and which ticket owns the rest: "#405 Blind writes on Enter (resolved for report export only; scheduled export remains with #431)."
  - "Addressed where they meet this journey (owned elsewhere):" findings this journey touches, each naming its owning redesign ticket.
  - Every finding is covered by exactly one redesign or partitioned between redesigns with each slice's owner named. The list matches the Phase 3 assignment; a mismatch fails the Phase 6 gate.
- **Notes.** Bold run-in paragraphs: **Features** (roster IDs touched; roster entries to add or rename when implemented), **Diagrams** (source paths, the reviewed revision, and what was exercised live versus traced from source), **Related** (neighboring redesigns and findings that leave this journey, with why), **Backend changes** (graded as in the proposal), **Project contract changes** (quoted current text and its replacement), **Seen in code, not yet ticketed**, and **Priority**.

Re-sync after the reference changes. Phase 7 decisions, owner reversals and Phase 8 conformance edits change what implementers must build. Edit the ticket body in the same pass as the proposal: steps, What changes, criteria, contract changes (drop withdrawn `CC-n` items) and resolved `**[discuss]:**` items. Then search the ticket for wording of the superseded framing. Rerunning the filer does not update a filed ticket; edit it in the tracker or edit its Markdown file, and edit an unfiled draft in place.

## Filing

This section owns two authorization rules and, in step 1, the commit-before-filing rule; other references link to them:

- **Where tickets go.** Tickets are in scope only as [SKILL.md](../SKILL.md#execute-the-task) "Scope boundaries" allows. File into a tracker only when the request or the project's instructions designate it; otherwise write [Markdown tickets](#markdown-tickets).
- **Changing the owner's queue.** Blocking existing tickets and moving their priorities changes the owner's queue. Do it only when the request or the project's instructions authorize it; otherwise propose it to the owner as an ID'd action (the links are reversible) and apply it on approval.

Steps:

1. **Commit before filing.** The orchestrator publishes the flow's docs serially through the project's Git workflow, pushing where that workflow authorizes it, before a ticket that links them is filed; in Phase 8 the flow's delivery stage commits them instead ([SKILL.md](../SKILL.md#execute-the-task) "Scope boundaries"). When publishing is not authorized, the ticket says "not published yet" in place of each repository link, and the report lists the tickets to edit once their files are published.
2. File each redesign ticket through the idempotent filer in [orchestration](orchestration.md#delivery), canary first, never by hand-running the tracker's create command. The filer's receipt is the only proof of filing.
3. Open the canary and check its title, labels, epic, images or links, headings and marker; fix the template or filer, then file the rest.
4. The body carries no scratch or loopback URLs, private hostnames, credentials, personal data or raw JSON. In a tracker ticket, image paths are the only local paths, and the filer replaces them with uploaded attachments.
5. Under the queue rule above, restructure the tracker so the redesign tickets become the work:
   - Every open finding a redesign covers gets that redesign as its blocker (or the tracker's equivalent link), so it stops being claimable as patch work and becomes the redesign's acceptance evidence. A partially covered finding is blocked by every redesign that owns a slice of it.
   - Every redesign other than the foundations is blocked by the foundation redesigns: the cross-cutting flows the others build on, typically selection, background work and activity, and undo and history.
   - Raise each redesign to the highest priority among the open findings it covers when that is higher. The restructure never lowers any priority and never changes a finding's priority; a later re-grade follows the **Priority** bullet in [The redesign ticket](#the-redesign-ticket).
   - Findings no redesign covers keep their priority and stay claimable.
   - Bugs that damage data now get small [stopgaps](#stopgaps) ahead of their redesign.
6. Link the ticket from the four places below, and record each link in the flow's checkpoint. A receipt means filed, not done: the flow is done only when its checkpoint records all four links.

| Link | File | Relative path to a Markdown ticket |
| --- | --- | --- |
| Wireframe nav | `<docs>/ux-flows/wireframes/<key>.html` | `../tickets/<id>.md` |
| Wireframe index card | `<docs>/ux-flows/wireframes/index.html` | `../tickets/<id>.md` |
| Proposal metadata line | `<docs>/ux-flows/proposals/<key>.md` | `../tickets/<id>.md` |
| Docs index row | `<docs>/index.md` | `ux-flows/tickets/<id>.md` |

A tracker URL is the same in all four. When `--ticket-url` was passed to the scaffold, it filled the nav, the card and the row, rebasing a relative path for each file; it writes only the label into the proposal, so make that a link by hand. For a ticket filed after scaffolding, edit all four by hand: the nav's "Redesign ticket: not filed yet" span becomes a link, the card gains a link in its `.links`, and the row's "not filed yet" becomes `[<label>](<path>)`.

## Markdown tickets

The format for tickets when no tracker is designated (see [Filing](#filing)).

- **Location and IDs.** One file per ticket at `<docs>/ux-flows/tickets/<id>.md`. A finding ticket's ID is its finding ID (`<area>-NN`); a redesign ticket's ID is `redesign-<key>`. Never renumber or reuse one.
- **File shape.** Front matter with exactly `created_on`, `last_modified` and `status: current`, in local time `YYYY-MM-DD HH:MM`. Then `# <ID> <title>`, using the title from the template's comment. Then one line: `Labels: … · Priority: … · Epic: <area>`. Then the template body, with its leading comment deleted and the filer's `<!-- ux-flow: … -->` marker kept.
- **No embedded images.** Screenshots stay in `<state>/ux-flows/shots/<unit-key>/`, uncommitted ([publishing](publishing.md#where-artifacts-live)), and are listed as plain-text paths relative to the project root with their captions (`Screenshot: .state/ux-flows/shots/<unit-key>/01-plan.png, not committed. <caption>`). A redesign ticket replaces its two diagram embeds with relative links to `../<key>-current.html` and `../<key>-proposed.html`.
- **Index.** `<docs>/ux-flows/tickets/index.md` has the same front matter and an H1, lists every ticket grouped by area (the epic equivalent), marks the foundation redesigns, and is linked from the docs index.
- **Blocking.** Under the queue rule in [Filing](#filing), a covered finding file carries `Blocked by: [redesign-<key>](redesign-<key>.md)`, and a non-foundation redesign file carries `Blocked by:` links to each foundation redesign file.
- **Scaffolding.** Pass `--ticket-url tickets/redesign-<key>.md --ticket-label redesign-<key>` to `scaffold-flow.ts` only when that ticket file already exists, because the linter and the crawl report the link as broken until it does; the path is taken relative to `<docs>/ux-flows` and rebased for each file, and the linter's `nav-ticket` rule accepts `tickets/` links. Otherwise scaffold without them and link the ticket after filing (step 6 of [Filing](#filing)).
- **Checks.** Receipts, the canary and the privacy rules from [Filing](#filing) still apply; the canary is the first file opened on the served docs site. After writing the first ticket file, run the docs-site tests and the crawl (see [publishing](publishing.md)).

## Stopgaps

- File a standalone stopgap only for a bug that damages data now and cannot wait for the redesign. Everything else is covered by the redesign.
- Confirm under the product rule that the behavior is a defect first. A stopgap that refuses an intended action is wrong; a hazard of intended behavior gets a warning in the redesign instead.
- The stopgap's fix matches what the redesign specifies, so the redesign builds on it instead of undoing it.
- File and prioritize it separately from the redesign, list it in the redesign's **Tickets resolved** and **Covers**, and name it in the priority line ("P1, with #418 shipped first as a P0 fix").
