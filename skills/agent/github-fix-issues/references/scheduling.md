## One issue through merge

Use one implementer and one independent reviewer for the current ticket. Keep
only one issue active through implementation, CI, review, integration, and cleanup.
Do not dispatch another issue, start another PR, or continue independent ticket
work while the current PR is awaiting CI or review.

1. Resume the current active ticket before selecting new work. Otherwise choose
   the highest-priority eligible issue, oldest first within that priority, using
   the queue reference. Complete verified prerequisites before their dependent.
2. Implement and push its PR. Mark it `ci-pending` and watch CI. Fix failures,
   commit, push, and watch again until the current revision is green.
3. Request bot review only after green CI. Mark it `review-pending` and keep
   following that PR's comments, native review threads, reviews, live SHAs, and
   CI results. Reuse the reviewer for each correction. Wait with bounded polling
   while review is pending; silence is not approval and is not a reason to move
   to another issue.
4. On findings, mark `changes-requested`, implement corrections, and reply in the
   existing threads. Push changes, wait for green CI, and request review again.
   If the base/head moves, mark `refresh-required`, rebase onto fetched `main`,
   rerun required local checks, push, watch CI, and obtain fresh native approval.
5. Once current CI and native approval satisfy every integration gate, integrate
   with fast-forward-only semantics. Verify remote reachability and native PR
   merged state, then close the issue and clean up owned artifacts. Record any
   deferred cleanup explicitly.
6. After merge and cleanup, or suspension under the blocker procedure below,
   refresh dependencies, blockers, and priorities and select the next eligible
   issue within the authorized queue. New priorities and cleared blockers affect
   the next selection; they do not preempt a progressing active issue.

Verify queue ownership, then update `.tmp/github-issues.md` after every transition
and before a restart. Follow the queue reference's ownership and restart contract;
record task/worker identity, owned paths, and any externally supplied lease
reference. A checkpoint does not dispatch a worker. Record accepted scheduler
wakeups only through an authorized, configured interface, or preserve the state
and report the exact redispatch requirement without claiming automatic resumption.
The queue records the active issue, PR base/head, CI run/check locators, reviewer identity,
native review ID/head, next action, and retained artifacts. Task-specific reviewer
communication stays on the PR.

## Suspend and resume blocked work

1. Establish the blocker from evidence after available recovery attempts. Recover
   requirements and priority conventions from the sources in the skill and queue
   reference. A missing structured acceptance section alone is not a blocker.
   Unresolved material requirements or priority ambiguity suspend only affected
   issues and their dependents; never invent product behavior or a priority rank.
   Missing requirements, denied access, unavailable reviewer capacity, and verified
   external outages can block work. Pending CI or a running reviewer alone does
   not; continue watching them. A failing check or review finding that can be
   repaired within scope remains active work. Confirmed infrastructure failures
   use the checks reference's persisted retry policy; exhaustion with continuing
   infrastructure-failure evidence suspends affected work under this procedure.
   Pending CI or review does not consume that retry budget, and restarting does
   not reset it.
   After verified publication, use the integration reference's persisted
   reconciliation window. A missing native MERGED state after that window, with
   the published commit still contained in remote main, suspends closure and
   cleanup under this procedure without marking the issue complete.
2. Record the blocker, evidence, attempted recovery, last check time, exact unblock
   condition, and resume stage in the queue. Follow the queue's blocker comment
   and label procedure. Preserve edits, branch, worktree, PR, base/head, check
   records, reviewer identity, and review state. Mark the row `blocked`, suspend
   affected dependents, and clear its active designation without marking it done.
3. For an authorized queue, select the next independent eligible issue using
   verified priority and dependency order. Keep only one issue active. A request
   to implement one named issue does not authorize other issues. When all
   authorized work shares the blocker or no eligible issue remains, report the
   retained work and exact missing input and stop selection.
4. Recheck suspended rows at selection boundaries without repeating unchanged
   blocker comments. When an unblock condition is verified, refresh requirements,
   dependencies, ownership, remote refs, PR base/head, and live CI/review state.
   Mark the row eligible with its resume stage retained and select by priority
   and dependency order. On selection, restore that stage and resume its existing
   branch and PR; rebase, rerun required
   checks, and obtain fresh review when revisions invalidate prior evidence.
   For already-published work, resume reconciliation from the saved publication
   record instead of rebasing or repeating publication solely for a missing
   merged flag. Verify containment, the expected PR head, and native MERGED state
   before closure and cleanup; no separate connectivity check is required.

## Resume previously overlapping work

If an older queue has several PRs awaiting review, inspect the existing work
before creating more. Preserve worktrees and reviews; reconcile landed work first.
Resume the saved active issue, or select one eligible unfinished PR by priority
then age when no active issue is recorded. Bring it through current CI, review,
merge, and cleanup, or record and suspend a verified blocker, before resuming
another. Recheck deliberately suspended PRs using the blocker procedure; their
existence alone does not prevent selecting independent authorized work. Check
ownership before taking over a PR; uncertain or active ownership blocks takeover
and never permits overwriting work.
