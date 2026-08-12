---
description: Audit and refresh all root and nested AGENTS.md files based on the latest internal-docs-writer skill guidelines and current codebase reality.
---

Audit and refresh all `AGENTS.md` files (both root and nested) across the repository to eliminate drift, verify commands, and bring them into compliance with the latest `internal-docs-writer` skill instructions.

## Step 1: Load Latest Skill Guidelines & Discover Files

1. Load and read the `internal-docs-writer` skill and its reference guidance:
   - Read `skills/internal-docs-writer/SKILL.md`
   - Read `skills/internal-docs-writer/references/agents.md`
   - Read `skills/internal-docs-writer/assets/agents-templates.md`
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
6. Are explicit boundaries (`Always`, `Ask first`, `Never`) present and grounded in repository risk?
7. Does every line earn its keep (high signal-to-density ratio)?
8. Is the file free of generic filler ("write clean code"), framework overviews, and `README.md` duplication?
9. Are linked paths, package names, and nested file references current?
10. Is the file topology correct (lean root file as routing/navigation; nested files for divergent package/workspace rules)?

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
4. **Remove Generic Filler & Duplication:** Strip framework overviews, linter-enforced style rules, and duplicate `README.md` text.
5. **Add Missing Gotchas & Boundaries:** Ensure explicit `Always`, `Ask first`, `Never` rules and record non-obvious failure modes.
6. **Adjust Topology:** If package or workspace rules diverge, split monorepo details out of root into nested `AGENTS.md` files.

### Update Strategy
- **Targeted Edits:** Use when existing files have valuable signal and correct structure.
- **Full Rewrite:** Use only if the file is mostly stale template text, most commands are broken, or the structure opposes repository topology.

## Step 4: Quality Check & Finalize

Validate every updated `AGENTS.md` file against the final quality checklist:
- [ ] All commands are copy-paste ready and verified against repository scripts.
- [ ] Guidance is repository-specific and non-inferable from code/manifests.
- [ ] At least one real gotcha or counterintuitive pattern is documented with corrective action.
- [ ] Explicit risk boundaries (`Always`, `Ask first`, `Never`) are present.
- [ ] Root file acts as routing/navigation layer; nested files cover package/workspace specifics.
- [ ] No generic filler, framework overviews, or `README.md` duplication remains.

After updating the files, run `bun run build` from the repository root to regenerate all harness outputs.
