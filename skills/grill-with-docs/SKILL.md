---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
author: mattpocock
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── {{ env "DOCS_INTERNAL_DIR" }}/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── {{ env "DOCS_INTERNAL_DIR" }}/
│   └── adr/                      ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── {{ env "DOCS_INTERNAL_DIR" }}/adr/        ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── {{ env "DOCS_INTERNAL_DIR" }}/adr/
```

## Document Naming and Location Rules

### 1. Glossary & Context Map (CONTEXT.md / CONTEXT-MAP.md)
- **Single Context (most repos):** Use a single `CONTEXT.md` at the repo root.
- **Multiple Contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, their directory locations, and relationships.
- **Discovery and Inference:**
  - If `CONTEXT-MAP.md` exists, read it to locate individual context-specific directories.
  - If only a root `CONTEXT.md` exists, treat the repo as a single context.
  - If neither exists, create a root `CONTEXT.md` lazily when the first glossary term is resolved.
  - When multiple contexts exist, infer which context directory the current topic belongs to. If unclear, ask.
- **Format:** For new glossary files, use the template in `assets/context-template.md`. For new context maps, use `assets/context-map-template.md`.

### 2. Architecture Decision Records (ADRs)
- **Location:** System-wide ADRs live in `{{ env "DOCS_INTERNAL_DIR" }}/adr/`. Context-specific ADRs live in `{{ env "DOCS_INTERNAL_DIR" }}/adr/` relative to their respective context directory.
- **Directory Creation:** Create the `adr/` directory lazily — only when the first ADR is needed.
- **Naming & Sequential Numbering:** Use `0001-slug.md`, `0002-slug.md`, etc., with sequential 4-digit zero-padded numbers. Scan the target `adr/` folder for the highest existing number and increment by one.
- **Format:** For new ADRs, use the template in `assets/adr-template.md`.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update the appropriate `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the template in `assets/context-template.md` (or `assets/context-map-template.md` if updating a context map).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. When creating a new ADR, increment the sequence number according to the **Architecture Decision Records (ADRs)** naming rules, and use the template in `assets/adr-template.md`.

</supporting-info>
