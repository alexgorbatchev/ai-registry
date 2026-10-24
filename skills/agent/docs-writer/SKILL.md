---
name: docs-writer
description: Read, write, rewrite, reorganize, and archive project and internal documentation including README.md files for CLI tools and libraries, engineering designs, tickets, AGENTS guidelines, runbooks, and reference docs. Must be used whenever creating or updating a project README.md, or touching files in the project's internal documentation directory.
author: alexgorbatchev
metadata:
  created_on: 2026-06-04 11:44
  last_modified: 2026-10-24 10:52
  status: current
---

# Docs Writer

Write and manage high-quality technical documentation: public-facing project `README.md` files for CLI tools and libraries, plus the internal runbooks, engineering designs, tickets, and AGENTS guidelines that people working inside the repository or organization rely on.

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

- **Timestamps:** Must use the strict `YYYY-MM-DD HH:MM` format in the user's local timezone. Verify the current time and timezone with a clock tool or system command before writing. Use the user's stated timezone when supplied; otherwise verify the machine's configured local timezone. Do not default to UTC or copy a UTC tool result into these timezone-less fields. If the local timezone cannot be established, ask for it before writing timestamps. Set both to the current local timestamp on file creation; update only `last_modified` when editing. Preserve existing `created_on` values; do not convert historical timestamps whose timezone is unknown.
- **Status Schema:** Use only `current` (active guidance) or `archived` (superseded historical reference). Do not invent other values unless explicitly requested.
- **Protect Sensitive Data:** Never write secrets, raw tokens, credentials, or private internal hostnames into any document.
- **Write for Readers:** Put purpose and target audience near the top. Keep procedures ordered, concrete, and copy-pasteable. Use clear headings for scannability.

---

## Default Directory Mapping

*   **General Internal Docs & Reference Guides:** Write to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/`.
*   **Engineering Design Documents:** Write to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/eng-designs/`.
*   **Active Project/Wave Tickets:** Write to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/tickets/`.

---

## Archival and Transition Rules

-   **General Documents:** Move archived content to the nearest `archived/` subdirectory (e.g., `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/archived/` or `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/auth/archived/`) to keep active directories clean.
-   **Completed Engineering Designs:** When a design is fully implemented, promote/move the document to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/references/` as a long-term reference.
-   **Closed Wave/Project Tickets:** Follow the specific ticket-archiving rules (transitioning frontmatter to `ticket_status: closed` and moving the file under `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/tickets/closed/`).

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

### 3. Agent Persona Guidelines (AGENTS.md)
For maintaining, generating, auditing, or topology splits of canonical root or nested AGENTS.md instructions:
-   Automatically record explicit standing user instructions without requiring a separate request to save them. Preserve standing project rules and substantive technical details. Apply the persistence filter in `references/agents.md`; exclude task history, progress, handoffs, and dated user amendments.
-   **Guidelines:** Read `references/agents.md`
-   **Code projects:** Apply that reference's meaningful behavioral-test and per-package line/function coverage rule; verify the documented coverage configuration rather than inventing a passing gate.
-   **Cleanup or conformance requests:** Follow "Full Rewrite of Existing Agent Instructions" in that reference. Rewrite the requested files completely while accounting for every technical detail; adapt sections when the templates do not fit.
-   **Templates:** Use `assets/agents-templates.md`

### 4. Repository READMEs (README.md)
This skill owns README structure, tone, and content for every project, CLI or not. Read the shared contract first, then exactly one variant:
-   **Shared contract (always):** Read `references/readme.md`
-   **CLI tools and terminal programs:** Read `references/readme-cli.md`, use `assets/readme-cli-template.md`
-   **Libraries, packages, services, applications:** Read `references/readme-library.md`, use `assets/readme-library-template.md`

Shared rules live only in `references/readme.md`. Never copy them into a variant file, another skill, or a project.

---

## Final Baseline Checklist

-   [ ] Frontmatter starts with standard `created_on`, `last_modified`, and `status`.
-   [ ] New or updated timestamps use the strict `YYYY-MM-DD HH:MM` format and verified user-local time.
-   [ ] The document is written in present tense and represents a maintained current-state reference.
-   [ ] All facts and claims are grounded in repository code, config, or verified source docs.
-   [ ] Stale, transitional, or changelog-like narration is completely removed.
-   [ ] Sub-skill references and assets are fully loaded and respected where applicable.
