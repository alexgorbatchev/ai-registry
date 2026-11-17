---
name: ux-flow-redesign
description: Use when reviewing an application's user experience across many features or flows, filing UX findings with annotated screenshots, redesigning whole user flows instead of patching individual issues, or producing current and proposed flow diagrams, written flow proposals, low-fidelity HTML wireframes, redesign tickets, or a shared UX pattern reference that keeps flow designs consistent.
author: alexgorbatchev
metadata:
  created_on: 2026-11-15 07:14
  last_modified: 2026-11-17 06:59
  status: current
---

## Execute the task

1. Identify the phases and flows the request covers. A full effort runs every phase below in order for every flow in scope. A narrower request ("review the UX and file tickets", "draw wireframes for these flows", "write a pattern reference") runs only the requested phases for the named flows, plus the earlier phases those flows lack. Inspect existing artifacts first and reuse valid ones; never redo a delivered unit.
2. When a missing prerequisite would expand the work substantially (for example a full live review before drawing five wireframes), offer the owner ID'd options: run the prerequisites for the named flows only, work in provisional mode, or run the full effort. Meanwhile do the work that needs no decision. **Provisional mode:** the proposal and wireframe are drawn from existing evidence (code, open tickets, the owner's notes) without a live review or a pattern reference; each carries the status line "Provisional: drawn from existing evidence, without a live review or the pattern reference"; the current flow may be a step table rendered into `<key>-current.html` ([diagrams](references/diagrams.md) "Without Archify") citing evidence instead of findings; nothing is filed; the Phase 4 citation rule does not apply; Phase 8 conforms these flows once a reference exists.
3. Establish the inputs under **Setup**.
4. Read [orchestration](references/orchestration.md) before the first unit of any phase, parallel or not; it owns unit keys, checkpoints, per-unit delivery and resume. Read [publishing](references/publishing.md) before the first docs write, commit or publication in any phase; it owns where artifacts live, formatting and commit mechanics, serving, the docs-site tests and the privacy scan.
5. Run the phases. Gates apply per unit (one flow, area, dimension or lens): a failed or blocked unit blocks only the units that depend on it. Record its blocker and unblock condition in its checkpoint, continue the others, and report it; the effort is not complete while any unit is blocked.
6. Deliver under **Report to the owner**.

Scope boundaries:

- This skill designs and specifies. Implementing a redesign is separate work under the project's engineering workflow.
- A review-only request produces findings and tickets, not redesigns. A design-only request files no tickets unless asked. "Tickets in scope" elsewhere in this skill means this rule allows them.
- Product calls that evidence cannot settle go to the owner as decisions (Phase 7), never resolved silently.
- Commit and push design artifacts only through the project's Git workflow and its authorization. Units do not commit; the orchestrator publishes their files serially, except Phase 8's delivery stage, which commits only its flow's files on the run branch and never pushes it. The orchestrator also commits `<state>` with every publish and at every phase gate, so the records in Git never lag the published docs; a public project keeps it uncommitted (**Setup**). Publish a flow's docs before filing a ticket that links them; when publishing is not authorized, write "not published yet" in place of each repository link and list those tickets in the report.

## Setup

Write these into `<state>/setup.md` before Phase 1. When one is missing and it changes the result, ask; otherwise use the stated default and record it.

