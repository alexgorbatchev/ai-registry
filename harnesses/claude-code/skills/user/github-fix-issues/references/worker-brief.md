# Worker Brief Template

Copy this file into the run directory as `worker-brief.md`. Replace every `<SLOT>` with the values found during discovery; if a category has no documented command, write `none documented`. Do not leave any `<SLOT>` unfilled.

---

# Worker brief: <REPO_SLUG>

You implement ONE GitHub issue of `<REPO_SLUG>` in your own git worktree `<WORKSPACES_DIR>/issue-<N>` (branch `fix/issue-<N>`, based on `<INTEGRATION_BRANCH>`).
- Work only in that worktree. Do not touch the primary checkout, `<INTEGRATION_BRANCH>`, or other worktrees.
- Do not push. Do not comment on, label, or close GitHub issues. Do not spawn reviewer subagents.
- Never run bare `git stash` or `git stash pop`; the stash stack is shared across worktrees. Set work aside with WIP commits.

## Read first

1. `gh issue view <N> --json number,title,body,comments`. The issue text defines what you must fix.
2. The issue checklist `<RUN_DIR>/checklist-<N>.md`, if the coordinator gave you one. It is the requirement list distilled from the spec. Open the spec itself (`<SPEC_PATH>`) only for the sections the checklist cites. Where the issue and the spec disagree, the spec wins.
3. The repository instruction files for every path you touch: <INSTRUCTION_FILES>.
4. Any findings file the coordinator names (`<RUN_DIR>/review-<N>-round<K>.md`). Fix every finding in it.

## Project commands

- Targeted test: `<TARGETED_TEST_CMD>`
- Full suite: `<FULL_TEST_CMD>`
- Lint / typecheck: `<LINT_CMD>`
- Coverage: `<COVERAGE_CMD>` (threshold: <COVERAGE_THRESHOLD>)
- Snapshot refresh: `<SNAPSHOT_REFRESH_CMD>`
- Final gate: `<FINAL_GATE_CMD>`
- Bootstrap for a fresh worktree: `<BOOTSTRAP_CMD>`

## Project rules

<PROJECT_RULES>

## Commit convention

<COMMIT_CONVENTION>. The last commit on the branch references the issue. Commit only the files you changed for this issue. Never commit anything under `.tmp/`.

## Workflow

A. **Red.** Write the failing test first and run it. Record the exact failure output. For non-testable changes (docs, CI YAML, static config), record why no test applies and run the static validator for those files instead.
B. **Green.** Fix the root cause. Update snapshots, docs, and the spec's status notes if the rules require it. Re-run the targeted tests.
C. **Rebase.** `git -C <worktree> rebase <INTEGRATION_BRANCH>`. Resolve conflicts in your worktree and keep the intent of both sides.
D. **Hand off for review.** Hand off only after all of the following hold:
   - the worktree is clean, with everything committed;
   - the formatters are clean;
   - paired generated artifacts were regenerated together;
   - `<FINAL_GATE_CMD>` exited 0 in YOUR OWN run.

   Then write `<worktree>/.tmp/review-evidence.md` (untracked). It must contain:
   - commit SHAs;
   - for each checklist item or finding: `done` / `deferred (to #X, why)` / `question`, with `file:line`;
   - for each behavioral test, the exact failure text you saw when the fix was reverted;
   - every one-sided change to a paired artifact, with its path and your no-diff evidence;
   - the last 30 lines of the final gate output.

   End your turn with a short report whose first line is `READY FOR REVIEW`.
E. **After the coordinator says the review is clean:**
   - Revert the fix temporarily, run the new tests, and capture the failure.
   - Restore the fix and confirm the tests pass.
   - Run `<FINAL_GATE_CMD>` again. <POST_COMMIT_STEPS>
   - Send the final report: SHAs, root cause, fix, red/green output, gate result, coverage figure, and a `DUE DILIGENCE` list of problems you saw but did not fix.

## Prohibited

- Claiming a test fails, a gate passes, or an item is done without tool output from this session that proves it.
- Tests that pass with the fix reverted, assertions that only check that "nothing was reported", and tests that never reach the changed code path.
- Stubs, placeholders, empty functions, and TODOs standing in for required behavior.
- Compatibility fallbacks, aliases, or "legacy" branches, unless the issue explicitly asks for them.
- Deleting or weakening existing assertions to make the gate pass. Consolidating tests is allowed only when every removed assertion has a stronger equivalent, and the evidence file must list those equivalents.
- Scope changes. Do not implement work the spec assigns to other issues. If a requirement is ambiguous or contradicts the code, stop and put the exact question in your report instead of guessing.
- Unscoped snapshot regeneration that deletes unrelated artifacts. Restore any collateral deletions before committing.
