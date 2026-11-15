---
name: ux-flow-redesign
description: Use when reviewing an application's user experience across many features or flows, filing UX findings with annotated screenshots, redesigning whole user flows instead of patching individual issues, or producing current and proposed flow diagrams, written flow proposals, low-fidelity HTML wireframes, redesign tickets, or a shared UX pattern reference that keeps flow designs consistent.
author: alexgorbatchev
metadata:
  created_on: 2026-11-15 07:14
  last_modified: 2026-11-15 09:29
  status: current
---

## Execute the task

1. Identify the phases and flows the request covers. A full effort runs every phase below in order for every flow in scope. A narrower request ("review the UX and file tickets", "draw wireframes for these flows", "write a pattern reference") runs only the requested phases for the named flows, plus the earlier phases those flows lack. Inspect existing artifacts first and reuse valid ones; never redo a delivered unit.
2. When a missing prerequisite would expand the work substantially (for example a full live review before drawing five wireframes), offer the owner ID'd options: run the prerequisites for the named flows only, work in provisional mode, or run the full effort. Meanwhile do the work that needs no decision. **Provisional mode:** the proposal and wireframe are drawn from existing evidence (code, open tickets, the owner's notes) without a live review or a pattern reference; each carries the status line "Provisional: drawn from existing evidence, without a live review or the pattern reference"; the current flow may be a step table rendered into `<key>-current.html` ([diagrams](references/diagrams.md) "Without Archify") citing evidence instead of tickets; nothing is filed; the Phase 4 ticket rule does not apply; Phase 8 conforms these flows once a reference exists.
3. Establish the inputs under **Setup**.
4. Read [lessons](references/lessons.md) once before the first phase you run.
5. Read [orchestration](references/orchestration.md) before the first unit of any phase, parallel or not; it owns unit keys, checkpoints, receipts, the ticket filer and resume.
6. Run the phases. Gates apply per unit (one flow, area, dimension or lens): a failed or blocked unit blocks only the units that depend on it. Record its blocker and unblock condition in its checkpoint, continue the others, and report it; the effort is not complete while any unit is blocked.
7. Deliver under **Report to the owner**.

Scope boundaries:

- This skill designs and specifies. Implementing a redesign is separate work under the project's engineering workflow.
- A review-only request produces findings and tickets, not redesigns. A design-only request files no tickets unless asked.
- File into a tracker only when the request or the project's instructions designate it. A review request that does not mention tickets files into the tracker only when the project's instructions route findings there; otherwise write Markdown tickets (see **Adapting**). When a request asks for tickets but names no tracker, ask once as an ID'd question with Markdown tickets as the recommended default, run the units meanwhile, and hold only their delivery until the answer or the end of the run.
- Product calls that evidence cannot settle go to the owner as decisions (Phase 7), never resolved silently.
- Commit and push design artifacts only through the project's Git workflow and its authorization; [Filing](references/proposals-and-tickets.md#filing) owns the commit-before-filing rule. Units do not commit; the orchestrator publishes their files serially, except Phase 8's delivery stage, which commits only its flow's files on the run branch. Before every commit, push, release or ticket change, re-check that this run still holds the task's claim.

## Setup

Write these into `<state>/ux-flows/setup.md` before Phase 1. When one is missing and it changes the result, ask; otherwise use the stated default and record it.

- **Product direction and owner rules.** Read the project instructions for product direction, binding contracts and stated intent ("a longer replacement is intended, not a defect"). Every review and design agent receives them. Owner corrections made during the effort become rules in the project's instructions where design agents work and in every later agent's shared context.
- **Feature roster.** The project's list of features with stable IDs. Without one, Phase 1 builds an inventory and assigns IDs.
- **Tracker.** Where findings and redesign tickets go, with epics or labels, per the scope rule above.
- **Docs site.** The directory the project serves locally and how it is served (see [publishing](references/publishing.md)).
- **Diagram tool.** Archify, through the Archify skill, by default; see [diagrams](references/diagrams.md) for alternatives.
- **Evidence environment.** A current build of the app from a clean checkout, disposable test data shaped like real use, a browser automation tool for screenshots, and one isolated app instance per concurrent reviewer.
- **Capacity.** Whether parallel agents are available, and how many app instances the machine can run.
- **State directory.** `<state>` is the project's ignored durable state directory (for example `.state/`), never session temp or a scratch directory that gets cleaned.

