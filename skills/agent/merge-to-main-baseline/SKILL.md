---
name: merge-to-main-baseline
description: Use whenever merging code to main/master branches.
author: alexgorbatchev
metadata:
  created_on: 2026-05-30 12:46
  last_modified: 2026-10-08 14:03
  status: current
---

Default to a linear history when integrating a branch into `main` or `master`, unless the repository rules or user explicitly require a merge commit.

1. Fetch the target branch, record its fetched remote tip and local tip, and inspect `git status`, `git worktree list`, and the exact commits to land. Local-only commits are not by themselves a reason to stop. Do not integrate unrelated commits or touch unowned changes.
2. Choose the integration target:
   - If the local target equals or is behind the fetched remote tip, fast-forward it with `--ff-only` when its checkout is clean and owned.
   - If it is ahead, retain its tip when every commit in `<remote-tip>..<local-target>` is approved for this landing and that range contains no merges. Include those commits in validation and the publication scope.
   - If it contains unrelated local-only commits or local-only merges, diverges from the remote, or its checkout cannot be updated without touching unowned work, preserve it and use a temporary integration branch/worktree from the fetched remote tip. Replay only approved commits needed for the landing; if an unpublished dependency lacks authorization, ask about that dependency.
3. Verify the source branch descends from the chosen integration tip and that its new commits contain no merges (`git rev-list --min-parents=2 <target>..<source>`). Otherwise, prepare a branch from that integration tip with only the approved source commits. Revalidate and review any replayed commits before landing. Do not use a merge commit to bypass a failed fast-forward.
4. Integrate with `git merge --ff-only <source>`. Inspect the entire publication range `<remote-tip>..<landed-tip>` for approved commits only and verify `git rev-list --min-parents=2 <remote-tip>..<landed-tip>` is empty, then run the repository's required landing checks. Push the exact landed revision to the remote target with a normal, non-forced push, including when using a temporary integration branch. If the remote advances, fetch and repeat preparation and validation before retrying. Verify the remote target according to repository rules.
5. Once the landed revision is verified remotely, remove the temporary branch and worktree if they are no longer needed. Preserve any branch or worktree containing unlanded work and report deferred local target synchronization.
