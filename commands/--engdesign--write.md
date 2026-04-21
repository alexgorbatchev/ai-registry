---
description: Draft or harden an implementation-ready engineering design document with repo grounding and independent review validation
name: 'engdesign:write'
---

Write or harden an engineering design document that another engineer can implement without re-deriving architecture, contracts, or sequencing.

The output must be implementation-ready, repository-grounded, and review-validated.

## Inputs

You will be given:
- a target doc path such as `<design-doc-path>`
- a feature or change request such as `<objective>`
- optionally: scope limits, non-goals, or required file/module areas

If the target path is not provided, stop and ask for it.

## Non-negotiables

- Follow all project instructions and mandatory skills before writing or editing files.
- Read the `engineering-design-docs` skill and its template before drafting or hardening.
- Use repository structure discovery before broad file reading. If the active environment provides a dedicated repository-mapping capability, use it; otherwise use the best project-approved structural discovery workflow.
- Ground the design in the actual repository, not assumptions.
- Separate verified current-state baseline from proposed target-state requirements.
- Do not leave architectural choices as options when the design needs a chosen implementation.
- Do not use soft requirement language for in-scope behavior.
- Do not describe APIs, events, types, or state transitions only in prose when exact contracts are knowable.
- Do not silently change unrelated source files.
- Do not stop after writing the first draft. Run the required review pass and tighten the doc based on the findings.

## Step 1: Determine mode and lock the objective

Choose the mode explicitly before writing:

- **Draft mode**: the target doc does not exist yet, or the user asked for a new design doc
- **Harden mode**: the target doc already exists and the user asked to tighten or finalize it

In both modes, identify and write down:
- the exact objective
- the exact in-scope work
- explicit non-goals
- unresolved decisions that would block an exact design

In harden mode, read the existing target doc first and run an ambiguity-first pass before rewriting sections. Preserve product decisions unless the user explicitly changes them.

If a critical product or architecture decision is still unresolved, stop and ask the user instead of encoding multiple alternatives.

## Step 2: Read the governing instructions first

Before drafting:
1. read repository instruction files recognized by the active workflow (`AGENTS.md`, `CLAUDE.md`, `.rulesync` rules, or equivalent repository guidance)
2. identify applicable mandatory skills from the project and read them fully
3. read the `engineering-design-docs` skill and its template
4. before broad file reading, use the strongest repository-structure discovery capability available in the active environment. If the task is narrow, keep this pass lightweight and then move to targeted reads

If the repository has topic-specific docs that the requested feature depends on, read those too.

## Step 3: Build the verified baseline

Read the current implementation and record only verified facts about:
- entrypoints
- routes / commands / jobs
- data flow
- current state ownership
- schema / tables / storage
- API contracts
- existing tests
- known gaps or mismatches relevant to the requested work

Do not mix these facts with target-state requirements.

When the repo is large, start with:
1. the strongest repository-structure discovery capability available in the active environment
2. focused symbol/file lookups
3. targeted reads of the exact files that own the current behavior

## Step 4: Choose the exact architecture

Turn the request into a single chosen implementation.

For the design, specify exact decisions for:
- file and module layout
- route / handler / job ownership
- shared state ownership
- request/response/event contracts
- persisted types / schemas / enums
- validation rules
- error and repair behavior
- migration behavior for any old state or legacy URLs/config
- implementation order
- tests and definition of done

Explicitly reject the main wrong alternatives when doing so prevents ambiguity.

## Step 5: Write the design doc with the required structure

Use this structure unless the user explicitly asked for a narrower format:

```md
# <Title>

## Read this first
## 1. Objective and non-goals
## 2. Current codebase baseline
## 3. Non-negotiable constraints
## 4. Exact architecture choice
## 5. Data model / schema
## 6. Types and contracts
## 7. Exact file plan
## 8. Runtime behavior
## 9. Validation rules
## 10. Exact API surface
## 11. Implementation order
## 12. Testing plan
## 13. Out-of-scope / rejection list
## 14. Definition of done
```

`## Read this first` is required whenever there are binding prerequisite docs, specs, policies, or research that an implementation agent must read before coding.

Requirements for the content:
- use hard requirement language: `must`, `must not`, `use this exact shape`, `return this exact response`
- include exact file paths when they are knowable
- in the file plan, distinguish exact files to add, exact files to modify, and exact files to delete
- in the file plan, give every file a one-responsibility ownership block
- define TypeScript shapes for important contracts when the repo uses TypeScript or when TS-like contracts improve precision
- define exact event unions for SSE/streaming endpoints
- state endpoint semantics explicitly when relevant: persistence timing, ordering guarantees, idempotency, delete semantics, reversibility, and whether historical snapshots stay immutable
- name ownership of every state update, persistence action, and repair path
- make the implementation order minimize integration risk

## Step 6: Run the ambiguity sweep before review

Before asking for review, audit the draft for:
- soft verbs instead of hard requirements
- wildcard paths where exact files are knowable
- unresolved naming mismatches
- prose-only API descriptions
- undefined data ownership
- duplicated or contradictory contracts
- placeholder phrases such as `if needed`, `for example`, `etc.` in core implementation sections
- stale baseline facts that do not match the current repo

Fix these before the review pass.

## Step 7: Run the required review pass

After drafting, run a separate review pass.
Use the strongest independent review workflow available in the active environment. If the platform supports a separate reviewer or review mode, use it; otherwise perform an explicit self-review and label it as such.

Required workflow:
1. run the strongest available independent review workflow against the design doc, the repository, and the request. If the platform supports a separate reviewer or review mode, use it; otherwise perform the same audit yourself as an explicit self-review section
2. focus the review on:
   - baseline mismatches
   - ambiguity
   - missing file-plan items
   - contradictory ownership
   - missing contracts or event unions
   - unresolved sequencing problems
   - stale assumptions
3. fix the document based on the review findings
4. run at least one follow-up review pass if the first review found material issues

## Step 8: Final verification before writing or finishing

Before you finish, confirm all of the following:
- the baseline is clearly separated from the target state
- every in-scope behavior is specified exactly
- every route/API/event contract is explicit
- every file plan entry is named exactly
- validation rules are testable
- implementation order is concrete
- out-of-scope items are explicit
- the doc is understandable by an engineer with zero prior context

## Output expectations

When done:
- write the design doc to `<design-doc-path>`
- summarize the file written
- summarize the review findings you addressed and say whether they came from an independent reviewer/workflow or self-review
- call out any remaining repository/documentation mismatches that were observed but not changed because the user did not ask for source-doc edits

## What not to do

- Do not implement the feature unless the user explicitly asks for implementation.
- Do not produce a recommendation memo when the user asked for an engineering design.
- Do not leave core behavior unspecified and expect the implementer to infer it.
- Do not skip the required review pass. Use the strongest available independent review workflow; otherwise perform the explicit self-review defined above.
- Do not silently repair unrelated source docs unless the user explicitly asks for that too.
