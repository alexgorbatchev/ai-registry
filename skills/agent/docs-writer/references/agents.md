# AGENTS.md Guidelines

These guidelines are for the canonical repository `AGENTS.md` format. Do **not** confuse it with GitHub Copilot custom agent persona files under `.github/agents/*.md`.

## Core Principles

- **Human-curate from repository evidence.** Do not blindly auto-generate and commit.
- **Preserve technical substance during cleanup.** Preserve project rules and substantive technical details even when they do not fit these templates or preferred sections. Formatting, brevity, inferability, and line-count guidance never justify losing technical content; use the full rewrite procedure below.
- **Include only non-inferable or high-leverage details.** Do not duplicate what can be easily inferred from code, manifests, or `README.md`.
- **Put executable commands early** and include copy-paste ready flags when they matter.
- **Prefer one real example or gotcha** over paragraphs of generic advice.
- **Make boundaries explicit** with `Always`, `Ask first`, and `Never` when risk is non-trivial.
- **Mandatory Testing & Coverage in Code-Based Projects:** For code-based projects, any time code is changed such that results from running that code are changed, a test file must be changed as well, and 90% code coverage is required (the `scripts/` folder is explicitly excluded from this rule). These instructions must ONLY be added to `AGENTS.md` for code-based projects.
- **Never publish releases automatically:** Never publish releases, tags, packages, or production deployments automatically without explicit user authorization.
- **Persist project rules selectively.** Apply the persistence filter below before recording user guidance. Update the relevant rule in place; never append a chronological amendment.
- **Keep the root file lean.** Split into nested `AGENTS.md` files when module rules diverge.
- **Treat `AGENTS.md` as the source of truth.**

## Persistence Filter: Project Rules vs. Task History

Before adding or updating a rule, check all of the following:

1. **Future scope:** The guidance applies to future tasks in this repository or subtree, independently of the current task. Persist user instructions only when they explicitly establish a standing rule or correct an established project convention; never infer a permanent policy from a one-task request. If that scope is unclear, keep it in the current conversation and ask before persisting it.
2. **Instruction form:** Write the rule as a present-tense command or constraint. Exclude who requested it, conversation dates, prior decisions, amendment/supersession narration, task IDs, agent assignments, handoffs, source leases, pending work, and test-run results. Metadata timestamps remain metadata.
3. **Single current rule:** Update or replace the relevant existing rule in the narrowest applicable `AGENTS.md`. Remove obsolete wording; do not preserve conflicting instructions by appending an exception or an "amendment". Apply an explicit user-authorized rule change without asking again; clarify unresolved conflicts before changing a rule.
4. **Correct destination:** Keep task requirements, progress, temporary authorization boundaries, and coordination details in the conversation or an existing task/handoff document. Put decision history in an existing decision record. Keep technical provenance in maintained dependency documentation when available; otherwise preserve necessary provenance in an appropriate technical section. Do not create extra documents merely to relocate every excluded sentence.

For mixed paragraphs, preserve standing rules and substantive technical details while omitting the task narrative. Apply the future-scope filter to proposed instructions, not as a reason to discard technical facts. An unresolved task does not justify an entry in `AGENTS.md`.

Example:

- **Task narrative to exclude:** "The user's dated amendment moves this patch into a fork, superseding the earlier plan; the installer migration awaits the handoff and tests still need proof."
- **Standing rule to retain only when established:** "Maintain dependency patches in the upstream fork and consume an immutable revision."
- **One-task request:** "Move this patch into the fork for this issue." Do not turn it into the standing rule above.

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

Exceed these ranges or add project-specific sections when needed to preserve technical substance. Do not truncate or replace precise details with vague summaries to meet a size target.

---

## Generation and Refactoring Workflow

Use this workflow when creating a new `AGENTS.md` or refactoring a bloated one.

1.  **Target the Right Artifact:** Focus on canonical `AGENTS.md` files. Do not generate specialized persona files unless explicitly requested.
2.  **Decide What Deserves Space:**
    *   **Include:** Custom commands, non-standard task runners, counterintuitive patterns that agents get wrong, required setup facts, explicit boundaries, and house-style file examples.
    *   **Exclude:** Generic architecture essays, framework docs, and aspirational rules. Consolidate duplication without losing unique details; retain project-specific architectural contracts and technical constraints even when they require additional sections.