## Artifact layout and naming

Pick one flow key per flow: kebab-case, stable, used in every file name. `<docs>` is the served docs directory.

| Artifact | Path |
| --- | --- |
| Current-flow diagram spec and render | `<docs>/ux-flows/<key>-current.json` and `.html` |
| Proposed-flow diagram spec and render | `<docs>/ux-flows/<key>-proposed.json` and `.html` |
| Written proposal | `<docs>/ux-flows/proposals/<key>.md` |
| Research notes for a risky flow | `<docs>/ux-flows/proposals/<key>-research.md` |
| Wireframe page | `<docs>/ux-flows/wireframes/<key>.html` |
| Shared stylesheet | `<docs>/ux-flows/wireframes/wireframe.css` |
| Wireframe index (cards, conflicts list) | `<docs>/ux-flows/wireframes/index.html` |
| Pattern reference (full text) | `<docs>/ux-flows/patterns.md` |
| Pattern reference (visual) | `<docs>/ux-flows/wireframes/patterns.html` |
| Markdown tickets, when there is no tracker | `<docs>/ux-flows/tickets/<id>.md` and `tickets/index.md` |
| Built inventory, when there is no roster | `<docs>/ux-flows/inventory.md` |
| Docs index section | "UX flows" section of `<docs>/index.md` |
| Setup notes, flow table, finding assignments | `<state>/ux-flows/setup.md`, `flows.md`, `assignments.md` |
| Unit checkpoints, drafts and delivery receipts | `<state>/ux-flows/units/<unit-key>.json`, `<state>/ux-flows/units/<unit-key>/` (drafts such as `ticket.md`), `<state>/ux-flows/receipts/<unit-key>.json` |
| Findings, verdicts, audits, critiques | `<state>/ux-flows/findings/`, `<state>/ux-flows/patterns/` |
| Screenshots | `<state>/ux-flows/shots/<unit-key>/` (tracker attachments, never committed) |

Add the diagram tool's delivery receipts (`<docs>/ux-flows/*.delivery.json`) to the project's ignore rules: they hold absolute local paths.

## ID conventions

| ID | Form | Assigned in |
| --- | --- | --- |
| Feature | the roster's own IDs | project roster or Phase 1 inventory |
| Finding | `<area>-NN` | Phase 2; becomes a ticket number when filed to a tracker |
| Flow key | kebab-case | Phase 1 |
| Unit key | `review-<area>` (Phase 2 review, verify, deliver), `verify-<ticket>` (re-verifying a filed ticket), `flow-<key>` (Phases 4 and 6), `audit-<dimension>`, `critique-<lens>`, `reference` (Phase 5), `reconcile-<key>` (Phase 8), `integrate`, `critic` | when a unit starts; a skip list holds unit keys whose last stage is done |
| Markdown redesign ticket | `redesign-<key>` | Phase 6, without a tracker |
| Pattern rule | `<PREFIX>-n`, for example `SEL-3`, `MENU-8`, `REV-8`; an inserted rule takes a letter suffix (`REV-1a`); a withdrawn rule keeps its number | pattern reference section 2 |
| Audit decision | `<dimension>-NN`, for example `selection-01` | Phase 5 audits, kept in the decision log |
| Contract change | `CC-n` | pattern reference section 2.14 |
| Product decision | `O1`, `O2`, … | pattern reference section 5 |
| Critique note | `<LENS>-n`, for example `A11Y-4`, `ENG-2`, and a domain-user prefix | pattern reference section 6 |
| Owner question or action | `q1`, `a1`, … with nested options `q1a1` | reports to the owner |
| Wireframe callout | `1`, `2`, … per step | wireframe captions |

Proposals, wireframes, tickets and tests cite rule IDs. Never renumber or reuse an ID.

## Phases

### Phase 1: Inventory flows and check coverage

