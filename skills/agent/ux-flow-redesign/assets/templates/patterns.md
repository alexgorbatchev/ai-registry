---
created_on: {{TIMESTAMP}}
last_modified: {{TIMESTAMP}}
status: current
---

# {{PRODUCT}} shared UX pattern reference

Status: draft for review, revision 1. {{NEWEST_REVISION_FIRST_ONE_SENTENCE_EACH_NAMING_THE_SECTION_THAT_RECORDS_IT}} Inputs: {{N}} pattern audits (working files, not kept; section 3 records every decision they raised), the {{N}} flow proposals in `proposals/` (each linked from the [wireframe index](wireframes/index.html)), the wireframes in `wireframes/`, the project instructions ({{SECTIONS}}), the current code under `{{SOURCE_DIR}}`, the backend API ({{API_DOC_AND_IMPLEMENTATION}}), and {{COMPONENT_LIBRARY_AND_VERSION}}.

## 1. Purpose

This document is the one design reference for every {{PRODUCT}} flow. Every flow proposal and every wireframe must conform to it. A flow that needs to behave differently must name the exception here, in section 2 or section 3, with its reason; a deviation without a named exception is a defect in the proposal or wireframe, not a design choice.

How to use it:

- Section 2 states the canonical patterns. Each rule has an ID (for example `SEL-1`) so proposals, wireframes, tickets and tests can cite it. A section this product does not need keeps its heading with "Not applicable:" and the reason, so section numbers stay stable.
- Section 3 records how each cross-flow disagreement found by the audits was settled. Entry IDs match the audit decision IDs (`selection-01`, `review-12`, ...).
- Section 4 lists, for each flow, what its proposal and wireframe must change.
- Section 5 lists the product calls that evidence could not settle, each with a recommended default that flows assume until the product owner decides, and records the product owner's reviews.
- Section 6 records how each critique issue was handled.

Ground rules applied throughout:

- {{PRODUCT_DIRECTION_WINS_STATED_AS_THE_PROJECT_STATES_IT}}
- Where flows already share a convention, it is kept unless there is concrete evidence it is worse; that evidence is stated in the decision.
- Decisions (choices, confirmations, conflict reviews) live in panels, dialogs or pages, never inside toasts.
- Where a rule changes a project contract or feature-roster entry, the rule says so and section 2.14 quotes the text it replaces under a `CC-n` ID. Contracts are cited by quoted text, never by line number, because line numbers drift.
- {{THE_BACKEND_OWNS_DOMAIN_OPERATIONS_PATTERNS_LIST_BACKEND_WORK_UNDER_BACKEND_CONTRACT}}

Terms used below:

- **{{TERM}}**: {{DEFINITION_THE_RULES_DEPEND_ON}}
- **Write**: any operation that changes {{WHAT_A_WRITE_CHANGES}}. **Read**: anything else, including dry runs.
- **Mod**: ⌘ on macOS, Ctrl on Windows and Linux.

## 2. Canonical patterns

<!-- Every subsection uses the same labelled paragraphs in this order. Rules are numbered per prefix; an inserted rule
     gets a letter suffix (REV-1a) instead of renumbering, and a withdrawn rule keeps its number marked withdrawn. -->

### 2.1 Selection

Rules:

- **SEL-1 {{SHORT_NAME}}.** {{RULE_TEXT_CITING_RELATED_RULES_BY_ID}}

Rationale: {{BENCHMARKS_STANDARDS_CONTRACTS_AND_TICKETS}}.

Use it for {{SCOPE}}. Do not use it for {{NON_SCOPE}}.

States: {{EVERY_STATE_THE_PATTERN_MUST_RENDER}}.

Keys: {{BINDINGS}}; see 2.11.

Accessibility: {{ROLES_LIVE_REGIONS_AND_FOCUS}}.

Backend contract: {{REQUIRED_BACKEND_CHANGES_OR_NONE}}.

Component primitive: {{LIBRARY_PARTS}}; library work: {{WHAT_THE_LIBRARY_MUST_GAIN_OR_NONE}}.

Contract change: {{CC_IDS_AND_ROSTER_IDS_OR_NONE}}.

### 2.2 Selection summary and command hints

Rules:

- **BAR-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.3 Menus and entry points

Rules:

- **MENU-1 {{SHORT_NAME}}.** {{RULE_TEXT}}
- **MENU-2 Headings label two or more items.** A group heading sits only over two or more items. A lone item joins its closest related group instead of getting a heading of its own. The one exception is the destructive last item, which stands alone after a separator and without a heading. When a context hides items and leaves a group with one item, that item drops its heading and stays in place after a separator.

### 2.4 Surfaces

Decision rule. Ask in order and use the first surface that fits:

1. {{QUESTION}} → {{SURFACE}}

Rules:

- **SURF-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.5 Review before write

Rules:

- **REV-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.6 {{WHAT_CAN_BLOCK_WRITES_IN_THIS_PRODUCT}}

<!-- Whatever can block writes: another application holding the data, read-only permission, offline. When nothing
     can, write "Not applicable: nothing blocks writes in this product." under the heading and drop the rules. -->

Rules:

- **HOLD-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.7 Progress and outcome feedback