3.  **Put Commands First:** List runnable and copy-paste ready commands early. Prefer package-scoped or file-scoped commands over full-repo commands when available.
4.  **Use Concrete Examples over Prose:** Point to a real file or show a short code block to clarify a convention rather than writing generic guidelines.
5.  **Make Boundaries Explicit:** Use a three-tier boundary model (`Always` / `Ask first` / `Never`) grounded in actual repository risk (e.g. database migrations, secrets, or dependency changes). Include the rule to persist only standing project instructions, update existing rules in place, and exclude task history. For code-based projects, explicitly include the mandatory rule: any time code is changed such that results from running that code are changed, a test file must be changed as well, and 90% code coverage is required (the `scripts/` folder is excluded from this rule; omit this rule for non-code projects/subtrees). Explicitly include the rule to never publish releases, tags, packages, or production deployments automatically without explicit user authorization.
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
11. Does every recorded user instruction pass the persistence filter, with no task history or chronological amendments?

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
When the user asks to clean up, rewrite, or bring agent instructions into conformance with this skill, fully rewrite the requested files using the procedure below. Useful existing content is input to preserve, not a reason to limit the work to a patch. For a narrowly requested correction or an audit without authorization to rewrite, use targeted edits. Otherwise, a full rewrite is appropriate when:
- The file is mostly boilerplate or template text.
- Most commands are wrong.
- The structure fights the repository topology.
- Monorepo-specific detail is crammed into root and cannot be salvaged cleanly.

### What to Remove Aggressively
Delete generic filler unless they are genuinely non-obvious and repo-specific:
- “Follow best practices” / “Write clean code”.
- Framework overviews or full directory dumps.
- Stale architecture or historical notes explaining past migrations.
- Dated user amendments, supersession narratives, task status, agent handoffs, temporary coordination/authorization state, and test-run reports. Retain any established standing rule by rewriting it in place using the persistence filter.
- Repeated rules already enforced by linters or formatters.

### What to Preserve Aggressively
- Commands agents actually run.
- Failure modes that burned the team before.
- Intentionally weird patterns that look wrong to outsiders.
- Security and secrets boundaries.
- Approval-required changes.
- Package-local rules in nested files.

### Full Rewrite of Existing Agent Instructions

Use this procedure for cleanup, rewrite, or skill-conformance requests, whether or not the files contain task history and whether or not their content is already committed. Rewrite the complete requested files from their preserved substance and repository evidence. Do not merely delete offending paragraphs, apply the template mechanically, or rewrite Git history.

1. **Establish scope and read the hierarchy:** Inspect the requested files and their inherited/nested instructions, then gather the evidence listed under Discovery Before Writing. Check the working diff and preserve unrelated changes. Rewrite only the files within the requested scope; do not restore an older version wholesale or expand a single-file request into a repository-wide rewrite.
2. **Inventory before drafting:** Account for every substantive rule and technical detail in the original files, including details embedded in narrative. Capture commands and flags, paths, API contracts, configuration/resolver semantics, dependency versions and immutable origins, licensing/provenance, input/output behavior, exceptions, numeric thresholds, test obligations, and approval boundaries where present. Keep this working inventory outside the instruction files; do not add categories or requirements absent from the source.
3. **Verify and resolve:** Classify inventory items as current guidance, technical context, duplicates, demonstrably obsolete content, task narrative, or unresolved claims. Use source/configuration, maintained docs, and relevant Git diffs/history where needed. Neither a recent date nor an implementation mismatch establishes a policy change. Report requirements that code does not yet satisfy instead of weakening them. Preserve unresolved technical content with its uncertainty explicit, ask a focused question, and continue rewriting independently resolved material; never silently delete or present it as verified.
4. **Design the complete replacement:** Organize by current subject and applicable scope. Start from the templates, then add or adapt headings such as architectural contracts, dependency provenance, resolver behavior, or verification requirements to fit actual content. Preserve exact technical semantics and rule strength. Templates, preferred headings, inferability, and length targets cannot override preservation. Keep details in the requested file when no appropriate maintained destination exists. Relocate only within authorized scope, preserve equivalent detail at the destination, and add a resolving link from the applicable instruction file.
5. **Write the whole file:** Produce coherent current-state instructions and technical context, rather than retaining the old structure with appended corrections. Consolidate only semantically equivalent duplicates; retain their unique qualifiers. Remove task narration using the persistence filter, extract its technical substance first, and replace obsolete statements only with an evidenced current counterpart. Do not create a changelog, move task history into another instruction file, or replace exact details with generic advice.
6. **Check for information loss:** Map every inventory item to its exact location in the replacement, an equivalent existing reference, or an evidenced removal reason. Valid removal reasons are equivalent duplication, demonstrated obsolescence, task-only narrative, or explicit user authorization; poor template fit, awkward wording, and excessive length are not valid reasons. Compare the before/after content and diff for changed scope, dropped exceptions, altered contracts, and weakened restrictions. Verify commands, paths, and reference destinations. Restore any unintentionally dropped or unresolved detail before finishing.
7. **Report outside the file:** Summarize the full rewrite, substantive consolidations/relocations, evidenced removals, verification, and unresolved questions in the response or change description. Keep the inventory and cleanup summary out of `AGENTS.md`. Commit only when requested; never amend, reset, or rewrite existing commits merely to clean up their documentation.

