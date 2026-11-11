---
name: docs-writer
description: Use when reading, writing, reviewing, reorganizing, or archiving project documentation, including README.md files, root or nested AGENTS.md instructions, internal references, runbooks, engineering designs, and tickets.
author: alexgorbatchev
metadata:
  created_on: 2026-06-04 11:44
  last_modified: 2026-11-11 09:04
  status: current
---

## Execute the task

1. Establish the artifact, audience, requested change, and existing documentation conventions. Inspect the source evidence needed for the affected claims.
2. Load the matching reference under **Artifact routing** before drafting. For agent instructions, load `prompt-writer` first; it owns composition and acceptance checks. If unavailable, locate it through the catalog or repository sources; suspend dependent writing if it cannot be loaded and continue independent evidence gathering.
3. Apply the metadata, location, and lifecycle rules below to internal documents. Keep native artifact formats for README.md, AGENTS.md, and tracker ticket bodies; do not add internal-document frontmatter to them.
4. Write maintained documentation in present tense; remove stale transitional or changelog narration. Verify affected claims, commands, and links against source evidence, and report unresolved claims without presenting them as verified.

## Baseline Standards

Every internal documentation file (procedures, runbooks, designs) must start with a standard YAML frontmatter contract:

```yaml
---
created_on: YYYY-MM-DD HH:MM
last_modified: YYYY-MM-DD HH:MM
status: current
---
```

- **Timestamps:** Must use the strict `YYYY-MM-DD HH:MM` format in the user's local timezone. Verify the current time and timezone with a clock tool or system command before writing. Use the user's stated timezone when supplied; otherwise verify the machine's configured local timezone. Do not default to UTC or copy a UTC tool result into these timezone-less fields. If the local timezone cannot be established, ask for it before writing timestamps. Set both to the current local timestamp on file creation; update only `last_modified` when editing. Preserve existing `created_on` values; do not convert historical timestamps whose timezone is unknown.
- **Status Schema:** Use only `current` (active guidance) or `archived` (superseded historical reference). Do not invent other values unless explicitly requested.
- **Protect Sensitive Data:** Never write secrets, raw tokens, credentials, or private internal hostnames into a document in a public repository. Private repositories have no such restriction.
- **Human-facing documents:** Put purpose and target audience near the top. Keep procedures ordered and copy-pasteable. Agent instructions follow `prompt-writer`; omit introductory prose that adds no execution context.

---

## Default Directory Mapping

*   **General Internal Docs & Reference Guides:** Write to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/`.
*   **Engineering Design Documents:** Write to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/eng-designs/`.

---

## Archival and Transition Rules

-   **General Documents:** Move archived content to the nearest `archived/` subdirectory (e.g., `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/archived/` or `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/auth/archived/`) to keep active directories clean.
-   **Completed Engineering Designs:** When a design is fully implemented, promote/move the document to `<%- env("DOCS_INTERNAL_DIR", "docs/internal") %>/references/` as a long-term reference.

---

## Artifact routing

Read the matching reference before writing; use its template when needed for the artifact structure:

### 1. Engineering Design Documents
For drafting technical specs, request/response API contracts, TypeScript types, and running ambiguity sweeps:
-   **Guidelines:** Read `references/eng-designs.md`
-   **Template:** Use `assets/eng-designs-template.md`

### 2. Project & Issue Tickets
Load `issue-tracker` before selecting, creating, or updating tickets; it owns storage, dependencies, task state, claims, completion, and handoffs. If unavailable, consult its authoritative CLI help and suspend only operations whose required contract remains unavailable. This skill owns ticket content, not a parallel Markdown task system.

For writing a concrete problem, supporting evidence, scope, and testable acceptance criteria:
-   **Guidelines:** Read `references/tickets.md`
-   **Template:** Use `assets/tickets-template.md`

### 3. Repository agent instructions (AGENTS.md)

Read [AGENTS.md authoring](references/agents.md) for evidence gathering, root/nested placement, standing-rule persistence, and preservation during rewrites. Use [structure options](assets/agents-templates.md) when choosing a layout. Require `prompt-writer` for instruction composition; load `skill-writer` only when the task also edits a skill bundle.

### 4. Repository READMEs (README.md)
This skill owns README structure, tone, and content for every project, CLI or not. Read the shared contract first, then exactly one variant:
-   **Shared contract (always):** Read `references/readme.md`
-   **CLI tools and terminal programs:** Read `references/readme-cli.md`, use `assets/readme-cli-template.md`
-   **Libraries, packages, services, applications:** Read `references/readme-library.md`, use `assets/readme-library-template.md`

Shared rules live only in `references/readme.md`. Never copy them into a variant file, another skill, or a project.
