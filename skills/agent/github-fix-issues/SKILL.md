---
name: github-fix-issues
description: >-
  Use when fixing, resolving, or implementing GitHub issues using subagents in any repository,
  including requests to fix a numbered issue, work on open issues with any labels or no labels,
  or execute a delegated issue remediation workflow.
author: alexgorbatchev
metadata:
  created_on: 2026-09-22 14:38
  last_modified: 2026-10-07 14:08
  status: current
---

Filing new issues (use github-issue) and general code review without an issue are outside this workflow's scope.

Read [references/autonomy.md](references/autonomy.md) before discovery. Apply its execution, escalation, validation discovery, and decision-record rules to the coordinator and every delegated agent. The coordinator completes verified merges, pushes, and issue closure within the requested scope without an additional approval phase.

Read [references/readiness.md](references/readiness.md) before queue ingestion. Prepare requirements and readiness states before provisioning issue worktrees; schedule independent ready issues while other questions are investigated.

## Project Discovery

Resolve these once, before provisioning anything, and substitute them everywhere below:

- `<default-branch>`: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
- `<RUN_DIR>`: a unique run directory under the repository's documented scratch location, otherwise `.tmp/issue-pipeline/<run-id>/`. Verify it is git-ignored; create `decisions.md` there as described in the autonomy reference.
- `<project-commands>`: the exact commands the project documents for targeted tests, the full test suite, lint, typecheck, coverage, and the final "run before declaring work complete" gate. Read them from the repository's instruction files (root and nested `AGENTS.md`, `CLAUDE.md`) first, then from build definitions (`justfile`, `Makefile`, `package.json` scripts, `go.mod`, `pyproject.toml`, `Cargo.toml`). Record each command verbatim with the file it came from.
- `<project-rules>`: the coding, logging, testing, coverage-threshold, and file-placement rules those instruction files state, including nested `AGENTS.md` files for the packages an issue touches.
- `<commit-convention>`: the subject format and issue-reference form used by `git log --oneline -30` on `<default-branch>` (for example `fix(scope): summary (fixes #N)`), overridden by any commit rule in the instruction files or the user's instructions, including rules about attribution trailers.

Never invent a command, path, package, or threshold. Extend discovery to CI workflows and executable project scripts when instructions do not name a command. If no aggregate final gate is named, compose and record one from verified project checks as described in the autonomy reference. Mark missing optional categories "none documented" and omit them from execution.

## Concurrency & Worktree Topology