- **Product direction and owner rules.** Read the project instructions for product direction, binding contracts and stated intent ("exports include archived items by design; that is not a defect"). Every review and design agent receives them. Owner corrections made during the effort become rules in the project's instructions where design agents work and in every later agent's shared context; a misunderstanding agents repeat marks a missing rule, recorded the same way.
- **Feature roster.** The project's list of features with stable IDs. Without one, Phase 1 builds an inventory and assigns IDs.
- **Tickets.** Before any ticket read or write, load and follow the `issue-tracker` skill; it owns every tracker operation (where tickets go, their fields and bodies, epics, attachments, blockers, priorities, claims, receipts, duplicate checks and privacy). If it is unavailable, suspend only ticket work, keep findings and proposals (they cite finding IDs, see **ID conventions**), and report what is needed. The workflow files only these tickets:
  - one finding ticket per surviving Phase 2 finding, referencing its annotated screenshots and reproduction steps ([filing](references/review.md#filing));
  - a stopgap ticket in Phase 3, only for a bug that damages data now ([stopgaps](references/proposals-and-tickets.md#stopgaps));
  - one redesign ticket per flow in Phase 6, referencing the rule IDs its acceptance criteria rely on and the findings it covers ([the redesign ticket](references/proposals-and-tickets.md#the-redesign-ticket));
  - an instrument ticket in Phase 7 when a measurement shows the measuring tool cannot produce real values, carrying the calibration ladder ([product decisions](references/pattern-reference.md#product-decisions)).

  Once redesign tickets exist, the [tracker restructure](references/proposals-and-tickets.md#tracker-restructure) changes blockers and priorities. Committed artifacts cite tickets as **ID conventions** says, which differs in a public project.
- **Docs site.** The directory the project serves locally and how it is served (see [publishing](references/publishing.md)).
- **Diagram tool.** Archify, through the Archify skill, by default; see [diagrams](references/diagrams.md) for alternatives.
- **Evidence environment.** A current build of the app from a clean checkout, disposable test data shaped like real use, a screenshot tool for the platform (a browser automation tool for web apps), and one isolated app instance per concurrent reviewer.
- **Capacity.** Whether parallel agents are available, and how many app instances the machine can run.
- **State directory.** `<state>` holds the run's records and is committed to the project, so they are versioned and readable from every clone and machine: `<app-root>/.ux-flow-redesign/`, where `<app-root>` is the reviewed app's directory in a monorepo, else the repository root. It holds the setup notes, flow table, assignments, verification record and run log, owner decision pages' sources, unit prompts and helper tools, unit checkpoints and drafts, findings and verdicts, audits and critiques. Create it in the run's worktree, record its repository-relative path at the top of `<state>/setup.md` and in the run's task record, and give every unit its absolute path in that worktree; later phases resume from it weeks later. When the project's formatters, linters, type checks or source inventories would treat its files as project source, exclude the directory there the way the project excludes generated files. Keep credentials out of it, and private hostnames unless the project's instructions permit them in its repository. In a public project, whose commits must not carry tracker identity (**ID conventions**), keep `<state>` at `<local>/state/` instead and tell the owner it is not in Git.
- **Local directory.** `<local>` holds machine-local working files that are bulky, regenerable or tied to this machine: screenshots, app instances and their data, pinned builds, disposable datasets, the diagram tool's out-dirs, browser state and logs. It is `${XDG_DATA_HOME:-$HOME/.local/share}/ux-flow-redesign/<project>/`, where `<project>` is a stable kebab-case key for the repository plus the scope when the run covers part of it (`reports-app`, `monorepo-billing`); it survives worktree removal and is never committed. Resolve it to an absolute path once, record it in `<state>/setup.md`, and give it to every unit. Records may point at its files by absolute path (handoff validators require absolute screenshot paths); those paths resolve only on this machine, and the tickets carry the annotated screenshots for everyone else. Never use session temp or a scratch directory that gets cleaned for either directory.
- **Resuming an older layout.** When a run's files are all in a per-user directory (an earlier version of this skill) or in a checkout's `.state/ux-flows/`, wait until no unit is running, move the records into `<state>` and the machine-local files into `<local>`, leave a symlink at each moved path so absolute paths already recorded in checkpoints and prompts still resolve, apply the exclusions above, and commit `<state>`.

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
| Built inventory, when there is no roster | `<docs>/ux-flows/inventory.md` |
| Docs index section | "UX flows" section of `<docs>/index.md` |
| Setup notes, flow table and vocabulary, finding assignments | `<state>/setup.md`, `flows.md`, `assignments.md` |
| Phase 9 verification record | `<state>/verification.md` |
| Unit checkpoints and drafts | `<state>/units/<unit-key>.json`, `<state>/units/<unit-key>/` |
| Findings, verdicts, audits, critiques | `<state>/findings/`, `<state>/patterns/` |
| Screenshots | `<local>/shots/<unit-key>/` (never committed) |
| App instances, pinned builds, diagram tool out-dirs, logs | `<local>/` (never committed) |

Add the diagram tool's delivery receipts (`<docs>/ux-flows/*.delivery.json`) to the project's ignore rules: they hold absolute local paths.

## ID conventions

| ID | Form | Assigned in |
| --- | --- | --- |
| Feature | the roster's own IDs | project roster or Phase 1 inventory |
| Finding | `<area>-NN` | Phase 2; its ticket ID, as issue-tracker reports it, is recorded in the unit checkpoint's `tickets` map once filed |
| Flow key | kebab-case | Phase 1 |
| Unit key | `review-<area>` (Phase 2 review, verify, deliver), `verify-<ticket>` (re-verifying a filed ticket), `flow-<key>` (Phases 4 and 6), `audit-<dimension>`, `critique-<lens>`, `reference` (Phase 5), `reconcile-<key>` (Phase 8), `integrate`, `critic` | when a unit starts; a skip list holds unit keys whose last stage is done |
| Pattern rule | `<PREFIX>-n`, for example `SEL-1`, `MENU-2`, `REV-1`; an inserted rule takes a letter suffix (`REV-1a`); a withdrawn rule keeps its number | pattern reference section 2 |
| Audit decision | `<dimension>-NN`, for example `selection-01` | Phase 5 audits, kept in the decision log |
| Contract change | `CC-n` | pattern reference section 2.14 |
| Product decision | `O1`, `O2`, … | pattern reference section 5 |
| Critique note | `<LENS>-n`, for example `A11Y-4`, `ENG-2`, and a domain-user prefix | pattern reference section 6 |
| Owner question or action | addressable IDs in the form the owner's instructions use (default `q1`, `a1`, nested options `q1a1`) | reports to the owner |
| Wireframe callout | `1`, `2`, … per step | wireframe captions |

Proposals, wireframes, tickets and tests cite rule IDs. Never renumber or reuse an ID.

**Citing a finding.** Wherever an artifact cites a finding (diagram tags and cards, `Fixes` lines, **Tickets resolved**, acceptance criteria, covers lists), cite its ticket label from the unit checkpoint's `tickets` map once the ticket is filed, and its finding ID while none is (design-only runs, issue-tracker unavailable). In a public project (issue-tracker keeps tracker identity out of its commits), committed artifacts always cite finding IDs and name a redesign by its flow key; the finding-to-ticket map stays in the checkpoints, and no ticket number or tracker URL is committed.

## Phases

### Phase 1: Inventory flows and check coverage

- **Inputs:** the roster, the app's routes, menus and commands, the owner's vocabulary.
- **Do:** List every user journey in scope: one flow per tool or task, cross-cutting flows (for example selection, progress and jobs, undo and history, or how commands are declared and offered), and one or more end-to-end journeys that cross tools ("from new material to a finished deliverable"). Map every roster feature in scope to exactly one owning flow. Find each term the owner uses by searching source and UI labels for it and its synonyms. Rank flows by the risk they pose to the owner's data and work.
- **Output:** `<state>/flows.md`: one row per flow `{key, title, roster IDs, scope sentence (entry, steps, end states), evidence areas, group, risk}`, where the group becomes the flow's heading in the docs index; then a **Vocabulary** section, a table `| Owner term | UI labels | Code identifiers |`, which the Phase 5 `language` audit reads.
- **Gate:** every in-scope roster feature maps to one flow or is listed as out of scope with a reason; a capability reached from several flows has one owner that holds its whole journey, and the others hand off to it.

### Phase 2: Review the real app and file findings

Read [review](references/review.md) before starting.

- **Inputs:** the flow table, the evidence environment, a digest of open tickets.
- **Do:** Split the review into units of one area (a slice of roster features) or one end-to-end journey. Each unit exercises every flow in its brief in the running app against disposable data, captures annotated screenshots with `assets/annotate.js`, grounds each problem in code, and writes a findings file checked by `scripts/validate-handoff.ts findings`. An independent verifier tries to refute each unit's findings and reproduces every P0 and P1. When tickets are in scope, each unit files its findings as soon as they are verified. A completeness pass then looks for uncovered surfaces and runs them as new units.
- **Output:** validated findings and verdicts; when tickets are in scope, finding tickets carrying annotated screenshots and reproduction steps; a coverage list per unit.
- **Gate (per unit):** a validated findings file, a verdicts file and, when tickets are in scope, each filed finding's ticket ID in the unit checkpoint. **Phase gate:** the completeness pass found nothing new, or its gap units passed.

### Phase 3: Decide what to redesign

Read [proposals and tickets](references/proposals-and-tickets.md) (Priority, Stopgaps, Tracker restructure) before deciding.

- **Inputs:** the flow table, the filed findings and their verdicts.
- **Do:** Group findings by flow. For a flow that will be reworked, plan one redesign ticket that absorbs its findings: each covered finding becomes acceptance evidence for the redesign instead of separate patch work. Name the foundation redesigns (cross-cutting flows the others build on). Allow standalone stopgaps only for bugs that damage data now; their fix matches what the redesign specifies. Once redesign tickets exist, apply the [tracker restructure](references/proposals-and-tickets.md#tracker-restructure).
- **Output:** `<state>/assignments.md`: each finding assigned to one redesign, a stopgap, work another worker has already claimed, or "patch, no redesign".
- **Gate:** no finding is orphaned or assigned to two redesigns; partial covers state which slice each ticket owns.

### Phase 4: Diagram today's flows from code

Read [diagrams](references/diagrams.md) and load the Archify skill before writing a spec.

- **Inputs:** the flow table, findings and their tickets, the code at a pinned revision.
- **Do:** For each flow, trace the journey as the code implements it (entry points, screens, dialogs, decisions, confirmations, waits and jobs, results, recovery, undo, dead ends) and draw a current-flow diagram from `assets/templates/current-flow.workflow.json`. Mark each evidenced pain point on its step with its finding, cited as **ID conventions** says; cite source ranges for primary steps.
- **Output:** `<key>-current.json` and its render.
- **Gate (per flow):** no `{{` left in the spec; the diagram tool's validation and render pass with repository evidence; every pain point cites its finding.

### Phase 5: Build the shared pattern reference before parallel design

Read [pattern reference](references/pattern-reference.md) before starting, and [design language](references/design-language.md) before drawing the visual page.

- **Inputs:** the current app, the findings, existing proposals or wireframes, the project's contracts and component library.
- **Do:** Before agents design flows in parallel, write one reference for the cross-cutting patterns. For a data-management tool the defaults are selection, summary and command bars, menus and entry points, surfaces, review before write, whatever can block writes in this product (when anything can), progress and outcome feedback, failures, undo and history, background work, the keyboard map, wording, and empty, loading and error states; drop what the product lacks and add its own concerns, as the reference's audits describe. Build it from audits by dimension over the current app, the findings and any existing proposals; one author synthesizes; critics review it through a domain-user lens, an accessibility lens and a backend-contract lens; the author revises and records every critique note. Publish `patterns.md` and its visual page.
- **Output:** `patterns.md` with rule IDs, decision log, per-flow conformance, contract changes, product decisions and review notes; `wireframes/patterns.html`.
- **Gate:** every audit decision with a conflict or silent flows has a log entry; every critique issue is applied or rejected with a reason; the visual page lints clean.

### Phase 6: Design each flow

Read [proposals and tickets](references/proposals-and-tickets.md) and [design language](references/design-language.md) before the first flow.

- **Inputs:** the flow's current diagram, its findings and assignments, the pattern reference.
- **Do:** For each flow: draw the proposed-flow diagram, write the proposal, draw the wireframe page and, when tickets are in scope, file the [redesign ticket](references/proposals-and-tickets.md#the-redesign-ticket). Cite rule IDs; when the flow needs to differ from a rule, propose the exception in the reference instead of inventing a divergent pattern. Draw one exemplar flow first, check it rule by rule against the reference, and only then give it to parallel designers. While drawing, record every cross-flow disagreement in the wireframe index's conflicts list. Before filing a ticket that links the flow's docs, the orchestrator publishes them (see **Scope boundaries**); after filing, [link the ticket](references/proposals-and-tickets.md#linking-the-ticket).
- **Output:** per flow: `<key>-proposed.json` and render, `proposals/<key>.md`, `wireframes/<key>.html`, the filed redesign ticket when tickets are in scope, and the links back to it.
- **Gate (per flow):** no `{{` left in any of the flow's files; the proposed diagram validates and renders, or its exception is recorded; the folder lint (`scripts/lint-wireframes.ts --site-root <docs> <docs>/ux-flows/wireframes`) reports no errors for the page; the proposal cites the rule IDs its criteria rely on, and its **Tickets resolved** matches `assignments.md` when that file exists. When tickets are in scope, `scripts/ticket-criteria.ts check` and `fixes` pass on the ticket body, its covers list matches the proposal's **Tickets resolved** and `assignments.md`, and the ticket ID and the four links ([linking the ticket](references/proposals-and-tickets.md#linking-the-ticket)) are recorded in the flow's checkpoint; otherwise the nav reads "not filed yet" and the report lists the flow.

### Phase 7: Settle product decisions with evidence and the owner

Read [pattern reference](references/pattern-reference.md) (Fact-checking, Product decisions, Owner review) before starting.

- **Inputs:** the reference's open calls, the conflicts list, the owner's stated rules.
- **Do:** Settle what evidence can settle: read the owning component's stated intent before calling behavior a defect, and measure defaults on representative real inputs (a calibration ladder) instead of guessing; a measurement can expose a broken instrument, which then blocks the default. Record each remaining product call as `O<n>` with a recommended default. Present the owner a short ID-addressable list of the decisions that change how the product feels day to day: today, proposed, rule IDs. Ask unclear answers back with today against the proposal and the cost.
- **Output:** decided `O<n>` entries with evidence; a "product owner review" subsection in the reference recording each answer as approved, reversed (with what replaces it and which contract change is withdrawn), needs clarification, or a new rule; the revision bumped.
- **Gate:** every reviewed decision is settled and recorded. Reconciliation starts only then; until then, report the pending IDs as the blocker and continue work that does not depend on them.

### Phase 8: Reconcile everything with the reference

Read [orchestration](references/orchestration.md) (shape D), [pattern reference](references/pattern-reference.md) (Synthesis: per-flow conformance; Owner review), [design language](references/design-language.md), [diagrams](references/diagrams.md) and [proposals and tickets](references/proposals-and-tickets.md) (The proposal, Acceptance criteria, The redesign ticket, Tracker restructure, Linking the ticket) before conforming a flow.

- **Inputs:** the reference revision current at the run's start and its per-flow conformance lists, every flow artifact, the owner's answers. Integration re-checks the flows against the reference as it stands on the target branch when it lands.
- **Do:** Per flow: reconcile the proposal, wireframe and proposed diagram spec with the reference (with before and after screenshots; the spec validated, not rendered); two independent reviewers check it, one for reference conformance and consistency across the flow's artifacts, one for the design language and rendering; fix, re-checking only blockers and majors, for at most two rounds; then deliver it with any unresolved issues listed: retake the after screenshots, commit only its files on a run branch in a dedicated worktree without pushing it, regenerate the ticket's criteria and covers from the proposal, list the unresolved issues on it, and apply the tracker restructure for the flow. After all flows, one integration step rebases onto the target branch, re-checks the flows a reference change since the run's base affects, regenerates every changed diagram once, re-renders and re-uploads the ticket images of those diagrams, updates the shared index files and the reference's reconciliation ledger, runs the checks, lands and deletes the run branch; a completeness critic then checks every flow. Carry every reversal to every artifact that stated it, and search all artifacts for wording of the superseded framing.
- **Output:** conformed artifacts; the wireframe index's conflicts list replaced by its decision-log pointer once every conflict is settled; one ledger line per flow in the reference's per-flow conformance section.
- **Gate:** the critic reports every flow complete; every conformance item is done or recorded as an exception in the reference; unresolved review issues are listed on their tickets, in the ledger and in the report; every ticket image of a regenerated diagram records the landed spec's blob.

### Phase 9: Publish and verify

[Publishing](references/publishing.md) owns the commands and checks below.

- **Inputs:** every artifact, the served docs site.
- **Do:** Link everything from the docs index (diagrams, wireframes, proposals, reference). Serve the docs locally, run the docs-site tests, `scripts/lint-wireframes.ts` over the wireframes and `scripts/crawl-site.ts` over the served site, and capture before and after screenshots for every visual change to existing pages. Check that no index row says "not filed yet" for a flow whose ticket ID is recorded.
- **Output:** a served site where every page is linked and reachable, plus the verification record `<state>/verification.md` (check summary lines, privacy-scan review, inspected screenshots).
- **Gate:** the linter reports no errors; the crawl reports no broken links, missing fragments or unlinked files; the docs-site tests (or the direct checks that replace them) pass, including a 200 `text/css` response for `wireframe.css`; the privacy scan has no unreviewed hits; no delivery receipt is tracked; the screenshots were inspected. Any run that wrote docs pages, review-only runs included, runs the crawl before reporting.

## Scripts

Run them with Bun from the project root as `bun <skill>/scripts/<name>.ts`, where `<skill>` is this skill's directory; pass project paths relative to the project root or absolute.

| Script | Use |
| --- | --- |
| `scaffold-flow.ts --docs <docs>/ux-flows --init --product "<Product>" [--docs-index <docs>/index.md]` | Create the stylesheet, wireframe index, visual and written pattern reference, and the docs index section; never overwrites |
| `scaffold-flow.ts --docs <docs>/ux-flows --key <flow-key> --title "<Flow title>" --product "<Product>" [--ticket-url <url> --ticket-label "<label>"] [--docs-index <docs>/index.md] [--repo-root <dir>]` | Create a flow's wireframe, proposal and diagram specs, and link it into the wireframe index and docs index. Fills keys, titles, timestamps, the repository URL and revision; `--ticket-url` must be the ticket's http(s) URL, and without it the nav reads "not filed yet"; in a public project pass neither ticket flag. Prints every placeholder left to fill: fill them all |
| `lint-wireframes.ts [--stylesheet wireframe.css] [--site-root <docs>] [--json] <docs>/ux-flows/wireframes` | Check pages against the design language (rules in [design language](references/design-language.md)); exits 1 on errors |
| `crawl-site.ts <url> [--root-dir <docs>] [--ignore <regex>] [--insecure] [--external] [--json]` | Report broken links, missing fragments and files no page links; run as `bun --use-system-ca …` when the local site uses a locally trusted certificate |
| `ticket-criteria.ts print <proposal.md>`; `ticket-criteria.ts check <proposal.md> <ticket-body.md\|->`; `ticket-criteria.ts fixes <wireframe.html> <ticket-body.md\|->` | Print a proposal's acceptance criteria to paste into its redesign ticket; check a ticket body (a file, or `-` for standard input) carries them verbatim and in order, ignoring line wrapping and ticked boxes ([acceptance criteria](references/proposals-and-tickets.md#acceptance-criteria)); check a wireframe's Fixes lines cite exactly the findings under the ticket's `Resolves:` ([steps and callouts](references/design-language.md#steps-and-callouts)). Exits 1 on any difference |
| `validate-handoff.ts <findings\|verdicts\|audit\|critique> <file> [--feature-pattern <regex>]` | Validate a unit's handoff file. Fix and rerun at most three times; if it still fails because of the environment (for example screenshots cannot be captured), return the validator output as an environment issue and mark the unit failed for re-queue |

## Adapting

- **No Archify:** follow the alternatives in [diagrams](references/diagrams.md); the current and proposed pair, code citations and finding marks still apply.
- **No parallel agents:** see [orchestration](references/orchestration.md) "Without parallel agents".
- **No docs site:** serve with the template server (see [publishing](references/publishing.md)). Opening the HTML files directly is only a preview and does not satisfy Phase 9.
- **No feature roster:** Phase 1 writes `<docs>/ux-flows/inventory.md` with IDs, linked from the docs index, so later phases can cite it.
- **Not a web app:** the wireframe vocabulary still applies to desktop, terminal and mobile flows; draw the frame the product uses and keep the legend's meanings. Phase 2 evidence changes: capture screenshots with the platform's own tooling (a desktop or device screenshot tool, a terminal recorder), draw the numbered boxes and labels on the saved images instead of with `annotate.js`, and isolate each reviewer with its own profile, data directory or device instead of a port and origin.

## Report to the owner

- What was delivered: tickets created (from unit checkpoints), flows whose redesign ticket is not filed and why, commits made and files left uncommitted, pages and their clickable preview URLs (when pages were produced), the file layout, how to open pages offline, and how to restart the docs server.
- Coverage: units reviewed, areas with no findings, coverage you capped or dropped and why, environment issues.
- What is not done: failed or blocked units with their unblock condition and next action, owner decisions still awaited, and work held behind them.
- Open questions and decisions as short ID-addressable items with a recommendation. When an item comes back later, re-read the state first, then restate its background, what changed since it was asked and its options as nested IDs, so the owner can answer it cold.
- When the owner flags a wireframe problem or asks whether pages are consistent, read [design language](references/design-language.md#drawing-errors-and-proposal-errors) "Drawing errors and proposal errors" before answering.
- Verification coverage stated honestly: which pages had visual inspection and which passed automated checks only, and whether each claim about runtime behavior rests on reading code or on running it. Before confirming behavior that depends on a measurement (a detector, scorer or classifier), run it on inputs with known answers. Correct earlier claims explicitly, by their IDs, when evidence changes them.
- Keep private hostnames, credentials and personal data out of tracked files; derive local URLs from the running service.