Rules:

- **FB-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.8 Partial results and failures

Rules:

- **FAIL-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.9 Undo and history

Rules:

- **UNDO-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.10 Background work and activity

Rules:

- **ACT-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.11 Keyboard map

Rules:

- **KEY-1 Scopes.** {{SCOPES_AND_WHEN_EACH_IS_ACTIVE_INCLUDING_TEXT_ENTRY_MENUS_AND_DIALOGS}}

| Key | Scope | Action | Owning flow |
| --- | ----- | ------ | ----------- |
| {{KEY}} | {{SCOPE}} | {{ACTION}} | {{FLOW}} |

Collisions resolved by this table: {{EVERY_CONTESTED_KEY_AND_ITS_SETTLEMENT}}.

### 2.12 Wording and naming

- **WORD-1 Glossary.**

| Use | Meaning | Never |
| --- | ------- | ----- |
| {{TERM}} | {{MEANING}} | {{REJECTED_SYNONYMS}} |

- **WORD-2 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.13 Empty, loading and error states

Rules:

- **STATE-1 {{SHORT_NAME}}.** {{RULE_TEXT}}

### 2.14 Contract changes collected

Every project-instruction and feature-roster change this reference requires. Each lands in the same change as the code that implements it, with roster updates. Project text is quoted, not cited by line, because line numbers drift.

1. **CC-1** (`{{RULE_IDS}}`): "{{QUOTED_CURRENT_TEXT}}" becomes "{{NEW_TEXT}}". Roster {{ROSTER_IDS}}.

## 3. Decision log

One entry per audit decision that had a conflict or silent flows. Format: the options (with the flows that held them), the decision (with the rule it creates), the reason, and the flows that must change. "Silent, must adopt" lists flows that did not state the behavior and must now state it. Decisions the audits found agreed and fully stated ({{IDS}}) are folded into section 2 without entries.

### 3.1 {{AUDIT_DIMENSION}}

- **{{DIMENSION}}-01 · {{TOPIC}}.** Options: (a) {{POSITION}} [{{FLOWS}}]; (b) {{POSITION}} [{{FLOWS}}]. Decision: (a), `{{RULE_ID}}`. Reason: {{EVIDENCE}}. Must change: {{FLOW}} ({{WHAT}}). Silent, must adopt: {{FLOWS}}. Contract: `{{CC_ID}}`; {{ROSTER_IDS}}.

## 4. Per-flow conformance

Each flow lists what its proposal (P) and its wireframe (W) must change. Rule IDs point to section 2; entry IDs to section 3. Items common to every flow are not repeated below: cite rule IDs in acceptance criteria; use "Mod" notation; {{WRITE_BLOCKING_STATES_OR_DELETE}}; use the acceptance viewports {{VIEWPORTS}}; {{OTHER_UNIVERSAL_CHECKS}}.

### {{FLOW_KEY}}

- P: {{CHANGE_TO_THE_PROPOSAL}} (`{{RULE_ID}}`, `{{DECISION_ID}}`).
- W: {{CHANGE_TO_THE_WIREFRAME}}.
- Conforms: {{WHAT_ALREADY_MATCHES}}.

<!-- After a reconciliation run lands, its integration step ends each flow's entry with one line, and the section
     intro says once that these lines record reconciliation runs and that their open issues are the flow's next work:
     - Reconciled in run <run> (`<landed commit>`): <review issues still open, with locations, or "nothing open">. -->

### Work no flow owns

- {{CROSS_CUTTING_SURFACE}} is owned by this reference until {{A_PROPOSAL}} exists ({{TICKETS}}).

## 5. Product decisions

Product calls that the evidence could not settle. {{WHICH_ARE_SETTLED_BY_RULES_WHICH_ARE_DECIDED_WHICH_ARE_OPEN}}

- **O1 {{QUESTION_AS_A_NOUN_PHRASE}}. Recommended default: {{DEFAULT}}; flows assume it until the product owner decides.** {{EVIDENCE_FOR_AND_AGAINST}}
  - {{MEASURED_EVIDENCE_WITH_MARGINS_AND_THE_MEASURED_REASON_THE_NEAREST_ALTERNATIVE_FAILS}}
  - Consequence: {{WHAT_PEOPLE_WILL_NOTICE}}.
  - Backend work: {{WORK}}; ships together with {{DEPENDENCY}} because {{REASON}}.

<!-- Add 5.1 after the product owner reviews a revision, one bullet per reviewed ID:
     - `SEL-1` (plain-language meaning): approved.
     - `selection-26` (meaning): reversed. What replaces it; `CC-2` is withdrawn.
     - `SURF-4` (meaning): needs clarification; reconciliation waits for it.
     Name the section "5.1 Product owner review of revision N". -->

## 6. Review notes

None yet.

<!-- After the critique, replace "None yet." with: Each issue from the revision N critique, by lens, with what was done.
     "Applied" names the rules that now carry the fix; "rejected" gives the reason. Then one list per lens:
     - **A11Y-1** (blocker) What was wrong, in the past tense. Applied: `KEY-2` (how).
     - **ENG-3** What was wrong. Applied in part: what. Rejected in part: what, because evidence or the conflicting item. -->
