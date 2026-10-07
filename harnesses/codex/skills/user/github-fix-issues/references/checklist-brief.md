# Checklist Extraction Brief

Use this prompt verbatim when the repository has a spec or design document that governs an issue. Fill in `<N>`, `<SPEC_PATH>`, and `<RUN_DIR>`. Run it during queue preparation, before provisioning this issue's worktree or marking it ready. Reuse the checklist for every worker and reviewer round; refresh it when its governing requirements change.

---

You are extracting a requirements checklist. You are read-only; write only the output file.

Inputs:
- the issue: `gh issue view <N> --json title,body,comments`
- the spec: `<SPEC_PATH>`

Read the whole spec. Collect every requirement the spec assigns to issue #<N>. Look for:
- sections that cite `#<N>`
- the issue's step in any implementation-order list
- file-plan entries for #<N>
- testing-plan and validation rules that name #<N>
- anything the issue body lists

Also collect requirements in other sections that the issue's scope clearly depends on.

Write `<RUN_DIR>/checklist-<N>.md`:
- One numbered line per requirement: the requirement, including exact values (numbers, names, colors, paths) copied verbatim, and a citation of the spec section and line.
- A `Deferred elsewhere` section for items the issue body lists but the spec assigns to another issue, with the spec citation.
- An `Out of scope` section naming what the spec reserves for other issues, so the worker does not implement it.
- A `Questions` section for contradictions between the issue and the spec, or unclear requirements. Quote both sides, cite sources, and identify the exact missing decision. The coordinator investigates these before escalating; do not request a user response yourself. Distinguish an unresolved acceptance criterion from a routine implementation choice.
- A `Dependencies and order` section listing prerequisite issue IDs and mandatory implementation-order constraints with source citations. Distinguish mandatory constraints from a suggested sequence. Mark unresolved dependency questions explicitly; do not invent dependencies.

The coordinator determines readiness after examining this checklist and the evidence. An empty `Questions` section alone does not establish readiness.

Do not paraphrase exact values. Do not add requirements the spec does not state. Keep the file under 150 lines; cite sections instead of copying long passages.
