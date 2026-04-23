---
name: engineering-design-docs
description: Write or tighten implementation-ready engineering design documents, technical design specs, and exact implementation plans. Use when drafting a new eng design doc at `docs/internal/eng-designs/topic-name/DESIGN.md`, converting a recommendation-style doc into an exact build spec, defining file-level architecture, API/schema/state contracts, validation rules, implementation order, or reviewing a design doc for ambiguity, stale assumptions, wildcards, and prose-only contracts before engineering starts.
---

# Engineering Design Docs

Produce docs that another engineer can implement without design interpretation.
Prefer exact contracts over recommendations.

## Default output path

- Write new engineering design docs to `docs/internal/eng-designs/<topic>/DESIGN.md`.
- Derive `<topic>` from the feature, subsystem, or initiative name and use descriptive `kebab-case`.
- Create the topic directory if it does not exist.
- When tightening an existing design doc, keep its canonical path unless the user explicitly asks to move it.

## Choose the mode

1. **Draft a new design doc**
   - Read `references/template.md`.
   - Capture the current-system baseline before describing the target state.
   - Fill every required section with chosen implementation details.
2. **Harden an existing design doc**
   - Audit for ambiguity first.
   - Replace soft language, unresolved choices, wildcards, and prose-only contracts.
   - Keep product decisions intact while making implementation exact.

## Follow this workflow

1. Lock the objective, scope, and explicit non-goals.
2. Read the current implementation and record the baseline separately from the proposed design.
3. Turn product decisions into chosen engineering decisions.
4. Specify exact files, modules, routes, types, schema changes, validation rules, and UI/runtime behavior.
5. Define request/response contracts as TypeScript types, not prose bullets.
6. Define implementation order that minimizes integration risk.
7. Define tests and a concrete definition of done.
8. Run an ambiguity sweep before finishing.

## Enforce these rules

- Do not write a recommendation memo when the user asked for an engineering design.
- Do not leave architectural choices as menus.
- Do not use `should`, `may`, `recommended`, `suggested`, `ideally`, or similar soft language for in-scope implementation behavior.
- Do not use wildcards in file plans such as `foo/*` when exact files are knowable.
- Do not describe new endpoints only in prose.
- Do not mix current baseline facts with target-state requirements.
- Do not keep stale assumptions after the codebase changes.
- Do not preserve ambiguity just because an earlier doc was vague.
- If a critical product or architecture decision is still unresolved, stop and get that decision instead of encoding multiple alternatives.

## Make the doc implementation-ready

Include exact decisions for:
- file and module layout
- DB tables, columns, indexes, and migration rules
- request/response/event contracts
- persisted data shapes and TypeScript types
- runtime state transitions
- validation and repair behavior
- UI composition and interaction rules
- implementation order
- test coverage
- out-of-scope items to reject during implementation review
- definition of done

## Run the ambiguity sweep

Check for these failure modes:
- soft verbs instead of hard requirements
- duplicated or conflicting contracts across sections
- API sections written as prose instead of types
- wildcard paths where exact file lists are possible
- placeholder phrases like `if needed`, `for example`, or `etc.` in core implementation sections
- phrases like `support X` without exact request, response, or state semantics
- undefined ownership for data updates, persistence, or validation
- unresolved naming mismatches between frontend, backend, and schema sections
- outdated baseline text that no longer matches the repository

## Use the reference

Read `references/template.md` when:
- drafting a new doc from scratch
- replacing vague sections with exact contracts
- converting prose API descriptions into TypeScript types
- performing the final ambiguity sweep
