---
description: Work on open GitHub issues in parallel worktrees with subagent review, merge to main, and cleanup
---

Work on all open GitHub issues in the repository: spawn up to 3 worker agents in parallel in dedicated git worktrees, pair each worker with a review subagent in a loop until no more issues are reported, sequentially merge verified changes to `main`, and clean up all worktrees and branches.

## Phase 1: Discover & Queue Issues

1. Check for open GitHub issues using the `gh` CLI:
   ```sh
   gh issue list --state open --json number,title,body,labels
   ```
2. If specific issue numbers were provided by the user as arguments, filter the queue to those issues. Otherwise, enqueue all open issues.
3. If no open issues exist, notify the user that there are no open issues to work on and exit cleanly.
4. Print the execution plan showing the list of issues, their titles, and the batching schedule.

## Phase 2: Worktree Isolation & Concurrency

- **Concurrency Limit**: Run **up to 3 worker agents in parallel** at any time. When one worker finishes and cleans up, dequeue the next issue.
- **Dedicated Worktrees**: Every issue must be developed in its own isolated git worktree created from the latest `main` branch.
  - Worktrees must be located under `.workspaces/issue-<number>`:
    ```sh
    git fetch origin main
    git worktree add -b "issue-<number>" ".workspaces/issue-<number>" origin/main
    ```
- **Strict Isolation**: Workers must only operate inside their assigned `.workspaces/issue-<number>` directory. Never allow multiple agents to share a working tree or edit files across worktrees.

## Phase 3: Worker Implementation Loop

For each active issue, dispatch a worker agent with its working directory set to `.workspaces/issue-<number>`:

1. **Understand Requirements**: Read the issue description, reproduction steps, referenced files, and relevant repository guidelines (`AGENTS.md`, `README.md`, existing patterns).
2. **Red-Green Verification**:
   - If the project has an automated test suite, follow the red-green discipline:
     - Write a targeted test reproducing the bug or asserting the new capability first.
     - Run the test and verify that it fails as expected.
     - Implement the code changes to satisfy the issue requirements.
     - Re-run the test and confirm it passes.
   - If no automated tests exist for the area, verify the behavior using the project's native verification tools or reproduction scripts.
3. **Quality & Standard Compliance**:
   - Adhere strictly to project conventions, semantic correctness, and typing rules.
   - Do not use stubs, shallow mock layers, or quick shortcuts.
   - Update documentation, `AGENTS.md`, or relevant skill files if behavior or contracts changed.
4. **Commit Changes**:
   - Stage and commit the verified changes to the `issue-<number>` branch with a descriptive message referencing the issue (e.g. `git commit -m "fix: resolve issue description (fixes #<number>)"`).

## Phase 4: Subagent Review Loop

Each worker must pair with an independent review subagent before its work can be accepted:

1. **Dispatch Reviewer**:
   - Launch a review subagent to inspect the branch diff against `main` (`git diff origin/main...HEAD` inside `.workspaces/issue-<number>`).
   - The reviewer audits for:
     - Functional correctness and edge-case handling.
     - Semantic integrity and absence of shortcuts or mock layers.
     - Test coverage and evidence that red-green verification was performed.
     - Project-specific policy adherence (`AGENTS.md`, file placement, naming).
     - Documentation and skill updates reflecting the changeset (per `code-review-baseline`).
2. **Review Triage & Resolution**:
   - If the review subagent identifies **any** issues, omissions, or guideline violations:
     - The worker agent addresses all reported feedback directly in `.workspaces/issue-<number>`.
     - Re-run all test suites and validations to confirm no regressions.
     - Commit the revisions.
     - Request another review pass from the review subagent.
   - **Loop Condition**: Repeat the review and fix cycle until the review subagent reports a clean review with **no more issues reported**.

## Phase 5: Sequential Integration & Merge to `main`

Once an issue has passed all tests and received a clean subagent review:

1. **Rebase & Final Test**:
   - Ensure the branch is rebased cleanly onto latest `main`:
     ```sh
     git fetch origin main
     git rebase origin/main
     ```
   - Run the full test suite and build checks on the rebased branch to ensure compatibility with any recently merged changes.
2. **Sequential Merge**:
   - To prevent git index locks, concurrency conflicts, and race conditions, merges to `main` must occur sequentially (one issue at a time):
     ```sh
     git checkout main
     git pull --rebase origin main # if remote exists
     git merge --ff-only "issue-<number>" # or git merge --no-ff if project prefers merge commits
     ```
3. **Close Issue**:
   - Close the resolved GitHub issue:
     ```sh
     gh issue close <number> --comment "Resolved via commit $(git rev-parse --short HEAD) and merged to main."
     ```

## Phase 6: Cleanup

Immediately after merging each issue (per `merge-to-main-baseline` and `--cleanup-branches-and-worktrees`):

1. Remove the worktree:
   ```sh
   git worktree remove ".workspaces/issue-<number>"
   ```
2. Delete the local feature branch:
   ```sh
   git branch -d "issue-<number>"
   ```
3. Prune stale worktree metadata:
   ```sh
   git worktree prune
   ```
4. Clean up any temporary artifacts or `.tmp` scratch files created during the run.

## Phase 7: Completion & Summary

After all queued issues have been processed:

1. Verify that all worktrees under `.workspaces/` and all temporary feature branches have been pruned.
2. Confirm the repository is on `main` and the working tree is clean (`git status`).
3. Output a summary table of all processed issues:
   - Issue number and title
   - Outcome (Resolved & Merged / Blocked)
   - Commit SHA
   - Review iterations required