For example, given a mixed paragraph saying a dated user amendment moves a patch to a fork, retains the project's 90% coverage requirement, and leaves migration waiting for a handoff:

- Remove the date, amendment/supersession wording, migration status, and handoff condition.
- Keep the established 90% coverage rule with its original scope and exceptions; consolidate it with the existing testing rule.
- Keep the fork requirement only if evidence establishes it as a standing project rule. If it is a one-task migration request, exclude it; if its scope is unresolved, ask without inventing a permanent dependency policy.
- Preserve any exact dependency origin, licensing obligation, resolver semantics, and input/output distinctions embedded in that paragraph. Put them in suitable technical sections even if the template has no matching heading.

### Audit Reporting Format
When editing an existing `AGENTS.md`, report findings to the user before major rewrites using a compact table like:

```md
## AGENTS.md audit

| File | Status | Key issues |
|------|--------|------------|
| `./AGENTS.md` | Needs update | stale test command, duplicated README guidance |
| `apps/web/AGENTS.md` | OK | missing local lint command |
```

For cleanup/conformance requests, report the replacement structure and preservation risks, then perform the authorized full rewrite. For narrow corrections, report and apply targeted changes. The audit report does not introduce an additional approval gate.

---

## Final Quality Checklist

Use this checklist before finalizing a new or updated `AGENTS.md`:

*   [ ] **Commands:** Verified against scripts/tooling and ready to copy-paste; unresolved commands are preserved with uncertainty explicit and reported rather than silently removed.
*   [ ] **Signal:** Contains repository-specific guidance and preserved technical context; template fit and inferability have not caused information loss.
*   [ ] **Gotchas:** At least one real gotcha or counterintuitive pattern is documented with a clear corrective action.
*   [ ] **Boundaries:** Explicit where risk exists.
*   [ ] **Release Boundaries:** Explicitly specifies never publishing releases, tags, packages, or production deployments automatically without explicit user authorization.
*   [ ] **Code Testing & Coverage (Code-Based Projects Only):** Includes the rule requiring a corresponding test file change and 90% code coverage whenever code changes affect runtime execution results (excluding the `scripts/` folder; omitted for non-code projects).
*   [ ] **Conventions:** Clear examples or file paths are provided instead of abstract prose.
*   [ ] **Scope:** Root file contains only shared rules, and nested `AGENTS.md` files exist where package rules diverge.
*   [ ] **Hygiene:** README/framework duplication is removed, and linked paths resolve.
*   [ ] **Persistence:** Standing project instructions and technical context remain; changed rules are updated in place, and no task history, progress, handoff, or dated amendment is recorded.
*   [ ] **Rewrite Preservation:** Every original rule and technical detail is accounted for at an exact destination or has an evidenced removal reason; unresolved details are preserved with uncertainty explicit.

### Automatic Fail Conditions
Treat the result as failed if:
- Most commands are stale or unverified.
- The file is mostly generic template text.
- The file duplicates framework docs or README sections.
- A monorepo root file contains package-specific detail with no nested split.
- Critical boundaries are missing for secrets, deployments, or vendor/generated code.
- The file records task history, progress, handoffs, dated amendments, or obsolete rules alongside their replacements.
- Technical details or constraints were lost because they did not fit a template, preferred section, brevity goal, or line-count target.

### Litmus Test
Ask of every single line:
> *If this line is removed, is the agent materially more likely to make a mistake?*
> If the answer is no, consider consolidation or relocation. During a rewrite, deletion still requires an evidenced removal reason under the preservation procedure.
