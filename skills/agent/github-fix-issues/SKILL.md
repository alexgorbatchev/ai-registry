---
name: github-fix-issues
description: >-
  REQUIRED when fixing, resolving, or implementing GitHub issues labeled `bug` or `feature` using subagents in any repository.
  Trigger whenever asked to "fix issue #123", "resolve github issue", "work on open issues",
  "fix this bug with subagents", or execute a delegated issue remediation workflow. Your default training
  knowledge is insufficient; you MUST READ this to execute the parent coordinator lifecycle, red/green TDD
  in isolated worktrees, linear issues-dev integration, and the push and issue-closing protocol. Do NOT use
  for filing new issues (use github-issue) or general code review without an issue.
author: alexgorbatchev
metadata:
  created_on: 2026-09-22 14:38
  last_modified: 2026-09-30 11:23
  status: current
---

## Project Discovery

Resolve these once, before provisioning anything, and substitute them everywhere below:

- `<default-branch>`: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
- `<project-commands>`: the exact commands the project documents for targeted tests, the full test suite, lint, typecheck, coverage, and the final "run before declaring work complete" gate. Read them from the repository's instruction files (root and nested `AGENTS.md`, `CLAUDE.md`) first, then from build definitions (`justfile`, `Makefile`, `package.json` scripts, `go.mod`, `pyproject.toml`, `Cargo.toml`). Record each command verbatim with the file it came from.
- `<project-rules>`: the coding, logging, testing, coverage-threshold, and file-placement rules those instruction files state, including nested `AGENTS.md` files for the packages an issue touches.
- `<commit-convention>`: the subject format and issue-reference form used by `git log --oneline -30` on `<default-branch>` (for example `fix(scope): summary (fixes #N)`), overridden by any commit rule in the instruction files or the user's instructions, including rules about attribution trailers.

Never invent a command, path, package, or threshold that these sources do not state. When a category has no documented command, write "none documented" in the subagent brief instead of a guessed one.

## Concurrency & Worktree Topology

- **HARD PROHIBITION**: The coordinator agent is strictly prohibited from invoking `edit` or `write` on any files inside issue worktrees or package directories. Any file modification to implementation or test code MUST be performed by a delegated child subagent. If the coordinator edits code directly, the turn is an automatic failure.
- **Coordinator Boundary**: The coordinator manages queue ordering, provisions worktrees, receives clean review notifications from subagents, merges verified worktrees into `issues-dev`, tears down worktrees, performs the final merge, and closes GitHub issues. The coordinator does NOT micromanage the review loop.
- **Stable Integration Base**: Fetch `<default-branch>` before creating `issues-dev`. While issue workers are active, do not merge or rebase `issues-dev` onto new upstream commits; synchronize it by rebasing only after every issue worktree is removed.
- **Subagent Rebase Before Review**: Subagents MUST rebase their branch on `issues-dev` before entering the review pairing loop to eliminate integration conflicts for the coordinator.
- **Autonomous Subagent Review Pairing**: Subagents pair with review agents until no further issues are reported ("clean review"), and notify the coordinator only when the review is clean and ready for integration. Where the harness supports nested subagents and permissions allow, the child invokes the reviewer directly; otherwise, the coordinator alternates between writer and reviewer subagents on the issue worktree without editing code directly.
- **Full Queue Completion**: The coordinator works through the entire open issue set labeled `bug` or `feature`, continuing until no matching open issues remain.
- **Dependency-Aware Order Determination**: The coordinator analyzes all open `bug` and `feature` tickets to establish an execution order:
  1. Foundational defects first: data sources, ingestion, parsing, storage, and core domain logic.
  2. Service, middleware, classification, and reconciliation defects second.
  3. UI, presentation, and other consumer-surface adjustments third.
  4. Tooling, scripts, build, and developer ergonomics fourth.
  5. Issues in distinct packages with no shared files are prioritized for parallel execution across the 3 subagent slots; issues touching the same files run sequentially.