- **Inputs:** the roster, the app's routes, menus and commands, the owner's vocabulary.
- **Do:** List every user journey in scope: one flow per tool or task, cross-cutting flows (selection, progress and jobs, undo and history), and one or more end-to-end journeys that cross tools ("from new material to a finished deliverable"). Map every roster feature in scope to exactly one owning flow; match the owner's vocabulary to the app's labels. Rank flows by the risk they pose to the owner's data and work.
- **Output:** `<state>/ux-flows/flows.md`: one row per flow `{key, title, roster IDs, scope sentence (entry, steps, end states), evidence areas, epic or bucket, risk}`.
- **Gate:** every in-scope roster feature maps to one flow or is listed as out of scope with a reason; a capability reached from several flows has one owner that holds its whole journey, and the others hand off to it.

### Phase 2: Review the real app and file findings

Read [review](references/review.md) before starting.

- **Inputs:** the flow table, the evidence environment, a digest of open tickets.
- **Do:** Split the review into units of one area (a slice of roster features) or one end-to-end journey. Each unit exercises every flow in its brief in the running app against disposable data, captures annotated screenshots with `assets/annotate.js`, grounds each problem in code, and writes a findings file checked by `scripts/validate-handoff.ts findings`. An independent verifier tries to refute each unit's findings and reproduces every P0 and P1. Each unit files its own tickets, one epic per area, as soon as it is verified. A completeness pass then looks for uncovered surfaces and runs them as new units.
- **Output:** epics and finding tickets with screenshots, reproduction steps, proposals and acceptance criteria; a coverage list per unit.
- **Gate (per unit):** a validated findings file, a verdicts file and filing receipts. **Phase gate:** the completeness pass found nothing new, or its gap units passed.

### Phase 3: Decide what to redesign

Read [proposals and tickets](references/proposals-and-tickets.md) (Priority, Stopgaps, Filing) before deciding.

- **Inputs:** the flow table, the filed findings and their verdicts.
- **Do:** Group findings by flow. For a flow that will be reworked, plan one redesign ticket that absorbs its findings: each covered finding becomes acceptance evidence for the redesign instead of separate patch work. Name the foundation redesigns (cross-cutting flows the others build on). Allow standalone stopgaps only for bugs that damage data now; their fix matches what the redesign specifies. Once redesign tickets exist, restructure the tracker as Filing describes: covered findings blocked by their redesign, other redesigns blocked by the foundations, each redesign at the highest priority among its covered findings, no priority ever lowered. That changes the owner's queue: do it when the request or the project's instructions authorize it; otherwise propose it as an ID'd action.
- **Output:** `<state>/ux-flows/assignments.md`: each finding assigned to one redesign, a stopgap, or "patch, no redesign".
- **Gate:** no finding is orphaned or claimed by two redesigns; partial covers state which slice each ticket owns.

### Phase 4: Diagram today's flows from code

Read [diagrams](references/diagrams.md) and load the Archify skill before writing a spec.

- **Inputs:** the flow table, findings and their tickets, the code at a pinned revision.
- **Do:** For each flow, trace the journey as the code implements it (entry points, screens, dialogs, decisions, confirmations, waits and jobs, results, recovery, undo, dead ends) and draw a current-flow diagram from `assets/templates/current-flow.workflow.json`. Mark each evidenced pain point on its step with its finding ticket; cite source ranges for primary steps.
- **Output:** `<key>-current.json` and its render.
- **Gate (per flow):** no `{{` left in the spec; the diagram tool's validation and render pass with repository evidence; every pain point names a ticket.

### Phase 5: Build the shared pattern reference before parallel design

Read [pattern reference](references/pattern-reference.md) before starting, and [design language](references/design-language.md) before drawing the visual page.

- **Inputs:** the current app, the findings, existing proposals or wireframes, the project's contracts and component library.
- **Do:** Before agents design flows in parallel, write one reference for the cross-cutting patterns: selection, summary and command bars, menus and entry points, surfaces, review before write, external write locks, progress and outcome feedback, failures, undo and history, background work, the keyboard map, wording, and empty, loading and error states. Build it from audits by dimension over the current app, the findings and any existing proposals; one author synthesizes; critics review it through a domain-user lens, an accessibility lens and a backend-contract lens; the author revises and records every critique note. Publish `patterns.md` and its visual page.
- **Output:** `patterns.md` with rule IDs, decision log, per-flow conformance, contract changes, product decisions and review notes; `wireframes/patterns.html`.
- **Gate:** every audit decision with a conflict or silent flows has a log entry; every critique issue is applied or rejected with a reason; the visual page lints clean.

