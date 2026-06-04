# Ticket Template

Use this template as the standard structure for all repository tickets and issue documents.

```markdown
---
created_on: YYYY-MM-DD HH:MM
last_modified: YYYY-MM-DD HH:MM
status: current
ticket_status: open
---

# Wave <Number>: <Title>

## Problem

<Describe the technical problem, user friction, or structural gap that needs to be resolved. Be specific about the current limitations in the codebase.>

## Why this matters

<Explain the engineering impact, performance benefit, or system capability this ticket enables, highlighting the context or consequences of not addressing it.>

## Observed context

- Specified in `<design-doc-or-spec-path>` under <section-or-category>.
- Architectural Decision Record: `<adr-path-if-any>`.
- Codebase files affected:
  - `path/to/file.ext` (describe current state or refactor goal)
  - `path/to/another_file.ext`

## Desired outcome

<Provide a high-level summary of the target solution and final end-state of the system after this ticket is implemented.>

## Acceptance criteria

- <Verifiable action-oriented item 1, e.g., "Implement `path/domhost.js` exposing W3C-compliant Document classes">
- <Verifiable item 2, e.g., "The cache maintains a map linking stable numeric handle IDs to wrappers">
- <Verifiable testing item, e.g., "Write unit test `path/mount_test.go` asserting component rendering">
- <Verifiable quality/visual verification item, e.g., "Generate visual golden snapshot files inside `testdata/` and verify they match">
- <Verifiable task command, e.g., "Run `bun run test` to verify all checks and coverage baselines pass cleanly">
- Run a separate review pass on this ticket using an independent review workflow or review subagent, and resolve all identified feedback/issues until a completely clean review is returned.
```
