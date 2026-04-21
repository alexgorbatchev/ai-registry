---
description: Analyze git history and write a high-level project evolution report with timestamps, major shifts, deprecations, and a slide-ready summary
name: 'repo-history'
---

Write a repository history report that reconstructs the **evolution of the product and codebase from git history**.

The goal is **not** to list commits. The goal is to identify the **major shifts in feature set, architecture, workflow, and product direction**, then explain those shifts in a way an executive, new engineer, or reviewer can understand.

The default output file is:

- `PROJECT-HISTORY.md`

If the user gives a different target path, use that path instead.

## Non-negotiables

- Follow all project instructions and mandatory skills before writing or editing files.
- Use repository structure discovery before broad file reading. Prefer `repoguide` when available.
- Ground every major claim in **git evidence**: commit IDs, dates, file additions/removals, docs/manifests at key points in time.
- Do **not** rely on commit subjects alone. Validate major claims by inspecting affected files and key snapshots.
- Do **not** produce a raw changelog. Produce a **high-level evolution narrative**.
- Do **not** stop at the current state. Explain the major transitions over time.
- Do **not** ignore abandoned directions, reversals, or feature deprecations. Those are often the most important signals.

## What to look for

You are trying to answer questions like:

- What kind of product was this at the beginning?
- When did it change direction?
- What new capabilities became core?
- What was removed or deprecated?
- When did it move from one architecture/workflow/runtime to another?
- When did it become more general-purpose, more operationalized, or more productized?
- Which experiments were short-lived?
- Which phases were platform-building versus stabilization?

## Required workflow

### 1) Map the current repository first

Before diving into history:

1. Read `README.md` if present.
2. Read the main manifest file(s), for example:
   - `package.json`
   - `go.mod`
   - `Cargo.toml`
   - `pyproject.toml`
   - workspace manifests if relevant
3. Use the repository-mapping tool available in the environment for a structural overview; prefer `repoguide` when available.
4. Identify the main current subsystems, entrypoints, and directories.

This gives you a reference point for understanding what the repo is now.

### 2) Gather the history view

Collect at minimum:

- tags, if any
- early commits in chronological order
- recent commits in reverse chronological order
- monthly or quarterly commit counts
- major file additions and deletions over time

Use git history to find:

- first introduction of major directories/subsystems
- major renames/reorganizations
- commits that add large new areas
- commits that remove or replace large areas
- commits whose messages imply architecture/runtime/workflow changes

Useful patterns include:

- `git log --reverse`
- `git log --summary`
- `git show --stat <sha>`
- `git log --diff-filter=A`
- `git log --diff-filter=D`
- commit counts grouped by month

### 3) Identify candidate “eras” and “inflection points”

Find the time windows that appear to represent meaningful shifts, for example:

- initial creation / first usable product
- introduction of a new runtime or major subsystem
- formal config/schema/rules system added
- validation/testing/quality framework added
- packaging/installability/distribution changes
- migration from one implementation language/runtime to another
- operational scaling features added
- cleanup/stabilization after the main platform work

Do **not** define eras only by calendar months. Define them by **product/architecture shifts**.

### 4) Validate each major shift with real repository evidence

For every proposed era or inflection point:

1. inspect the key commit(s) with `git show --stat`
2. inspect important files at those commits, such as:
   - `README.md`
   - manifest files
   - top-level entrypoints
   - newly added subsystem files
   - deleted subsystem files
3. confirm what actually changed
4. write down the exact commit IDs and dates that support the claim

When useful, compare “before vs after” snapshots of the README or manifest to confirm direction changes.

### 5) Explicitly hunt deprecations and abandoned directions

This is mandatory.

Look for:

- features added and then removed shortly after
- whole directories/subsystems deleted
- replaced workflows or runtimes
- alternative parser/engine/adapter experiments that were abandoned
- docs that disappear or are superseded
- shell scripts replaced by proper CLIs
- caches/workflows/components removed in favor of better mechanisms

For each important deprecation, record:

- when it was introduced
- when it was removed or superseded
- what appears to have replaced it
- why that matters to the project narrative

### 6) Distinguish platform-building from operational hardening

Many repos have a phase where the core platform is built, and a later phase where the focus shifts to:

- testability
- observability
- performance
- CI/runtime stability
- developer ergonomics
- scaling to larger deployments or datasets
- narrowing validation scope for performance reasons

Call out this transition explicitly when the history supports it.

### 7) Write the report in the required structure

Write the history report to `PROJECT-HISTORY.md` unless the user requested another path.

Use this exact structure unless the user explicitly asks for a shorter format:

```md
# <Repo Name> — high-level evolution from git history

Based on `git log` through **<latest date reviewed>**.

## Executive summary

<3–6 bullets or short paragraphs summarizing the major eras and the one-line story>

---

## Timeline of major shifts

### 1) <date range> — <era title>

**What changed**
- ...

**Evidence**
- **<date> — `<sha>`**: ...
- **<date> — `<sha>`**: ...

**Direction signal**
- ...

### 2) ...

---

## Major deprecations / abandoned directions

### A) <short title>
- **Added:** `<sha>` on **<date>**
- **Removed or superseded:** `<sha>` on **<date>**
- Likely interpretation: ...

### B) ...

---

## Activity peaks

Commit volume by month (`git log --no-merges`):

- **YYYY-MM:** <count>
- ...

**Interpretation**
- ...

---

## Slide-ready version (short)

- **<date range>:** ...
- **<date range>:** ...
- ...

---

## Bottom-line narrative

<one paragraph that captures the full arc cleanly>
```

## Writing style requirements

- Be high signal and analytical.
- Prefer **fewer, bigger eras** over many tiny ones.
- Use dates and commit IDs inline.
- Use plain language; avoid internal jargon when possible.
- Explain **why** a change matters, not just what files moved.
- Make the report understandable to someone who has never seen the repo.

## Quality bar for the analysis

A good report will:

- identify the initial product shape correctly
- identify the major pivots correctly
- capture formalization phases like configs/rules/linters/test systems
- capture runtime/workflow rewrites and deprecations
- capture the shift from invention to hardening/optimization if present
- include enough evidence that another engineer can audit the claims quickly

A bad report will:

- just summarize commit subjects chronologically
- ignore deleted code and abandoned features
- overfit to implementation details without explaining direction
- make unsupported claims from commit messages alone
- omit timestamps

## Review pass before finishing

Before writing the final report:

1. sanity-check every era title against the evidence
2. verify that each era has at least 2–3 concrete supporting commits unless the shift is obviously captured by one major commit
3. verify that at least one section covers deprecations/abandoned paths
4. verify that the final narrative is consistent with the evidence
5. verify that the current README/manifests do not silently contradict your interpretation; if they do, call that out

## Final response expectations

When done:

- write the report file
- summarize the major eras in 4–8 bullets
- mention the output path clearly
- call out any important documentation/history mismatch you noticed but did not fix

## Optional add-ons when useful

If the user asks, or if it is clearly valuable, you may also provide:

- a 1-paragraph narrative version
- a 6-slide executive timeline
- a condensed version for PRs/issues/design docs

## Strong heuristics that usually matter

Pay extra attention when history shows any of these patterns:

- `server` + `agent` + `migrator` split appears
- rule parser / grammar / DSL appears
- linters or validators appear
- dedicated test runner infrastructure appears
- worktree / queue / scheduler / progress tracker appears
- large runtime rewrite (for example Python → TypeScript, shell → proper CLI, MCP → direct tools)
- package/install/distribution support appears
- features are added, then removed within days or weeks

These are often the commits that define the project’s true evolution.