### Phase 6: Design each flow

Read [proposals and tickets](references/proposals-and-tickets.md) and [design language](references/design-language.md) before the first flow.

- **Inputs:** the flow's current diagram, its findings and assignments, the pattern reference.
- **Do:** For each flow: draw the proposed-flow diagram, write the proposal, draw the wireframe page, and draft the redesign ticket at `<state>/ux-flows/units/flow-<key>/ticket.md`; file it only when tickets are in scope. Cite rule IDs; when the flow needs to differ from a rule, propose the exception in the reference instead of inventing a divergent pattern. Draw one exemplar flow first, check it rule by rule against the reference, and only then give it to parallel designers. While drawing, record every cross-flow disagreement in the wireframe index's conflicts list. Before filing a ticket that links the flow's docs, the orchestrator publishes them (see **Scope boundaries**); after filing, link the ticket from the wireframe nav, the index card, the proposal and the docs index.
- **Output:** per flow: `<key>-proposed.json` and render, `proposals/<key>.md`, `wireframes/<key>.html`, a filed redesign ticket with both diagram renders attached (or a Markdown ticket), and the links back to it.
- **Gate (per flow):** no `{{` left in any of the flow's files; the proposed diagram validates and renders, or its exception is recorded; `scripts/lint-wireframes.ts` reports no errors for the page; the proposal and ticket cite the rule IDs their criteria depend on; the ticket's covers list matches `assignments.md`; when tickets are in scope, the filing receipt and the post-filing links are recorded in the flow's checkpoint; otherwise the draft exists, the nav reads "not filed yet", and the report lists the drafts.

### Phase 7: Settle product decisions with evidence and the owner

Read [pattern reference](references/pattern-reference.md) (Fact-checking, Product decisions, Owner review) before starting.

- **Inputs:** the reference's open calls, the conflicts list, the owner's stated rules.
- **Do:** Settle what evidence can settle: read the owning component's stated intent before calling behavior a defect, and measure defaults on representative real inputs (a calibration ladder) instead of guessing; a measurement can expose a broken instrument, which then blocks the default. Record each remaining product call as `O<n>` with a recommended default. Present the owner a short ID-addressable list of the decisions that change how the product feels day to day: today, proposed, rule IDs. Ask unclear answers back with today against the proposal and the cost.
- **Output:** decided `O<n>` entries with evidence; a "product owner review" subsection in the reference recording each answer as approved, reversed (with what replaces it and which contract change is withdrawn), needs clarification, or a new rule; the revision bumped.
- **Gate:** every reviewed decision is settled and recorded. Reconciliation starts only then; until then, report the pending IDs as the blocker and continue work that does not depend on them.

### Phase 8: Reconcile everything with the reference

Read [orchestration](references/orchestration.md) (shape D), [pattern reference](references/pattern-reference.md) (Owner review), [design language](references/design-language.md), [diagrams](references/diagrams.md) and [proposals and tickets](references/proposals-and-tickets.md) (The redesign ticket, Filing) before conforming a flow.

- **Inputs:** the current reference revision and its per-flow conformance lists, every flow artifact, the owner's answers.
- **Do:** Per flow: reconcile the proposal, wireframe, proposed diagram spec and a ticket draft with the reference (with before and after screenshots); two independent reviewers check it, one for reference conformance and consistency across the flow's artifacts, one for the design language and rendering; fix, re-checking only blockers and majors, for at most two rounds; then deliver it with any unresolved issues listed: commit only its files on a run branch in a dedicated worktree, push the branch, update the ticket body and comment with evidence, and restructure the tracker for it. After all flows, one integration step regenerates the changed diagrams, updates the shared index files and the reference's conformance section, runs the checks, rebases and lands; a completeness critic then checks every flow. Carry every reversal to every artifact that stated it, and search all artifacts for wording of the superseded framing.
- **Output:** conformed artifacts; an empty or decided conflicts list on the wireframe index.
- **Gate:** the critic reports every flow complete; every conformance item is done or recorded as an exception in the reference; unresolved review issues are listed on their tickets and in the report.

### Phase 9: Publish and verify

Read [publishing](references/publishing.md) before the first publication.

