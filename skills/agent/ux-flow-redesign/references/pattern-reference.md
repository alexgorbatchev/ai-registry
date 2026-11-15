# Building the shared UX pattern reference

- [When](#when)
- [Shared context block](#shared-context-block)
- [Audits](#audits)
- [Synthesis](#synthesis)
- [Critique](#critique)
- [Revision](#revision)
- [Fact-checking a high-severity claim](#fact-checking-a-high-severity-claim)
- [Product decisions](#product-decisions)
- [Owner review](#owner-review)
- [Publishing the visual page](#publishing-the-visual-page)

## When

Phase 5 builds `patterns.md` and `wireframes/patterns.html`. Phase 7 settles the reference's product decisions and records the owner's review in it.

Build the reference:

- Before any agents design flows in parallel, the normal order. Its inputs are then the current app, the Phase 2 findings, the Phase 4 current-flow diagrams and any proposals that already exist. In the normal order, Phase 6 starts when the Phase 5 gate passes; Phase 8 conforms flows to the owner's verdicts.
- As a reconciliation pass when flows were already designed independently. The audits then read every proposal and wireframe, seeded by the wireframe index's conflicts list. In this case only, freeze the existing per-flow artifacts (proposals, wireframes, redesign tickets) from the start of the build until Phase 7 is done; Phase 8 then conforms them in one pass, and earlier edits would be redone. A flow found missing while the reference is being built gets a research note and a written proposal first; draw its diagrams and wireframe only after the reference exists (unless the owner chose provisional mode for it), then conform it like the others.

Audits, critiques and fact-checks run as parallel units; synthesis and revision belong to one author. [Orchestration](orchestration.md) owns the run shape, unit sizing, checkpoints and resume.

## Shared context block

Prepend the run's shared context block, shaped as in [the unit prompt](orchestration.md#the-unit-prompt), to every audit, author, critic and skeptic brief. For this phase it also states:

- The problem: N flows are about to be designed in parallel with no shared reference, or N flows were designed independently and now disagree on selection, menus, surfaces, review, feedback, undo, keyboard and wording.
- The inputs: the flow table, findings, current-flow diagrams, proposals, wireframes, code directories, the backend API's documentation and implementation, and the component library's capability index, naming every irregularity, such as a flow with no wireframe yet.
- The seeds: the wireframe index's conflicts list, marked "seeds, not the full list".
- For critics, skeptics and later agents: the reference's path and current revision, and `<state>/ux-flows/patterns/`, which holds the audit and critique files.

## Audits

Run one unit per dimension. Name each dimension with one lowercase word; the validator requires decision IDs of the form `<dimension>-NN`. The six below are defaults for a data-management tool: drop one the product lacks (a product without lists has no selection to audit) and name the dropped dimension and why in the status line's inputs. Each scope lists the sub-questions the audit must answer; add the known collisions for the product as seeds.

- **`selection`: selection, targeting and entry points.** What click, double-click, Enter and the rename key do; the row cursor and focus; range and toggle selection; whether rows hidden by search or filters stay selected and get acted on; whether selection survives view changes and reloads; where the selection summary lives; every entry point to actions (right-click, a row's ⋯ button, toolbar, footer, Shift+F10 or the context-menu key, selection-bar buttons); menu structure and headings; drag targets and what a drag does (move or copy, and which modifier switches).
- **`review`: review before write, consent and staleness.** Dry runs and plan tokens; where the review lives (a step in a dialog, a side sheet, a docked panel, a full page); per-item and per-field opt-out; the apply button's name; consent and destructive confirmation, and what counts as destructive; what can block writes and how people recheck it; stale plans; lost responses and never replaying a write; drafts kept on failure.
- **`feedback`: progress, outcome and undo.** In-place progress (row state, panel, toast); what a toast may contain; outcome sentences; partial results and per-item failure details; the jobs page and any activity menu; undo entry points (toast, Mod+Z, job page, history row, per-item history); clean undo versus conflict review; history rows; backups and checkpoints.
- **`surfaces`: surface types and layout.** When to use a popover, menu, docked panel, side sheet, modal dialog, full page or toast; panel side and width, and how panels coexist with the main table and any persistent context; tool page layout (input, plan, run, receipt); a command palette; where tools sit in navigation; where results and receipts live; how write-blocking and failure banners appear; which component-library primitive and project dialog contract each maps to.
- **`keyboard`: the complete keyboard map.** Every letter, digit, function-key and modifier shortcut in every flow; its scope (global, table, panel, sheet, dialog, editor or mode); every collision; the app's existing shortcuts; any contract that drives shortcut hints and handlers from one command definition; suspension in text entry, menus and dialogs.
- **`language`: language, naming and states.** Names for the same operation across flows ("Export report" versus "Download report"); count formats in buttons and notifications; destination defaults; nouns (folder versus collection); status chips and verdict wording; empty, loading and error states; how messages follow the project's error-message rules.

Add a project-specific dimension when two or more flows depend on a concern none of these covers, such as something that can block writes (another application holding the data, read-only permission, offline), or a persistent context people keep across views (in an illustrative reporting app, a live preview pane).

Each audit:

- Reads every flow's inputs for its dimension. A text search locates passages; read enough around each to state the position accurately.
- Reads the code for how the current app handles each decision.
- Includes every decision in its scope that more than one flow depends on, whether or not the flows conflict; `conflict` is false when every flow that states it agrees.
- Records the current app's behavior with `path:line` evidence; every position with the flows holding it and a citation (proposal section or step, ticket, diagram step); silent flows, which need the decision but never state it; optional benchmarks (how the best tools of the domain do it, as evidence, not requirements); optional notes.
- Lists coverage gaps: questions in scope that no input answers, such as "no flow defines what counts as destructive".

Write `<state>/ux-flows/patterns/audit-<dimension>.json`. Illustrative content:

```json
{
  "dimension": "review",
  "decisions": [
    {
      "id": "review-01",
      "topic": "Dry-run gate",
      "question": "Which writes may apply only a reviewed plan, and which may write directly?",
      "conflict": true,
      "currentApp": { "behavior": "Bulk moves apply a server-computed plan; renames write directly.", "evidence": ["src/review/applyPlan.ts:66"] },
      "positions": [
        { "flows": ["bulk-move", "archive"], "position": "Only a reviewed plan applies.", "evidence": "proposals/bulk-move.md: Target steps 3" },
        { "flows": ["export-schedule"], "position": "Writes directly, then offers Undo.", "evidence": "proposals/export-schedule.md: What changes" }
      ],
      "silentFlows": ["share-folder"],
      "benchmarks": "Infrastructure tools apply only a saved plan and refuse a stale one.",
      "notes": ""
    }
  ],
  "coverageGaps": ["No flow says what happens to an open review when the person switches workspace."]
}
```

Validate it with `bun <skill>/scripts/validate-handoff.ts audit <state>/ux-flows/patterns/audit-<dimension>.json`; fix and rerun at most three times, and handle an environment-caused failure as [Scripts](../SKILL.md#scripts) says. When an audit fails and cannot be rerun, the author continues without it, reads the flows directly for that dimension, and names the gap in the status line's inputs.

## Synthesis

One author writes the whole reference from the audit files and the shared context so it reads as one design system; several authors would reproduce the divergence it exists to remove. Start from [patterns.md](../assets/templates/patterns.md), which `scaffold-flow.ts --init` copies to `<docs>/ux-flows/patterns.md`. If the file already has content, continue it. Write it section by section so a restart loses little, and fill every `{{…}}` placeholder. Sections 5.1 and 6 wait for their phases: section 6 stays "None yet." until the revision applies the critique, and section 5.1 is added at the owner review; the template's comments give both formats.

The template's structure:

- **Status line**, the first paragraph after the title: `Status: draft for review, revision <n>.`, then a revision log, newest first, one sentence per revision naming the section that records it, then `Inputs:` naming every source with its version (audits, proposals, wireframes, the project-instruction sections, the code directory, the backend API's documentation and implementation, the component library and version). Say which working files were not kept and where their content survives: "six pattern audits (working files, not kept; section 3 records every decision they raised)". Update `last_modified` in the front matter with each revision.
- **1. Purpose:** precedence (every proposal and wireframe conforms; a deviation without a named exception in section 2 or 3 is a defect, not a design choice), what each section is for, the ground rules below, and terms. Define every word the rules depend on, including Write and Read (a read is anything else, including dry runs) and Mod.
- **2. Canonical patterns:** 2.1 Selection, 2.2 Selection summary and command hints, 2.3 Menus and entry points, 2.4 Surfaces, 2.5 Review before write, 2.6 whatever can block writes in this product (another application holding the data, read-only permission, offline), 2.7 Progress and outcome feedback, 2.8 Partial results and failures, 2.9 Undo and history, 2.10 Background work and activity, 2.11 Keyboard map, 2.12 Wording and naming, 2.13 Empty, loading and error states, 2.14 Contract changes collected. Keep this numbering, because other files cite sections by number: a section the product does not need keeps its heading with "Not applicable:" and the reason, and a project-specific pattern goes inside its closest section, such as a persistent context inside 2.4.
- **3. Decision log**, **4. Per-flow conformance**, **5. Product decisions** (with owner reviews as 5.1, 5.2, …) and **6. Review notes**, described below.

Every section 2 subsection uses these labelled paragraphs, in this order. Omit a label only when it has nothing to say for that pattern (empty states rarely have keys).

| Label | Content |
| --- | --- |
| `Rules:` | bullets `- **<PREFIX>-n <Short name>.** <rule>`, citing related rules by ID |
| `Rationale:` | benchmarks, standards, project contracts and tickets that justify the rules |
| `Use it for … Do not use it for …` | scope and non-scope |
| `States:` | every state the pattern must render |
| `Keys:` | its bindings, pointing to 2.11 |
| `Accessibility:` | roles, live regions, where focus goes and where it returns |
| `Backend contract:` | backend changes the pattern needs, or none |
| `Component primitive:` … `library work:` | the component-library parts to use, and what the library itself must gain (or none) |
| `Contract change:` | `CC-n` IDs and roster IDs, or none |

Write rules as behavior a test can check, for example `- **FB-2 Exactly one outcome announcement.** The receipt appears in the originating surface when it is visible, otherwise in a toast; never both.` Use the template's prefixes (`SEL`, `BAR`, `MENU`, `SURF`, `REV`, `HOLD`, `FB`, `FAIL`, `UNDO`, `ACT`, `KEY`, `WORD`, `STATE`). The template already ships `MENU-2`, the menu-heading rule; keep it.

Ground rules. Write them into section 1 and apply them to every decision:

- Product direction wins, stated as the project states it.
- Keep a convention most flows already share unless evidence shows it is worse, and state that evidence in the decision.
- Decisions (choices, confirmations, conflict reviews) live in panels, dialogs or pages, never in toasts. A toast carries one outcome sentence and links.
- A rule that changes a project contract or roster entry says so, and 2.14 quotes the text it replaces under a `CC-n` ID. Quote the text; never cite line numbers, which drift.
- The backend owns domain operations. A pattern that needs backend work lists it under `Backend contract:`, and a feature that depends on missing backend records ships with them.

**Surface decision rule.** Section 2.4 opens with an ordered list of questions; the first one that fits picks the surface, so every interaction gets exactly one. Adapt the wording to the product, keeping this order:

1. A small choice or value edit anchored to one control and dismissed by clicking away? Popover.
2. A list of commands for a target? Menu.
3. Must the person answer before anything else can happen (a destructive confirmation with no reviewed plan, a choice the next step needs)? Modal dialog.
4. Does the person keep working in the main view while it stays open beside it? Docked panel.
5. A focused task on one target that needs more room than a panel while the page stays visible? Side sheet.
6. Its own input, plan, run and receipt, or a need for its own URL? Full page.
7. Only a report of something that already happened? Toast.

**Keyboard map (2.11).** `KEY` rules define the scopes and when each is active, including suspension in text entry, open menus and dialogs. Then one table, `| Key | Scope | Action | Owning flow |`, with a row for every binding the audits found and every existing shortcut, each naming the scope it fires in (Mod is ⌘ on macOS, Ctrl elsewhere). Follow it with one paragraph, "Collisions resolved by this table:", naming every contested key and how it was settled. Single-character keys fire only within their scope (WCAG 2.1.4).

**Glossary (2.12).** `WORD-1 Glossary` is a table `| Use | Meaning | Never |`, one row per noun or verb the flows disagree on, with the rejected synonyms under Never; for example (illustrative) `| export | A file written from a report for use outside the app | download, extract |`. Later `WORD` rules fix button labels (`<Verb> <count> <unit> [to <destination>]`) and outcome sentences (verb first, past tense, targets named by title, never by ID).

**Contract changes (2.14).** One numbered entry per change:

```markdown
3. **CC-3** (`REV-1`, `REV-2`): "<quoted current contract text>" becomes "<new text>". Roster <IDs>.
```

Variants: "is kept and extended with …", "is clarified: …", "gains …", and roster-only changes. A withdrawn change keeps its number, says "withdrawn in revision <n>" and states what stays. Each lands in the project instructions together with the code that implements it, because the instructions describe current behavior.

**Decision log (3).** One subsection per dimension, one entry per audit decision that had a conflict or silent flows. List the IDs of decisions that were agreed and fully stated in the section intro and fold them into section 2 without entries. Entry format:

```markdown
- **review-01 · Dry-run gate.** Options: (a) <position> [<flows>]; (b) <position> [<flows>]. Decision: (a), `REV-1`. Reason: <benchmarks, contracts, tickets>. Must change: <flow> (<what changes>). Silent, must adopt: <flows>. Contract: `CC-3`; <roster IDs>.
```

A decision derived from another uses a compact form:

```markdown
- **feedback-21 · Clean undo.** Decision: `UNDO-1` (see `review-12`). Same changes.
```

A later revision marks its decision, `Decision (revision 2): …` or `Decision (revision 4, product owner): …`, and keeps the superseded reasoning in `Reason:`. Never drop "Silent, must adopt": a flow that never stated a behavior is not conformant by default.

**Per-flow conformance (4).** The intro states the items common to every flow once: cite rule IDs in acceptance criteria, use Mod notation, show the write-blocking states when anything blocks writes, use the acceptance viewports (list them), and any other universal check. Then one `### <flow-key>` per flow, annotated when its inputs are partial ("(no wireframe yet)", "(ticket only)"):

```markdown
- P: <change to the proposal> (`REV-1`, `review-01`).
- W: <change to the wireframe>.
- Conforms: <what already matches>.
```

Before any proposal exists, `P:` lines state what the proposal must specify. End with `### Work no flow owns`: cross-cutting surfaces (a command palette, the navigation structure, a dashboard several flows add cards to, dialogs no flow touches) that the reference owns until a flow claims them, with their tickets.

## Critique

Run three critics in parallel on the complete first draft. Each gets the shared context block and one lens:

- **Domain power user** (choose a short ID prefix for the domain's user, such as `USR`): would an expert doing real work under real conditions, with a task in progress and time pressure, find these patterns fast and safe? Compare them with the best tools of the domain, named in the brief. Flag friction, mode confusion, lost context, and anything that interrupts the work in progress.
- **Accessibility and keyboard** (`A11Y`): focus order and return; screen-reader semantics for toasts, menus, sheets and dialogs; keyboard collisions and suspension in text entry, menus and dialogs; whether every flow can be completed without a pointer.
- **Feasibility and contracts** (`ENG`): does each pattern fit the project's architecture contracts (state management, data fetching, component library, confirmation rules, error-message rules, never replaying writes, backend ownership) and what the backend API can actually do (name its documentation)? Flag contract changes missing from 2.14 and backend work no pattern names.

Every critic spot-checks the reference's claims against the proposals, the audit files and the code, reports concrete issues only, each with evidence and a specific fix, and edits no file. It writes `<state>/ux-flows/patterns/critique-<lens>.json`:

```json
{
  "lens": "a11y",
  "issues": [
    {
      "severity": "blocker",
      "section": "2.3 Menus and entry points",
      "problem": "The row menu has no keyboard entry point.",
      "evidence": "MENU-1 names right-click and the ⋯ button only; src/table/RowMenu.tsx:40 binds no key.",
      "fix": "Add Shift+F10 and the context-menu key to MENU-1 and the keyboard map."
    }
  ]
}
```

Validate it with `bun <skill>/scripts/validate-handoff.ts critique <file>` under the same three-attempt limit. An empty `issues` array is valid when the lens found nothing.

## Revision

The same author revises:

1. Read every critique file and judge each issue against the evidence it cites.
2. Apply each valid issue. After each change, re-check the keyboard map, the decision log and per-flow conformance; a rule change usually moves all three.
3. Replace section 6's "None yet." with a label line per lens, then one bullet per issue, numbered per lens as `<LENS>-n` in critique-file order. Add "(blocker)" only to blockers. State each problem as a past-tense finding, then its disposition:

   ```markdown
   - **A11Y-4** (blocker) The row menu had no keyboard entry point. Applied: `MENU-1`, `KEY-5` (Shift+F10 and the context-menu key open it on the cursor row).
   - **ENG-2** <finding>. Applied in part: <what changed, with rules>. Rejected in part: <what>, because <evidence or the conflicting item>.
   ```

   A removal is a valid fix ("Applied: removed from `MENU-4`."). When you use the critic's alternative fix, say "Applied with the critique's alternative fix".
4. Bump the revision. The status line says the revision applies the critique and that section 6 records every issue.

Reject only with evidence: a code path, the current app's behavior, or a conflicting critique item named by ID ("Rejected in part: bare digits stay unbound here, because `USR-6` gives them another meaning in this scope"). Never reject on taste. When a critique issue settles an open product decision, mark that `O<n>` entry as settled and name the rules that settle it.

## Fact-checking a high-severity claim

Use this when a claim will drive a P0 ticket, a stopgap or a rule that blocks an action. Run it alongside the other steps and finish it before the owner review.

1. Write the claim once, with its mechanism, its `path:line` citations and its stated consequence, and give it verbatim to every skeptic.
2. Run two or more read-only skeptics in parallel, each from a distinct angle: one reads the cited code paths and their callers (request handlers, candidate selection, job runners) for any check that contradicts the claim; another reads the unit and integration tests for any path that refutes it.
3. Brief each one: try to refute the claim; return refuted only with concrete code that contradicts it, otherwise not refuted; list every inaccurate detail under `corrections` even when the core claim stands. Verdict format: `{"refuted": false, "confidence": "high", "evidence": "<code read and what it shows>", "corrections": "<inaccurate details>"}`, with confidence low, medium or high.
4. Apply the corrections to the claim and to every artifact that repeats it.
5. Decide what the confirmed mechanism means from product intent, not from the claim's framing. Read the owning component's stated intent (its instructions, documentation and tests) and the owner's rules. When the behavior is intended, the work becomes a UX need, such as a warning at the point of choice and in the result, never a gate that blocks the intended action. Withdraw stopgaps built on the defect framing, record the intent in the project instructions where design agents work and in the shared context block, then search every artifact for leftover defect wording ("P0", "defect", the gate's name).

## Product decisions

Phase 7 settles what evidence can settle and leaves the owner only the product calls. Before calling a behavior a defect or putting it to the owner, read the owning component's stated intent. Answer a question about what a feature does with a decision table citing code; when the implemented rule conflicts with a rule the owner stated, ask an ID'd question with a recommendation instead of choosing. Measure any default that is a threshold or quantity instead of guessing it (below). Record each remaining call as `O<n>` in section 5 and never renumber; a settled entry stays with its outcome, and the section intro says which entries rules settled ("O1 is settled by `SURF-4`").

```markdown
- **O2 <Question as a noun phrase>. Recommended default: <default>; flows assume it until the product owner decides.** <Evidence for and against.>
- **O3 <Question>. Decided: <answer>.** <What it means and what the UI says.>
  - <Measured evidence with margins on both sides; the nearest alternative and the measured reason it fails.>
  - <Pitfalls the measurement exposed.>
  - Consequence: <what people will notice>.
  - Backend work: <work>; ships together with <dependency> because <reason>. Until then: <interim behavior>.
  - Blocked: <the instrument or tooling gap, and its ticket>.
```

When a decision rests on a number, or the owner delegates a default:

1. Build a calibration ladder: representative real inputs spanning the real range, one per meaningful step, all measured with one stated method and its parameters.
2. Pick a value with margins on both sides: it fails every step below the acceptable one and passes every step at or above it. State both margins.
3. Show from the table why the nearest alternative fails.
4. Note pitfalls, such as derived inputs keeping their source's properties.
5. Check the instrument. When the measuring tool cannot produce real values (it reports the same reading for every step), no threshold works: name the blocker in the decision, file a ticket carrying the ladder table through `issue-tracker`, and explicitly correct earlier claims that relied on the tool.
6. Couple releases so no intermediate release breaks an owner rule: first ship the rule change that behaves like today under the current readings, then the instrument fix, then the version requirement that depends on both.

Illustrative example, with an invented domain and numbers:

```markdown
- **O3 Minimum effective scan resolution for searchable documents. Decided: 270 dpi, editable per workspace.** The owner's bar is that text search finds 99% of words.
  - One printed page scanned at each setting, effective resolution measured from edge sharpness: 150 dpi reads 147, 200 reads 196, 250 reads 243, 300 reads 290, 600 reads 560. Search finds 97% of words at 250 dpi and 99.4% at 300.
  - 270 fails 250 dpi scans with 27 dpi of margin and passes 300 dpi scans with 20. The earlier proposal, 240, sat 3 dpi below the 250 dpi reading, so it passed scans that miss 3% of words.
  - A 150 dpi scan resampled to 600 dpi still reads 147 and fails.
  - Blocked: the upload check reads the declared resolution from file metadata, so the resampled file passes; the threshold ships with the sharpness measurement (#<ticket>).
```

## Owner review

Put to the owner only the decisions that change how the product feels day to day, not the whole reference, as a short table the owner can answer in one line. Give each row an addressable ID and keep the rule IDs in their own column:

| ID | Today | Proposed | Rules |
| --- | --- | --- | --- |
| i1 | Clicking a report opens it | Click selects; Enter or double-click opens | `SEL-1`, `CC-1` |

When you deliver the list, add the next review section (5.1 for the first), "Product owner review of revision <n>", with one bullet per listed rule or decision ID and a plain-language restatement. Each item reads "awaiting owner" until its answer arrives; then record the verdict, and state your reading of a terse answer back to the owner ("i3: recorded as approved, with Enter opening") so a misreading is caught:

```markdown
- `SEL-1` (click selects; Enter or double-click opens): approved.
- `selection-26` (drag): reversed. <What replaces it>; `CC-2` is withdrawn.
- `SURF-2` (<meaning>): needs clarification; reconciliation waits for it.
- `MENU-3` (added in revision <n+1>): <the owner's request as a rule>.
```

Phase 7 ends when every reviewed decision is settled: approved, reversed, or clarified and then decided, each recorded here with the revision bumped. Reconciliation (Phase 8) starts only then, because conforming flows to a decision that may still change wastes the work and leaves artifacts disagreeing. While items are pending, report their IDs as the blocker with the unblock condition (the owner's answer), and continue work that does not depend on them, such as measurements, research notes and publishing pages that already exist.

- **Unclear verdicts:** ask back with a concrete scenario that sets today against the proposal: today's behavior, the proposed behavior and its variants, when it starts and stops, precedent products, its cost (such as a roster feature it retires), and the flows that depend on it; reconciliation waits until the owner answers.
- **Your own calls:** list details you decided yourself while applying a verdict as items the owner can override.
- **Reversals:** carry each one to every artifact that stated it. Rewrite the decision-log entry as `Decision (revision <n>, product owner): …` and keep the superseded reasoning in `Reason:` ("Revision <n-1> had chosen X because …; the product owner kept today's behavior"). Mark the dependent `CC-n` withdrawn without renumbering. Update the conformance lines, proposals, wireframes (hints, labels, mockups), wireframe index cards, the tables on `patterns.html`, and tickets. Then search every artifact for the superseded wording and fix each hit.
- **Pattern feedback:** when the owner names a pattern problem in one place, write a generalized rule with a named exception, its interaction with existing rules, and its scope, then fix every mockup that breaks it. Example: "A heading labels two or more items; a lone item joins its closest group. Only the destructive last item stands alone, after a separator and without a heading. When a context hides items and leaves one in a group, that item drops its heading. Every menu in every flow follows this." The template ships this rule as `MENU-2`, and the linter's `menu-heading` check enforces it in mockups.

Then bump the revision: a new first sentence in the status line naming the review section and any new rules, an updated `last_modified`, and a republished visual page.

## Publishing the visual page

`scaffold-flow.ts --init` copies [patterns.html](../assets/templates/patterns.html) to `<docs>/ux-flows/wireframes/patterns.html`. It links the shared `wireframe.css`; keep page-only rules in its own `<style>` ([design language](design-language.md)). Its example rules (`SEL-1`, `MENU-1`, `MENU-2`, `SURF-1`) match the `patterns.md` starting examples; replace them with the reference's own rule IDs and text. Its parts:

- **Header:** nav links to `index.html` ("← All flows") and `../patterns.md`; the h1 "Shared UX patterns"; a two-sentence summary; the `.decide` box (`id="product-decisions"`) listing every `O<n>` as "Decided" or "Recommended" with a one-line summary; and a muted line naming the reference revision the page condenses.
- **Sticky `.key` band:** the "How to read" legend, with an entry for every mockup convention the page uses, and the `.toc` contents nav linking every pattern section and the three tables. This band is taller than on flow pages; re-measure `--key-h` in the page's `<style>` after changing the contents nav, legend or font.
- **One `section.step.pat` per section 2 pattern**, in the same order with the same rule IDs and a stable `id`: a mockup (`.win`) on the left; on the right a `.cap` caption with an h2 "<n>. <Pattern>", a when-to-use sentence, an `ol.rules` list with `<li><b>RULE-ID</b> text</li>` per rule, and a `p.fixes` line for backend, accessibility and contract notes. Each numbered callout (`<span class="n">1</span>`) in a mockup is explained once in its caption, on the rule it illustrates.
- **Tables:** `section.full#keyboard-map` (Key, Scope, Action, Owning flow: every row from 2.11); `section.full#decision-log` (ID, Topic, Decision, Rules, with a `tr.grp` row "<dimension> · <n> decisions" per dimension); `section.full#contracts` (ID, From, Change for every `CC-n`, marking withdrawn ones).

Keep mockups in sync with the rule text: an item a rule lists appears in its mockup, and no mockup shows what a rule forbids, such as a selection bar a rule removed or a button inside a toast. Update the page in the same pass as every revision of `patterns.md`.

Then verify:

1. Lint the whole wireframes folder as [checking a page](design-language.md#checking-a-page) describes, and fix every error it reports for the page.
2. Run that section's visual check at a wide and a narrow viewport (for example 1440×900 and 800×900) in a browser session of its own. Also fix a sticky band covering section headings and mockups that drifted from their rules; shoot again, then close the session.
