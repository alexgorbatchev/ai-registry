---
description: Audit and refresh all root and nested AGENTS.md files based on the latest docs-writer skill guidelines and current codebase reality.
---

Audit and refresh all `AGENTS.md` files (both root and nested) across the repository to eliminate drift, verify commands, and bring them into compliance with the latest `docs-writer` skill instructions.

Fully rewrite each file using the docs-writer "Full Rewrite of Existing Agent Instructions" procedure. Preserve substantive technical details even when they require sections absent from the templates; do not limit this work to removing task history or patching isolated lines.

## Step 1: Load Latest Skill Guidelines & Discover Files

1. Load and read the `docs-writer` skill and its reference guidance:
   - Read `skills/docs-writer/SKILL.md`
   - Read `skills/docs-writer/references/agents.md`
   - Read `skills/docs-writer/assets/agents-templates.md`
2. Discover all existing `AGENTS.md` (and legacy `AGENT.md` or `agents.md`) files across the repository:
   - Root `AGENTS.md`
   - All nested `**/AGENTS.md` files in packages, apps, harnesses, or subdirectories
3. Inspect current codebase state and tooling:
   - Lockfiles, workspace manifests (`package.json`, `Cargo.toml`, `go.mod`, etc.), and task runners (`Makefile`, `justfile`, `Taskfile`)
   - Build, lint, test, and release scripts
   - Repository directory topology and monorepo boundaries

## Step 2: Audit Existing AGENTS.md Files

For every discovered `AGENTS.md` file, evaluate against the audit criteria:
1. Are core commands present, accurate, and runnable?
2. Do commands match current scripts/tooling in the codebase?
3. Is required setup/prerequisite state documented when it blocks execution?
4. Is at least one real project-specific gotcha or non-obvious failure mode documented with corrective action?
5. Are implementation-affecting conventions explicit with concrete examples?
6. Are explicit boundaries (`Always`, `Ask first`, `Never`) present and grounded in repository risk (including mandatory test file updates and 90% code coverage requirement for code-based projects, excluding `scripts/`)?
7. Does every line earn its keep (high signal-to-density ratio)?
8. Is the file free of generic filler ("write clean code"), framework overviews, and `README.md` duplication?
9. Are linked paths, package names, and nested file references current?
10. Is the file topology correct (lean root file as routing/navigation; nested files for divergent package/workspace rules)?
11. Does each recorded user instruction pass the docs-writer persistence filter (standing project rule, current wording, no task history or dated amendment)?

Produce and display an audit report table summarizing current state:

```md
## AGENTS.md audit

| File | Status | Key issues |
|------|--------|------------|
| `./AGENTS.md` | ... | ... |
| `packages/foo/AGENTS.md` | ... | ... |
```

## Step 3: Refresh and Repair

Execute updates in strict priority order:

1. **Fix Broken/Stale Commands:** Verify every command against current scripts/tooling before writing.
2. **Fix Stale Paths & References:** Update renamed directories, moved packages, or modified workflows.
3. **Resolve Contradictory Rules:** Eliminate conflicting guidelines across root and nested files.
4. **Remove Task History, Generic Filler & Duplication:** Extract established standing rules and technical details from mixed narrative. Remove dated amendments, supersession narratives, progress, handoffs, temporary coordination/authorization state, and test-run reports. Remove generic framework overviews and consolidate duplicated guidance without losing unique details. Do not infer new permanent rules from one-task requests.
5. **Add Missing Gotchas & Boundaries:** Ensure explicit `Always`, `Ask first`, `Never` rules and record non-obvious failure modes.
6. **Adjust Topology:** If package or workspace rules diverge, split monorepo details out of root into nested `AGENTS.md` files.

### Update Strategy
- **Full Rewrite:** Inventory every substantive rule and technical detail, verify/classify the inventory, and write a complete replacement organized by subject. Adapt the structure to fit the content. Existing useful signal must survive the rewrite; it is not a reason to fall back to targeted edits.
- **Preservation Review:** Account for each inventory item at an exact destination or provide an evidenced removal reason. Preserve unresolved details with uncertainty explicit and report questions. Never discard technical substance for template fit, inferability, brevity, or line-count targets.
- **Current Files:** Edit current files without rewriting Git history or appending a cleanup summary to `AGENTS.md`.

## Step 4: Quality Check & Finalize

Validate every updated `AGENTS.md` file against the final quality checklist:
- [ ] All commands are copy-paste ready and verified against repository scripts.
- [ ] Guidance and technical context are repository-specific; technical details were preserved regardless of template fit or inferability.
- [ ] At least one real gotcha or counterintuitive pattern is documented with corrective action.
- [ ] Explicit risk boundaries (`Always`, `Ask first`, `Never`) are present (including mandatory test updates & 90% code coverage for code-based projects, excluding `scripts/`).
- [ ] Root file acts as routing/navigation layer; nested files cover package/workspace specifics.
- [ ] No generic filler, framework overviews, or `README.md` duplication remains.
- [ ] Standing project instructions and technical context remain; changed rules are updated in place, with no task history, progress, handoffs, or dated amendments.
- [ ] Every original substantive rule and technical detail has a verified destination or evidenced removal reason; no scope, exception, contract, or restriction was lost.

After updating the files, run `bun run build` from the repository root to regenerate all harness outputs.