- **Max 3 Parallel Subagents**: At most 3 subagents may run concurrently. When more than 3 issues are queued, maintain an active pool of up to 3 and launch subsequent issues as earlier ones complete.
- **Central Integration Worktree (`issues-dev`)**: All completed issue fixes merge into a central integration worktree `.workspaces/issues-dev` on branch `issues-dev` (branched from `<default-branch>`). No issue branch merges directly to `<default-branch>`.
- **Per-Issue Worktree Isolation**: Each active issue runs in its own dedicated worktree `.workspaces/issue-<number>` on branch `fix/issue-<number>` (branched from `issues-dev`).
- **Linear Integration**: Rebase each issue branch onto the current `issues-dev` tip before integration and use `git merge --ff-only`. Rebase `issues-dev` onto the current upstream default branch after all issue branches are integrated. Never use a merge commit as a fallback.
- **Harness-Agnostic Subagent Invocation**: Delegate subagents with the active harness's native subagent mechanism. Do not hardcode harness-specific API wrappers, agent profiles, or SDK types.
- **Outward-Facing Actions Need Consent**: Pushing to a remote publishes work. Do not push without the user's explicit approval in the current run. Do not close an issue until its fix is on the remote `<default-branch>`.

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

3. **Ingest Issue Queue & Filter by Labels**:
   Query open issues and restrict execution strictly to issues tagged with `bug` or `feature` labels (ignoring unlabeled issues, questions, discussions, or other labels):

   ```bash
   gh issue list --state open --json number,title,labels --limit 50
   ```

   Filter the queue to issues whose labels include `bug` or `feature`. For each matching issue:

   ```bash
   gh issue view <issue-number> --json number,title,body,comments,labels,author
   ```

   Map dependencies across open issues and order them into execution batches.

4. **Provision Per-Issue Worktrees (Up to 3 Max)**:
   Branch each new issue worktree from the current `issues-dev` tip:
   ```bash
   git worktree add .workspaces/issue-<number> -b fix/issue-<number> issues-dev
   ```

---

## 2. Subagent Worktree Execution & Autonomous Review Pairing

Delegate each issue to a subagent scoped strictly to `.workspaces/issue-<number>`. The brief MUST contain the issue number, title, body, and comments; the worktree path; `<project-commands>` verbatim; `<project-rules>` for the packages involved; `<commit-convention>`; and steps 2A–2E below.

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
4. Notify the coordinator with the issue number, commit SHA, root cause, fix, and verification evidence (red/green output, final gate result, coverage figure): "Issue #<number> review is clean, tests verified, ready to merge."

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

4. **Replenish Concurrency Pool**: If additional open issues remain, provision the next `.workspaces/issue-<number>` from the current `issues-dev` tip to maintain up to 3 parallel workers. Defer upstream synchronization until all issue worktrees are removed.

---

## 4. Final Merge, Push, Issue Closure & Global Teardown

When all queued issues have been merged into `issues-dev`:

1. **Final Sync & Suite Validation**: With no active issue workers or issue worktrees, fetch upstream. If `<default-branch>` advanced, rebase `issues-dev` onto it. If the rebase conflicts, delegate resolution to a worker with exclusive access to `.workspaces/issues-dev`. After any rebase, run the final gate and a full review of the resulting integration diff. Never merge upstream into `issues-dev`.

   ```bash
   git -C .workspaces/issues-dev fetch origin <default-branch>
   git -C .workspaces/issues-dev rebase origin/<default-branch>
   ```

   Run the project's final gate command in `.workspaces/issues-dev`. Stop and report on any failure.

2. **Merge `issues-dev` into `<default-branch>`** from the repository root:

   ```bash
   git checkout <default-branch>
   git pull --ff-only origin <default-branch>
   git merge --ff-only issues-dev
   ```

   If `--ff-only` refuses because upstream advanced again, repeat the final sync and validation before retrying. Never fall back to a merge commit. Verify `git rev-list --min-parents=2 origin/<default-branch>..<default-branch>` is empty before asking to push.

3. **Push With Consent**: Show the user `git log --oneline origin/<default-branch>..<default-branch>` and ask for approval to push `<default-branch>` to `origin`. If the user declines, leave every issue open, report the unpushed commits, and skip step 4.

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
   Filter for open issues labeled `bug` or `feature`. If matching actionable issues remain, repeat from Step 1.