- **HARD PROHIBITION**: The coordinator agent is strictly prohibited from invoking `edit` or `write` on any files inside issue worktrees or package directories. Any file modification to implementation or test code MUST be performed by a delegated child subagent. If the coordinator edits code directly, the turn is an automatic failure.
- **Coordinator Boundary**: The coordinator manages queue ordering, provisions worktrees, receives clean review notifications from subagents, merges verified worktrees into `issues-dev`, tears down worktrees, performs the final merge, and closes GitHub issues. The coordinator does NOT micromanage the review loop.
- **Stable Integration Base**: Fetch `<default-branch>` before creating `issues-dev`. While issue workers are active, do not merge or rebase `issues-dev` onto new upstream commits; synchronize it by rebasing only after every issue worktree is removed.
- **Subagent Rebase Before Review**: Subagents MUST rebase their branch on `issues-dev` before entering the review pairing loop to eliminate integration conflicts for the coordinator.
- **Autonomous Subagent Review Pairing**: Subagents pair with review agents until no further issues are reported ("clean review"), and notify the coordinator only when the review is clean and ready for integration. Where the harness supports nested subagents and permissions allow, the child invokes the reviewer directly; otherwise, the coordinator alternates between writer and reviewer subagents on the issue worktree without editing code directly.
- **Full Queue Completion**: The coordinator works through the entire open issue set, regardless of labels, including unlabeled issues, continuing until no open issues remain.
- **Readiness and Dependency Order**: The coordinator inventories dependencies and mandatory implementation order, then records readiness in `<RUN_DIR>/queue.md`. Start only queued `ready` issues, prioritizing those that unlock documented dependents; use foundational/data/core, services, UI, then tooling as tie-breakers. Hold unresolved issues and their dependents while independent ready issues run. Preserve file-disjointness and the existing concurrency limit.
- **Max 3 Parallel Subagents**: At most 3 subagents may run concurrently. When more than 3 issues are queued, maintain an active pool of up to 3 and launch subsequent issues as earlier ones complete.
- **Central Integration Worktree (`issues-dev`)**: All completed issue fixes merge into a central integration worktree `.workspaces/issues-dev` on branch `issues-dev` (branched from `<default-branch>`). No issue branch merges directly to `<default-branch>`.
- **Per-Issue Worktree Isolation**: Each active issue runs in its own dedicated worktree `.workspaces/issue-<number>` on branch `fix/issue-<number>` (branched from `issues-dev`).
- **Linear Integration**: Rebase each issue branch onto the current `issues-dev` tip before integration and use `git merge --ff-only`. Rebase `issues-dev` onto the current upstream default branch after all issue branches are integrated. Never use a merge commit as a fallback.
- **Harness-Agnostic Subagent Invocation**: Delegate subagents with the active harness's native subagent mechanism. Do not hardcode harness-specific API wrappers, agent profiles, or SDK types.
- **Remote Completion**: The coordinator pushes verified work and closes resolved issues within the requested scope. Do not close an issue until its fix is on the remote `<default-branch>`.

---

## 1. Central Worktree Initialization & Queue Ingestion

1. **Run Project Discovery** as described above.

2. **Initialize Central `issues-dev` Worktree**:
   If `.workspaces/issues-dev` does not already exist:

   ```bash
   git worktree add .workspaces/issues-dev -b issues-dev <default-branch>
   ```

   If it already exists, verify that it contains no merge commits beyond `<default-branch>` and that no issue worker is active. Fast-forward it only when possible; if this command refuses, defer upstream synchronization until final integration:

   ```bash
   git -C .workspaces/issues-dev fetch origin <default-branch>
   git -C .workspaces/issues-dev merge --ff-only origin/<default-branch>
   ```

3. **Ingest Issue Queue**:
   Query all open issues, regardless of labels, including unlabeled issues. Do not apply label filters to the query or discard issues based on their labels:

   ```bash
   gh issue list --state open --json number,title,labels --limit 50
   ```

   For each open issue:

   ```bash
   gh issue view <issue-number> --json number,title,body,comments,labels,author
   ```

   Map dependencies across the requested queue. Apply the readiness reference's preparation steps and write `<RUN_DIR>/queue.md` before provisioning any issue worktree. Prepare each issue's requirements checklist and resolve questions supported by evidence before marking it `ready`. Start eligible ready issues while remaining preparation and investigation continue.

4. **Provision Ready Per-Issue Worktrees (Up to 3 Max)**:
   Recheck the chosen queued `ready` row, its checklist, source revisions, dependencies, and mandatory order. Branch its worktree from the current `issues-dev` tip; do not provision `investigate` or `blocked` issues:
   ```bash
   git worktree add .workspaces/issue-<number> -b fix/issue-<number> issues-dev
   ```

---

## 2. Subagent Worktree Execution & Autonomous Review Pairing

Delegate each issue to a subagent scoped strictly to `.workspaces/issue-<number>`. The brief MUST contain the issue number, title, body, and comments; the worktree path; `<project-commands>` verbatim; `<project-rules>` for the packages involved; `<commit-convention>`; and steps 2A–2E below.

