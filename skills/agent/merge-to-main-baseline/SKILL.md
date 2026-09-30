---
name: merge-to-main-baseline
description: Use whenever merging code to main/master branches.
author: agorbatchev
metadata:
  created_on: 2026-05-30 12:46
  last_modified: 2026-09-30 19:47
  status: current
---

Default to a linear history when integrating a branch into `main` or `master`, unless the repository rules or user explicitly require a merge commit.

1. Fetch the target branch, inspect its live remote tip, `git status`, `git worktree list`, and the exact commits to land. Fast-forward the local target to its fetched remote tip before landing; stop if it has local-only commits or cannot advance cleanly. Do not integrate unrelated commits or touch unowned changes.
2. Verify the source branch descends from that target tip and that its new commits contain no merges (`git rev-list --min-parents=2 <target>..<source>`). If it is behind or contains merge commits, prepare a clean branch from the fresh target with only the approved commits. Revalidate and review any replayed commits before landing. Do not use a merge commit to bypass a failed fast-forward.
3. Integrate with `git merge --ff-only <source>`. Verify `git rev-list --min-parents=2 <old-target>..<new-target>` is empty, then run the repository's required landing checks. Push and verify the remote target according to repository rules.
4. Once the landed revision is verified remotely, remove the temporary branch and worktree if they are no longer needed. Preserve any branch or worktree containing unlanded work.