- **Inputs:** every artifact, the served docs site.
- **Do:** Link everything from the docs index (diagrams, wireframes, proposals, reference, Markdown tickets). Serve the docs locally, run the docs-site tests, `scripts/lint-wireframes.ts` over the wireframes and `scripts/crawl-site.ts` over the served site, and capture before and after screenshots for every visual change to existing pages. Check that no index row says "not filed yet" for a flow whose ticket receipt exists.
- **Output:** a served site where every page is linked and reachable, plus verification evidence.
- **Gate:** the linter reports no errors; the crawl reports no broken links, missing fragments or unlinked files; the docs-site tests (or the direct checks that replace them) pass, including a 200 `text/css` response for `wireframe.css`; the privacy scan has no unreviewed hits; no delivery receipt is tracked; the screenshots were inspected. Any run that wrote docs pages, review-only runs included, runs the crawl before reporting.

## Scripts

Run them with Bun from the project root as `bun <skill>/scripts/<name>.ts`, where `<skill>` is this skill's directory; pass project paths relative to the project root or absolute.

| Script | Use |
| --- | --- |
| `scaffold-flow.ts --docs <docs>/ux-flows --init --product "<Product>" [--docs-index <docs>/index.md]` | Create the stylesheet, wireframe index, visual and written pattern reference, and the docs index section; never overwrites |
| `scaffold-flow.ts --docs <docs>/ux-flows --key <flow-key> --title "<Flow title>" --product "<Product>" [--ticket-url <url-or-tickets/<id>.md> --ticket-label "<label>"] [--docs-index <docs>/index.md] [--repo-root <dir>]` | Create a flow's wireframe, proposal and diagram specs, and link it into the wireframe index and docs index. Fills keys, titles, timestamps, the repository URL and revision; a Markdown ticket path is taken relative to `<docs>/ux-flows` and rebased per file; without a ticket the nav reads "not filed yet". Prints every placeholder left to fill: fill them all |
| `lint-wireframes.ts [--stylesheet wireframe.css] [--site-root <docs>] [--json] <docs>/ux-flows/wireframes` | Check pages against the design language (rules in [design language](references/design-language.md)); exits 1 on errors |
| `crawl-site.ts <url> [--root-dir <docs>] [--ignore <regex>] [--insecure] [--external] [--json]` | Report broken links, missing fragments and files no page links; run as `bun --use-system-ca …` when the local site uses a locally trusted certificate |
| `validate-handoff.ts <findings\|verdicts\|audit\|critique> <file> [--feature-pattern <regex>]` | Validate a unit's handoff file. Fix and rerun at most three times; if it still fails because of the environment (for example screenshots cannot be captured), return the validator output as an environment issue and mark the unit failed for re-queue |

## Adapting

- **No Archify:** follow the alternatives in [diagrams](references/diagrams.md); the current and proposed pair, code citations and ticket marks still apply.
- **No tracker:** write Markdown tickets as described under "Markdown tickets" in [proposals and tickets](references/proposals-and-tickets.md); idempotent receipts still apply.
- **No parallel agents:** see [orchestration](references/orchestration.md) "Without parallel agents".
- **No docs site:** serve with the template server (see [publishing](references/publishing.md)). Opening the HTML files directly is only a preview and does not satisfy Phase 9.
- **No feature roster:** Phase 1 writes `<docs>/ux-flows/inventory.md` with IDs, linked from the docs index, so later phases can cite it.
- **Not a web app:** the wireframe vocabulary still applies to desktop, terminal and mobile flows; draw the frame the product uses and keep the legend's meanings.

## Report to the owner

- What was delivered: epics and tickets created (from receipts), ticket drafts not filed, commits made and files left uncommitted, pages and their clickable preview URLs (when pages were produced), the file layout, how to open pages offline, and how to restart the docs server.
- Coverage: units reviewed, areas with no findings, coverage you capped or dropped and why, environment issues.
- What is not done: failed or blocked units with their unblock condition and next action, owner decisions still awaited, and work held behind them.
- Open questions and decisions as short ID-addressable items with a recommendation; when re-listing one later, restate enough context to answer it cold.
- Verification coverage stated honestly: which pages had visual inspection and which passed automated checks only; correct earlier claims explicitly when evidence changes them.
- Keep private hostnames, credentials and personal data out of tracked files and ticket bodies; derive local URLs from the running service.
