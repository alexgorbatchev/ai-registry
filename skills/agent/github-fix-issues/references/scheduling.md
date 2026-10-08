## Keep the implementer working during review

Use one implementing agent across the queue, with at most one ticket undergoing
edits at a time. Keep a separate branch/worktree and reviewer session per pending
PR. Reviews can run concurrently within available agent capacity; never create
another implementing worker to increase throughput.

After publishing a PR and handing off its recorded checks for review, mark it
`review-pending` and release the implementer to other work. Preserve that reviewed
head while the round is current. If a pending round must change, post a supersession
notice on its PR before editing or rebasing; only a fresh evidence round and native
approval can make the replacement eligible for integration.

## Scheduling checkpoints

Inspect all pending PRs through GitHub, in saved dependency/oldest-first order:

- Immediately after every PR submission, review request, or review resubmission.
- Before starting another issue and after each merge.
- At safe implementation checkpoints, such as after a coherent edit and its
  targeted checks complete, so long-running implementation cannot starve reviews.
- On restart, before selecting new implementation work.

Read the description's current evidence round, comments, review threads, native
review outcomes, and live head/base SHAs.
Record the scan time and resulting state in `.tmp/github-issues.md`. Reviewer
results still travel only through the PR, never agent messages or scratch files.

At each checkpoint:

1. Save the current worktree's owned progress and next action without mixing it
   into another ticket's branch; mark it `checkpointed` when switching away from
   unfinished implementation and restore `implementing` when resuming it.
   Do not abandon edits or create a misleading
   passing-check claim merely to switch tasks.
2. Service actionable returned reviews and approved PRs before starting another
   new ticket. Order them by the saved dependency/age order. For findings, move to
   `changes-requested`, fix them, and repeat the rebase/check/evidence/review cycle.
   For approval, apply every integration gate and fast-forward one PR at a time.
3. Dispatch `review-queued` requests oldest first as reviewer capacity becomes
   available. Reuse each ticket's reviewer, including for correction rounds. A
   temporary capacity limit queues review; it does not authorize self-review or
   skipping evidence. Refresh a queued round if its base or head changed.
4. If no review or integration needs action, resume checkpointed implementation
   or start the oldest `ready` independent issue. Perform the existing-work check
   before starting it. An older ticket awaiting review does not prevent this.
5. When no implementation is ready, investigate unresolved requirements, refresh
   dependencies/blockers, or prepare authorized tickets. Do not start a dependent
   issue before its prerequisite lands, stack it on an unmerged PR, expand scope,
   or fabricate busywork to avoid waiting.
6. Wait for reviewer progress only when no useful authorized action remains.
   Pending reviews are unfinished work, not blockers or completed tickets. Resume
   the scan when progress arrives; do not spin in an immediate polling loop.

## Main advances and review fairness

After each merge, compare every pending PR's recorded base with fetched `main`.
Mark changed rounds `refresh-required` and post their staleness on the relevant
PRs. Before integration, rebase each affected branch, rerun all required checks,
publish new evidence, and obtain a fresh approval. An approval on the previous
base cannot survive merely because the diff appears unchanged.

Refresh earlier pending work in dependency/age order before starting further
new tickets. Do not repeatedly open newer PRs while older review findings or
approved work remain actionable. Continue other independent work while refreshed
rounds are under review; every submitted round triggers another pending-review scan.
