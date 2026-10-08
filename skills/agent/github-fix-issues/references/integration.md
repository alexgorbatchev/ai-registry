## Verify before integration

Read live GitHub state, not just the queue. Require all of the following:

- The PR targets `main`; its head equals the locally committed, checked head.
- The current round has complete passing evidence and no unresolved findings.
- The expected bot's latest decisive native review is `APPROVED`, not dismissed,
  and names this exact commit and round. An earlier approval followed by a changes
  request is insufficient. Repository-required reviewers and thread resolution
  rules are also satisfied.
- Required CI/status checks have completed successfully for that head. Check
  repository protection/ruleset requirements directly; an absence of configured
  checks does not waive the project's required local gate.
- A fresh fetch still resolves remote `main` to the round's base SHA. That base
  is an ancestor of the approved head, and
  `git rev-list --min-parents=2 BASE..HEAD` contains no merge commits.
- Local branch/worktree ownership is established, with no unowned staged changes,
  index locks, unfinished Git operations, or source changes outside the commit.

If the base or head moved, rebase onto current `main`, rerun all required checks,
publish another evidence round, and obtain another native approval. Resolve push
lease failures by inspecting the new remote work; never overwrite it blindly.
Integrate one PR at a time. Each merge invalidates other pending rounds whose
recorded base differs from the new `main`; mark them for refresh in the queue and
on their PRs, following the scheduling reference.

## Fast-forward only

GitHub's ordinary merge methods cannot preserve this contract: merge creates a
merge commit, squash replaces commits, and GitHub rebase-and-merge rewrites SHAs.
Do not use `gh pr merge` for this workflow. Integrate the approved commit with Git
fast-forward semantics and then verify GitHub recognizes the PR as merged.

In the clean, owned checkout of `main`, fast-forward to fetched remote `main`,
then `git merge --ff-only APPROVED_HEAD`. If that checkout has unowned work, do not
switch or reset it. Publish the checked head directly as described below and defer
its local synchronization until that work is safe. Never create a merge commit as
a fallback. Refuse integration if local `main` has unrelated unpublished commits.

Immediately before publishing, recheck live PR head, approval, required checks,
and remote `main`. Use a normal non-forced push of the exact approved commit:
`git push REMOTE APPROVED_HEAD:refs/heads/main`. A non-fast-forward rejection starts
another rebase/check/review round. If a concurrent advance is already contained
in the approved head, verify reachability and all gates before treating it as
already integrated. Do not use force, squash, rebase-and-merge, an administrator
bypass, or altered branch protection. If repository policy prevents direct
fast-forward publication, record the blocker and retain the PR/worktree.

Fetch again and verify the approved head is reachable from remote `main`. Read
the PR's native state until it reports `MERGED`; a closed PR is not proof of merge.
GitHub can mark indirectly integrated PRs merged, so verify policy gates before
the push rather than relying on that state to prove they were satisfied. If the
head landed but GitHub has not marked the PR merged, preserve artifacts and record
the reconciliation blocker; do not recreate, manually close, or rewrite the PR.

## Closure and artifact cleanup

Only after remote reachability and PR merged state are verified:

1. Close the issue if closing references have not already done so. Comment with the
   PR, landed SHA, outcome, and links to retained check evidence and native approval.
   Mark the queue row done and unblock verified dependents.
2. Read back all evidence comments. Retain the PR, reviews, and folded logs for all
   rounds permanently. Preserve `.tmp/github-issues.md` and other tickets' work.
3. Verify the remote issue branch still points to the integrated head and has no
   active owner or another open PR using it. Delete only that owned branch, using
   an exact expected-SHA lease for the deletion; if it changed, preserve it and
   investigate. A missing branch is already cleaned up.
4. Remove exact owned scratch files after their evidence is safely retained.
   Inspect tracked, untracked, and ignored work before removing the issue worktree
   with `git worktree remove PATH`. Never force-remove a dirty worktree or discard
   unknown files. Delete the integrated local branch with `git branch -d BRANCH`
   after confirming it is an ancestor of remote `main`; do not use broad pruning
   or `git branch -D` to hide an unresolved ownership or integration problem.
5. Synchronize local `main` with `--ff-only` when its checkout is clean and owned.
   Verify exact local/remote refs and worktree registration after cleanup. Record
   any deferred local synchronization or retained artifacts with their reason in
   the queue and completion report.

References: [GitHub merge behavior](https://docs.github.com/en/pull-requests/reference/pull-request-merges)
and [Git push and explicit leases](https://git-scm.com/docs/git-push).