Include the absolute paths of this skill's autonomy reference, `<RUN_DIR>/decisions.md`, `<RUN_DIR>/queue.md`, and the prepared checklist. Require the worker to read them, record decisions in its own worktree's `.tmp/decisions.md`, and send unresolved questions to the coordinator after investigating the available evidence. Update the queue when a worker reports a blocker. Copy its decision entries into the run log before review; pass the log and reference paths to the reviewer and require verification of relevant decisions.

### Step 2A — Red Phase (Failing Reproduction Test)

1. Locate the test file next to the affected code, following the project's existing test layout and naming.
2. Author an automated unit or integration test reproducing the exact defect described in the issue.
3. Run it with the project's targeted-test command inside `.workspaces/issue-<number>` and verify it fails with the expected assertion error. Do not write implementation code until the failure is directly observed in the tool output.

**Exception for Non-Code & Non-Testable Issues**:
When an issue strictly modifies non-testable surfaces (such as documentation, GitHub Actions / CI workflow YAML, static configuration files, assets, or package metadata) where an automated reproduction unit/integration test is inapplicable:
- Skip authoring a reproduction test.
- The subagent brief and report MUST document the non-testable rationale.
- If static validators, linters, or schema checkers exist for the touched files (e.g. `actionlint` for workflows, markdown linters for docs, schema validation), run them as the verification check before and after the change.
- In Step 2E, verify the change using the appropriate static validator or project lint check instead of disabling/re-enabling a reproduction test.

### Step 2B — Green Phase (Primitive-Correct Fix)

1. Implement the change that fixes the root cause.
2. Comply with project constraints:
   - Use native platform primitives (exact types, proper OS APIs, standard library idioms). No shallow proxies, stubs, or wrappers.
   - Follow every rule in `<project-rules>`, including logging conventions and file placement.
3. Re-run the reproduction test and confirm it passes cleanly.
4. Run the project's coverage command and meet the threshold `<project-rules>` documents. If none is documented, report the measured figure without claiming a threshold.
5. Run the project's full test, lint, and typecheck commands in the worktree.

### Step 2C — Mandatory Rebase on `issues-dev` Before Review

Before entering the review pairing loop, rebase `fix/issue-<number>` onto `issues-dev`:

```bash
git -C .workspaces/issue-<number> rebase issues-dev
```

This absorbs changes integrated by concurrent subagents, resolves conflicts inside the worktree, and guarantees the review agent audits the exact rebased code.

### Step 2D — Autonomous Review Pairing Loop

1. Pair with a review agent with fresh context on the worktree diff, using [references/reviewer-prompt.md](references/reviewer-prompt.md). If the project or user provides a code-review skill (for example `code-review-baseline`), instruct the reviewer to load it. (If the harness supports nested delegation and permissions allow, the child invokes the reviewer; in harnesses without nested subagent support, the coordinator drives the review loop by alternating between writer and reviewer subagents on the issue worktree without editing code directly.)
2. Fix every reported defect in `.workspaces/issue-<number>` and re-submit for review.
3. The loop continues until the review agent reports `NO DEFECTS FOUND`.

### Step 2E — Mandatory Verification Handshake & Notification

1. **Red/Green Verification Handshake**:
   - Temporarily disable the fix in the worktree.
   - Run tests to confirm they fail (proving the tests genuinely guard against the defect).
   - Re-enable the fix.
   - Confirm all tests pass cleanly.
2. Run the project's final gate command from `<project-commands>` in the worktree.
3. Commit only the files this issue changed, using `<commit-convention>`:
   ```bash
   git -C .workspaces/issue-<number> add <modified-files>
   git -C .workspaces/issue-<number> commit -m "<subject per commit-convention referencing #<issue-number>>"
   ```
4. Notify the coordinator with the issue number, commit SHA, root cause, fix, decision file path and IDs, and verification evidence (red/green output, final gate result, coverage figure): "Issue #<number> review is clean, tests verified, ready to merge." The coordinator continues integration without asking the user to confirm.

---

## 3. Coordinator Integration to `issues-dev` & Teardown

