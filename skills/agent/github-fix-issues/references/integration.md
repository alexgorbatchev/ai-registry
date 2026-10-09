## Verify before integration

Read live GitHub state, not just the queue. Require all of the following:

- The PR targets `main`; its head equals the locally committed, checked head.
- The PR description references its issue; no findings remain unresolved.
- The expected bot's latest decisive native review is `APPROVED`, not dismissed,
  and its `commit_id` matches this exact checked head. Associate its review ID with
  the current base/head and request using the queue's review record; refresh review
  if that association is uncertain. The approval body is empty by design. An
  earlier approval followed by a changes request is insufficient. Repository-required
  reviewers and thread resolution rules are also satisfied.
- All applicable CI/status checks are present and have completed successfully for
  the current PR revision, as defined in [checks and CI](checks-and-ci.md). Read
  live results and repository protection/ruleset requirements directly; missing,
  pending, stale, or failing CI blocks integration, even with an approval.
- A fresh fetch still resolves remote `main` to the reviewed base SHA. That base
  is an ancestor of the approved head, and
  `git rev-list --min-parents=2 BASE..HEAD` contains no merge commits.
- Source branch/worktree ownership is established, with no unowned staged changes,
  index locks, unfinished Git operations, or source changes outside the commit.

If the base or head moved, rebase onto current `main`, rerun all required checks,
push, wait for green CI, and obtain another native approval. Resolve push
lease failures by inspecting the new remote work; never overwrite it blindly.
Integrate the current PR before starting the next issue. If resuming an older
queue with multiple PRs, mark remaining stale bases for refresh and resume those
PRs one at a time, following the scheduling reference.

## Fast-forward only

GitHub's ordinary merge methods cannot preserve this contract: merge creates a
merge commit, squash replaces commits, and GitHub rebase-and-merge rewrites SHAs.
Do not use `gh pr merge` for this workflow. Integrate the approved commit with Git
fast-forward semantics and then verify GitHub recognizes the PR as merged.

Local-only commits on `main` are not by themselves a reason to refuse integration.
In its clean, owned checkout, use `git merge --ff-only APPROVED_HEAD` when local
`main` is an ancestor of the approved head. Retain approved local-only commits
already contained in that reviewed head.

If local `main` contains unrelated unpublished commits, diverges from the approved
head, or its checkout has unowned work, preserve the branch and checkout. Publish
the exact approved head directly as described below and defer local synchronization.
Do not switch, reset, or rewrite that checkout, publish unrelated commits, or create
a merge commit to unblock integration.

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
   PR, landed SHA, outcome, and links to CI results and native approval.
   Mark the queue row done and unblock verified dependents.
2. Retain the PR description, conversation, and native reviews. No copied CI logs,
   evidence archive, or round history is required.
   Preserve `.tmp/github-issues.md` and other tickets' work.
3. Verify the remote issue branch still points to the integrated head and has no
   active owner or another open PR using it. Delete only that owned branch, using
   an exact expected-SHA lease for the deletion; if it changed, preserve it and
   investigate. A missing branch is already cleaned up.
4. Remove exact owned scratch files after integration and closure are verified.
   Inspect tracked, untracked, and ignored work before removing the issue worktree
   with `git worktree remove PATH`. Never force-remove a dirty worktree or discard
   unknown files. Delete the integrated local branch with `git branch -d BRANCH`
   after confirming it is an ancestor of remote `main`; do not use broad pruning
   or `git branch -D` to hide an unresolved ownership or integration problem.
5. Synchronize local `main` with `--ff-only` when its checkout is clean and owned
   and its tip is an ancestor of fetched remote `main`. Otherwise preserve its
   unpublished work and defer synchronization. Verify exact local/remote refs and
   worktree registration after cleanup. Record any deferred local synchronization
   or retained artifacts with their reason in the queue and completion report.

References: [GitHub merge behavior](https://docs.github.com/en/pull-requests/reference/pull-request-merges)
and [Git push and explicit leases](https://git-scm.com/docs/git-push).
