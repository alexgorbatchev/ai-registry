# AGENTS.md Guidelines

These guidelines are for the canonical repository `AGENTS.md` format. Do **not** confuse it with GitHub Copilot custom agent persona files under `.github/agents/*.md`.

## Core Principles

- **Human-curate from repository evidence.** Do not blindly auto-generate and commit.
- **Include only non-inferable or high-leverage details.** Do not duplicate what can be easily inferred from code, manifests, or `README.md`.
- **Put executable commands early** and include copy-paste ready flags when they matter.
- **Prefer one real example or gotcha** over paragraphs of generic advice.
- **Make boundaries explicit** with `Always`, `Ask first`, and `Never` when risk is non-trivial.
- **Keep the root file lean.** Split into nested `AGENTS.md` files when module rules diverge.
- **Treat `AGENTS.md` as the source of truth.**

## Discovery Before Writing

Inspect all of the following before drafting or editing:
- Lockfiles, manifests, workspace files, and task runners.
- `package.json`/`Makefile`/`justfile`/`Taskfile`/language-specific build files.
- CI workflows and release automation.
- Existing `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, and relevant docs.
- At least one canonical code example in each major area you document.
- Monorepo and package boundaries.

Never invent commands, folders, or rules.

## Choose the File Topology

*   **Root Only:** Use when the repo is single-package or when nearly all rules are shared.
*   **Root + Nested:** Use when any of the following are true:
    - Multiple apps/packages/services have different commands.
    - Stacks differ across workspaces.
    - Test/lint/build workflows differ significantly.
    - Directory-specific boundaries would clutter the root file.

### Root File Responsibilities
Keep the root file as the routing/navigation layer:
- Shared commands (Install, Test all, Lint all).
- Workspace map / nested file pointers (e.g., `apps/web/` -> `apps/web/AGENTS.md`).
- Shared gotchas and cross-workspace failure modes.
- Shared boundaries.
- Shared non-obvious conventions.
- Navigation to nested `AGENTS.md` files or deeper docs.

### Nested File Responsibilities
Each nested file should contain:
- One-sentence local purpose.
- Local commands (Dev, Test, Lint).
- Local conventions and gotchas.
- Local boundaries.
- Local references.

### Target File Lengths
Use line counts as guardrails, not as strict goals:
- Single-project root: usually 40–90 lines.
- Monorepo root: usually 40–100 lines.
- Nested file: usually 20–60 lines.

---

## Generation and Refactoring Workflow

Use this workflow when creating a new `AGENTS.md` or refactoring a bloated one.

1.  **Target the Right Artifact:** Focus on canonical `AGENTS.md` files. Do not generate specialized persona files unless explicitly requested.
2.  **Decide What Deserves Space:**
    *   **Include:** Custom commands, non-standard task runners, counterintuitive patterns that agents get wrong, required setup facts, explicit boundaries, and house-style file examples.
    *   **Exclude:** Architecture essays, framework docs, style rules already enforced by linters/formatters, duplication of `README.md`, or aspirational rules.
3.  **Put Commands First:** List runnable and copy-paste ready commands early. Prefer package-scoped or file-scoped commands over full-repo commands when available.
4.  **Use Concrete Examples over Prose:** Point to a real file or show a short code block to clarify a convention rather than writing generic guidelines.
5.  **Make Boundaries Explicit:** Use a three-tier boundary model (`Always` / `Ask first` / `Never`) grounded in actual repository risk (e.g. database migrations, secrets, or dependency changes).
6.  **Compatibility Files:** If the repo uses adjacent instruction files or legacy names (like `AGENT.md`), prefer `AGENTS.md` as the canonical name. Migrate or alias if supported and useful, but do not overwrite legacy files destructively without confirmation.

---

## Maintenance and Auditing Workflow

Use this workflow when `AGENTS.md` already exists to keep it current and remove drift.

### Audit Mode
Default to a quick audit by asking:
1. Are the core commands present and runnable?
2. Do commands match current scripts/tooling?
3. Is required setup documented when it blocks execution?
4. Is at least one real project-specific gotcha documented?
5. Do gotchas include the corrective action?
6. Are implementation-affecting conventions explicit?
7. Does every line earn its keep?
8. Is the file free of framework-doc or README duplication?
9. Are linked paths and nested file references current?
10. Should some of this content move to nested files or external docs?

If the answer is "no" to several of these, the file needs updating.

### Repair Order
Fix problems in this order:
1. Broken or stale commands.
2. Stale paths, package names, or workflow references.
3. Contradictory rules.
4. Generic filler and duplicated docs.
5. Missing boundaries or missing non-obvious patterns.
6. Missing nested files for divergent workspaces.

### Incremental Updates vs. Full Rewrites
Prefer targeted edits when the existing file still contains useful signal. Rewrite from scratch only when:
- The file is mostly boilerplate or template text.
- Most commands are wrong.
- The structure fights the repository topology.
- Monorepo-specific detail is crammed into root and cannot be salvaged cleanly.

### What to Remove Aggressively
Delete generic filler unless they are genuinely non-obvious and repo-specific:
- “Follow best practices” / “Write clean code”.
- Framework overviews or full directory dumps.
- Stale architecture or historical notes explaining past migrations.
- Repeated rules already enforced by linters or formatters.

### What to Preserve Aggressively
- Commands agents actually run.
- Failure modes that burned the team before.
- Intentionally weird patterns that look wrong to outsiders.
- Security and secrets boundaries.
- Approval-required changes.
- Package-local rules in nested files.

### Audit Reporting Format
When editing an existing `AGENTS.md`, report findings to the user before major rewrites using a compact table like:

```md
## AGENTS.md audit

| File | Status | Key issues |
|------|--------|------------|
| `./AGENTS.md` | Needs update | stale test command, duplicated README guidance |
| `apps/web/AGENTS.md` | OK | missing local lint command |
```

Propose the smallest set of changes that would make the file trustworthy again.

---

## Final Quality Checklist

Use this checklist before finalizing a new or updated `AGENTS.md`:

*   [ ] **Commands:** Ready to copy-paste, unverified commands removed, and verified against scripts/tooling.
*   [ ] **Signal:** Only contains repository-specific, non-inferable guidance.
*   [ ] **Gotchas:** At least one real gotcha or counterintuitive pattern is documented with a clear corrective action.
*   [ ] **Boundaries:** Explicit where risk exists.
*   [ ] **Conventions:** Clear examples or file paths are provided instead of abstract prose.
*   [ ] **Scope:** Root file contains only shared rules, and nested `AGENTS.md` files exist where package rules diverge.
*   [ ] **Hygiene:** README/framework duplication is removed, and linked paths resolve.

### Automatic Fail Conditions
Treat the result as failed if:
- Most commands are stale or unverified.
- The file is mostly generic template text.
- The file duplicates framework docs or README sections.
- A monorepo root file contains package-specific detail with no nested split.
- Critical boundaries are missing for secrets, deployments, or vendor/generated code.

### Litmus Test
Ask of every single line:
> *If this line is removed, is the agent materially more likely to make a mistake?*
> If the answer is no, cut or move it.