Upon receiving the clean review notification:

1. **Fast-forward Central `issues-dev`**:

   ```bash
   git -C .workspaces/issues-dev merge --ff-only fix/issue-<number>
   ```

   If `--ff-only` refuses because another issue advanced `issues-dev`, have the issue worker rebase onto its current tip. Rerun the final gate and review the rebased code before retrying. Use a full review if the rebase changes code outside the previous review's delta. Never substitute a merge commit.

2. **Teardown Issue Worktree**:

   ```bash
   git worktree remove .workspaces/issue-<number>
   git branch -d fix/issue-<number>
   ```

3. **Record the Closing Summary**: Keep the subagent's root cause, fix, and verification evidence for section 4. Do not close the issue yet; the fix is not on `<default-branch>`.

4. **Replenish Concurrency Pool**: Mark the integrated issue in `<RUN_DIR>/queue.md`, recheck its dependents, and provision the next eligible `ready` issue from the current `issues-dev` tip. Keep up to 3 workers active within session capacity and reserve capacity for review; continue investigation of other rows without waiting for their answers. Defer upstream synchronization until all issue worktrees are removed.

---

## 4. Final Merge, Push, Issue Closure & Global Teardown

When all queued issues have been merged into `issues-dev`:

1. **Final Sync & Suite Validation**: With no active issue workers or issue worktrees, fetch upstream. If `<default-branch>` advanced, rebase `issues-dev` onto it. If the rebase conflicts, delegate resolution to a worker with exclusive access to `.workspaces/issues-dev`. After any rebase, run the final gate and a full review of the resulting integration diff. Never merge upstream into `issues-dev`.

   ```bash
   git -C .workspaces/issues-dev fetch origin <default-branch>
   git -C .workspaces/issues-dev rebase origin/<default-branch>
   ```

   Run the project's final gate command in `.workspaces/issues-dev`. On failure, record the evidence and delegate an isolated repair using the autonomy reference's repair loop. Require verification and independent review, fast-forward the repair, and rerun the integration gate before continuing. Before final integration, assess linked decisions' combined impact and complete the reference's required interaction checks and reviews.

2. **Merge `issues-dev` into `<default-branch>`** from the repository root:

   ```bash
   git checkout <default-branch>
   git pull --ff-only origin <default-branch>
   git merge --ff-only issues-dev
   ```

   If `--ff-only` refuses because upstream advanced again, repeat the final sync and validation before retrying. Never fall back to a merge commit. Verify `git rev-list --min-parents=2 origin/<default-branch>..<default-branch>` is empty before pushing.

3. **Push**: Record `git log --oneline origin/<default-branch>..<default-branch>` in the run report, then run `git push origin <default-branch>`. If upstream advanced, repeat final sync, verification, and review before retrying. If publishing is blocked by unavailable access or an explicit user restriction, retain unpushed commits and leave their issues open; continue other authorized work.

4. **Issue Closure Handshake** after the push succeeds. For each merged issue, check `gh issue view <issue-number> --json state`. If a `fixes #N` reference in the pushed commits already closed it, post the summary with `gh issue comment <issue-number> --body "..."`; otherwise:

   ```bash
   gh issue close <issue-number> --comment "Resolved in <commit-sha> on <default-branch>.

   ### Summary of Changes
   - Root cause: <from subagent report>
   - Fix: <from subagent report>
   - Verification: <red/green evidence, final gate result, and coverage figure from subagent report>"
   ```

   Do not state any verification result the subagent report does not contain.

5. **Global Cleanup**:

   ```bash
   git worktree remove .workspaces/issues-dev
   git branch -d issues-dev
   ```

6. **Final Issue Check Before Turn Yield**:
   ```bash
   gh issue list --state open --json number,title,labels --limit 20
   ```
   Check all open issues, regardless of labels, including unlabeled issues. If actionable issues remain, repeat from Step 1.
