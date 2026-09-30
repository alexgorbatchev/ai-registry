---
name: git-issue-history-cleanup
description: Use when asked to remove merge commits left by a GitHub issue integration flow, such as merges of issue branches into an integration branch. Do not use for ordinary branch merges, general history editing, or commit-message cleanup.
author: alexgorbatchev
metadata:
  created_on: 2026-09-30 19:43
  last_modified: 2026-09-30 19:47
  status: current
---

Treat this as a history rewrite of issue-flow merges. Preserve the selected tip's exact file tree and every non-merge commit. A clean-looking log alone is insufficient.

1. Identify the issue integration path (even if its branch was deleted), the published target branch, the oldest issue-flow merge to remove, and the commit immediately before the selected range (`base`). Inspect the graph with `git log --graph --oneline --decorate`, `git rev-list --merges base..tip`, and `git show --no-patch --format='%P'` on representative merges. Identify issue-flow merges by their parents and integration path, not only by a `merge:` subject. If the range includes unrelated merges, preserve them or stop; do not silently flatten them. Do not guess a base from commit dates or subjects alone.
2. Read repository Git/worktree instructions. Fetch the target remote branch, capture its exact old SHA with `git ls-remote`, inspect `git status`, `git worktree list`, local and remote branches containing the range, tags, and signed commits. Stop on unowned staged or tracked changes, active work in the target branch, protected refs, or signatures that the rewrite cannot preserve. Explain which existing branches and commit links will need attention after publication.
3. Create a uniquely named local backup ref at the old tip and a candidate branch in an isolated worktree, using the repository's worktree helper when it has one. Do not rewrite the primary checkout while preparing the candidate. Flatten only the issue-flow range. When `base` is an ancestor of `tip` and every merge in `base..tip` is an issue-flow merge selected for removal, run this in the candidate worktree:

   ```sh
   git rebase --force-rebase --no-rebase-merges --onto "$base_sha" "$base_sha"
   ```

   If other merges occur inside the range, do not run this command: it would remove them too. Reconstruct only the authorized issue-flow merges while retaining unrelated topology, or stop if that cannot be proved. Do not resolve replay conflicts by guessing the desired content; inspect the original merge resolution or stop for input.
4. Before touching the target ref, require all of these checks to pass:
   - Candidate and old tip have identical tree IDs (`git rev-parse <rev>^{tree}`) and `git diff --quiet old_tip candidate` exits zero.
   - `git rev-list --merges base..candidate` contains no issue-flow merge commits selected for removal, and every unrelated merge remains. Enumerate any intentionally retained merges.
   - The candidate contains the expected non-merge commits in the intended order. Compare counts, subjects, authors, and `git range-diff` where useful; investigate dropped or duplicated commits instead of treating matching trees as sufficient.
   - Repository-required validation passes for any content difference. When trees are identical, record that evidence and do not claim a test suite ran if it did not.
5. Show the old and candidate SHAs, removed-merge count, tree comparison, and affected refs. If publication of the rewritten branch was not already explicitly authorized, ask for approval at this point. Never infer permission to force-push another shared branch from permission to inspect or prepare a candidate.
6. For an authorized remote rewrite, check the live remote ref again and push only the target ref with an exact lease against the captured old SHA:

   ```sh
   git push --force-with-lease="refs/heads/$branch_name:$old_sha" "$remote_name" "$candidate_branch:refs/heads/$branch_name"
   ```

   If the lease fails, stop and rebuild the candidate from the new tip; do not use `--force` or a lease based only on a mutable remote-tracking ref. Fetch and verify that the remote resolves to the candidate SHA. Update the primary local branch only after confirming it has no unowned tracked or staged changes and its tree is identical; use an exact-old-value ref update rather than resetting unrelated files. Retain the backup ref until the user no longer needs a recovery path. Remove the temporary worktree and candidate branch when safe.

Report the final remote and local SHAs, tree equality, issue-flow merge count, validation performed, backup ref, and any branches or references that still point into the old history. If any gate fails, report the candidate and blocker without publishing it.
