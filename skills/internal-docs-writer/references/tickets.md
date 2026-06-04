# Tickets Writer

Write and maintain structured, implementation-ready project tickets. Ensure every ticket is grounded in real repository context, defines a clear and compelling problem space, and includes highly precise, testable acceptance criteria.

## Default output path

- Write active tickets to `{{ env "DOCS_INTERNAL_DIR" }}/tickets/<date>-wave-<number>-<description>.md`.
- Use `YYYY-MM-DD` for the date prefix, followed by descriptive `kebab-case` naming (e.g., `{{ env "DOCS_INTERNAL_DIR" }}/tickets/2026-06-04-wave-1-implement-handwritten-js-dom-host-and-event-gateway.md`).
- Ensure the `{{ env "DOCS_INTERNAL_DIR" }}/tickets/` folder exists before writing.

## Ticket Document Schema

Every ticket must start with standard internal-doc metadata YAML frontmatter, extended with the ticket's active status:

```yaml
---
created_on: YYYY-MM-DD HH:MM
last_modified: YYYY-MM-DD HH:MM
status: current
ticket_status: open
---
```

*   Use `ticket_status: open` for active tickets ready for implementation.
*   Use `ticket_status: closed` for completed or fully resolved tickets.

## Workflow

1.  **Discover the Need:** Map user requests, roadmap plans, or design specs (`{{ env "DOCS_INTERNAL_DIR" }}/eng-designs/`) to a discrete unit of actionable development work.
2.  **Define the Problem:** Write a clear explanation of the current system gap, codebase limitation, or user friction in the `## Problem` section. Avoid vague generalities.
3.  **Establish Value:** Explain *why* resolving this problem is critical, detailing performance gains, stability enhancements, or future capability enablement in `## Why this matters`.
4.  **Map Observed Context:** Search the repository to identify exactly which files, designs, ADRs, or configurations are relevant. List them explicitly under `## Observed context`.
5.  **Formulate Acceptance Criteria:** Write a precise, exhaustive checklist under `## Acceptance criteria` detailing:
    *   Specific interfaces, modules, properties, or functions to implement or refactor.
    *   Preservation of key system properties (e.g., memory limits, reference equality).
    *   Strict test suites, coverage baselines, or golden snapshot verifications that must pass.
    *   **Mandatory Review Pass:** Include a required item to run a separate review pass on the ticket using an independent review workflow or review subagent, resolving all identified feedback/issues until a completely clean review is returned.
6.  **Validate against template:** Ensure the formatting matches `assets/tickets-template.md`.

## Lifecycle and Archiving Rules

-   **Closing a Ticket:**
    -   When a ticket's work is completed and verified, update its frontmatter to `ticket_status: closed` and set the `last_modified` timestamp.
    -   Move the closed ticket file into the `closed/` subdirectory (e.g., `{{ env "DOCS_INTERNAL_DIR" }}/tickets/closed/<date>-wave-<number>-<description>.md`) to keep the active tickets directory uncluttered.
-   **Archiving a Stale Ticket:**
    -   If a ticket is superseded, canceled, or no longer relevant, update its frontmatter to `status: archived` and move it to `{{ env "DOCS_INTERNAL_DIR" }}/tickets/archived/` folder.

## Final Checklist

-   File is written to `{{ env "DOCS_INTERNAL_DIR" }}/tickets/` (or `closed/` / `archived/` depending on lifecycle state).
-   Frontmatter contains standard `created_on`, `last_modified`, `status`, and `ticket_status` keys.
-   Timestamps follow `YYYY-MM-DD HH:MM` format.
-   The file structure strictly adheres to `assets/tickets-template.md`.
-   Acceptance criteria are exhaustive, testable, and completely unambiguous.
