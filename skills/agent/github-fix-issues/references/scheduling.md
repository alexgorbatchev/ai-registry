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
6. Only then refresh dependencies and priorities and select the next issue.
   New priority labels affect the next selection; they do not preempt the active
   issue. A blocked active PR stops the run with its exact blocker and next action.
   Do not label pending CI or a running reviewer blocked merely because it takes
   time. Missing access, unavailable reviewer capacity, or an external outage
   must be reported without self-approval or a switch to unrelated work.

Update `.tmp/github-issues.md` after every transition and before a restart. It
records the active issue, PR base/head, CI run/check locators, reviewer identity,
native review ID/head, next action, and retained artifacts. Task-specific reviewer
communication stays on the PR.

## Resume previously overlapping work

If an older queue has several PRs awaiting review, do not launch additional work.
Preserve their worktrees and reviews; reconcile already-landed work first. Resume
the saved active issue, or select one existing unfinished PR by priority then age
when no active issue is recorded. Bring that PR through current CI, review, merge,
and cleanup before resuming another. Check ownership before taking over a PR;
uncertain or active ownership is a blocker, not permission to overwrite work.
