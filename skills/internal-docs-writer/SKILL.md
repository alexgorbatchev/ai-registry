---
name: internal-docs-writer
description: Write, rewrite, reorganize, and archive internal and public Markdown documentation. Unified documentation writer that manages general internal docs, technical engineering designs, project tickets, and README/AGENTS guidelines.
author: alexgorbatchev
---

# Internal Docs Writer

Write and manage high-quality technical documentation for people who work inside the repository or organization (runbooks, designs, tickets, AGENTS guidelines) as well as public evergreen documentation (READMEs).

Keep all content strictly grounded in actual source materials, write in a factual current-state tone, and enforce appropriate metadata lifecycles on all documents.

---

## Baseline Standards

Every internal documentation file (procedures, runbooks, designs, tickets) must start with a standard YAML frontmatter contract:

```yaml
---
created_on: YYYY-MM-DD HH:MM
last_modified: YYYY-MM-DD HH:MM
status: current
---
```

- **Timestamps:** Must use the strict `YYYY-MM-DD HH:MM` format. Set both to the current timestamp on file creation; update only `last_modified` when editing.
- **Status Schema:** Use only `current` (active guidance) or `archived` (superseded historical reference). Do not invent other values unless explicitly requested.
- **Protect Sensitive Data:** Never write secrets, raw tokens, credentials, or private internal hostnames into any document.
- **Write for Readers:** Put purpose and target audience near the top. Keep procedures ordered, concrete, and copy-pasteable. Use clear headings for scannability.

---

## Default Directory Mapping

*   **General Internal Docs & Reference Guides:** Write to `{{ env "DOCS_INTERNAL_DIR" }}/`.
*   **Engineering Design Documents:** Write to `{{ env "DOCS_INTERNAL_DIR" }}/eng-designs/`.
*   **Active Project/Wave Tickets:** Write to `{{ env "DOCS_INTERNAL_DIR" }}/tickets/`.

---

## Archival and Transition Rules

-   **General Documents:** Move archived content to the nearest `archived/` subdirectory (e.g., `{{ env "DOCS_INTERNAL_DIR" }}/archived/` or `{{ env "DOCS_INTERNAL_DIR" }}/auth/archived/`) to keep active directories clean.
-   **Completed Engineering Designs:** When a design is fully implemented, promote/move the document to `{{ env "DOCS_INTERNAL_DIR" }}/references/` as a long-term reference.
-   **Closed Wave/Project Tickets:** Follow the specific ticket-archiving rules (transitioning frontmatter to `ticket_status: closed` and moving the file under `{{ env "DOCS_INTERNAL_DIR" }}/tickets/closed/`).

---

## Sub-Skill Navigation (Progressive Disclosure)

When tasked with a specialized documentation job, immediately read the corresponding reference file and template asset to guide your execution:

### 1. Engineering Design Documents
For drafting technical specs, request/response API contracts, TypeScript types, and running ambiguity sweeps:
-   **Guidelines:** Read `references/eng-designs.md`
-   **Template:** Use `assets/eng-designs-template.md`

### 2. Project & Issue Tickets
For writing wave-based roadmap tickets with detailed problems, value justifications, and precise acceptance criteria:
-   **Guidelines:** Read `references/tickets.md`
-   **Template:** Use `assets/tickets-template.md`

### 3. Repository READMEs
For creating or updating public-facing, evergreen present-state project overviews:
-   **Guidelines:** Read `references/readme.md`

### 4. Agent Persona Guidelines (AGENTS.md)
For maintaining, generating, auditing, or topology splits of canonical root or nested AGENTS.md instructions:
-   **Guidelines:** Read `references/agents.md`
-   **Templates:** Use `assets/agents-templates.md`

---

## Final Baseline Checklist

-   [ ] Frontmatter starts with standard `created_on`, `last_modified`, and `status`.
-   [ ] All timestamps use the strict `YYYY-MM-DD HH:MM` format.
-   [ ] The document is written in present tense and represents a maintained current-state reference.
-   [ ] All facts and claims are grounded in repository code, config, or verified source docs.
-   [ ] Stale, transitional, or changelog-like narration is completely removed.
-   [ ] Sub-skill references and assets are fully loaded and respected where applicable.
