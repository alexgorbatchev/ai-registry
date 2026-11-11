# Git integration

Default to linear history on `main`/`master` unless repository rules or the user require a merge commit. Inspect the fetched remote target, local target, source branch, and exact outgoing commits before landing.

- If the local target equals or trails the remote, fast-forward it when its checkout is clean and owned.
- If it is ahead only by approved commits with no merges, retain them and include them in validation and publication.
- If it diverges, contains unrelated commits or merges, or cannot be updated without touching unowned work, preserve it. Prepare an owned integration branch/worktree from the fetched remote target and replay only approved commits. Resolve authorization for any unpublished dependency before including it.

The source must descend from the chosen integration tip without new merge commits. Otherwise, replay its approved changes onto that tip and revalidate. Land with `--ff-only`; do not introduce a merge commit to bypass a failed fast-forward. Verify the complete outgoing range, publish the exact validated revision without force, and verify it remotely. If the remote advances, fetch and repeat preparation and validation.

Remove owned temporary branches/worktrees only after their work is verified landed; retain unlanded work and report any deferred local-target synchronization.

For instruction-maintenance changes, newly documented but unimplemented enforcement is follow-up work, not an additional merge gate. Preserve existing required checks. A deferred generation/application step suspends that step and its dependents, not independent source integration.
