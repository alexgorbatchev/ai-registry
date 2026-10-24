---
created_on: 2026-10-07 15:07
last_modified: 2026-10-16 16:33
status: current
---

# GitHub Issue Workflow

The shared [`github-fix-issues` skill](../../../skills/agent/github-fix-issues/SKILL.md)
owns issue creation, implementation through PR review and integration, cleanup,
and explicitly requested historical issue-merge repair. It is maintained under
`skills/agent/` and ships through normal profile selection to every harness.
There are no issue-specific command aliases or harness overrides.

## Workflow contracts

| Concern | Contract | Maintained instructions |
| --- | --- | --- |
| Filing | Investigate, deduplicate open issues, follow templates, label, and record dependencies | [Issue authoring](../../../skills/agent/github-fix-issues/references/issue-authoring.md) |
| Scheduling | Keep one issue active through CI, review, merge, and cleanup; suspend verified blockers and continue independent authorized issues; pending CI or running review keeps the current issue active | [Scheduling](../../../skills/agent/github-fix-issues/references/scheduling.md) |
| Ordering | Highest verified priority first, oldest within each group; without priority labels use oldest first; prerequisites precede dependents | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Restart | Persist active and suspended issues, unblock conditions, resume stages, and artifact/check/review records in `.tmp/github-issues.md`; refresh ownership, metadata, refs, and CI/review before resuming | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Ownership and dispatch | Verify the queue's single owner before writes or resumed mutations; record task/worker, owned paths, and any external lease. Checkpoints do not dispatch workers; require verified scheduler acceptance or report exact redispatch requirements | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Branches | New work uses `fix/issue-NNN-slug` in `.workspaces/issue-NNN`, based on `main` | [Skill](../../../skills/agent/github-fix-issues/SKILL.md) |
| Readiness | Before implementation, check tools, repository/remote identity, authentication, distinct reviewer/token availability, access, and protection compatibility; persist non-secret missing requirements and suspend only dependent actions | [Setup](../../../skills/agent/github-fix-issues/references/setup.md) |
| Review identity | Bundled `scripts/reviewer.ts access ensure` verifies the configured bot, automatically invites/accepts, then lists open issues oldest first as an inventory; `--pr NUMBER --no-issues` repeats verification before reviews | [Setup](../../../skills/agent/github-fix-issues/references/setup.md) |
| Checks | Implementer follows local development checks, pushes the PR, and watches all applicable CI until green before bot review; CI supplies results without a separate evidence package | [Checks and CI](../../../skills/agent/github-fix-issues/references/checks-and-ci.md) |
| Review | PR references its issue; same independent reviewer inspects diff, context, and live CI, then requests changes for actionable findings or submits native approval without body, comments, or summary | [Reviewer](../../../skills/agent/github-fix-issues/references/reviewer.md) |
| Integration | Rebase before handoff; current green CI and exact-head native approval gate fast-forward-only publication into `main` | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Publication reconciliation | Persist published head, remote main SHA, PR head/state, observation time, deadline, and next poll; use repository policy or 15-second polls for up to 120 seconds before suspending unresolved native state | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Cleanup | Verify remote reachability and PR merged state, then close the issue and remove owned worktrees, branches, and scratch; retain PR discussion, reviews, and queue | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Recovery | Explicit request, isolated candidate, backup, exact tree preservation, and separately authorized publication with exact lease | [History repair](../../../skills/agent/github-fix-issues/references/history-repair.md) |

Follow the [queue ownership and restart contract](../../../skills/agent/github-fix-issues/references/queue.md).
Record task/worker identity, owned checkout/worktree paths, and any
scheduler-provided ownership or lease reference. Verify ownership before queue
writes and resumed mutations. A timestamp or expired lease alone never authorizes
takeover, lock removal, or overwriting another worker's state. Preserve uncertain
ownership and continue only independent authorized work that cannot conflict.
Saving a checkpoint does not schedule or start a worker. Use an authorized,
configured scheduler's supported interface and record accepted resume triggers
or times and external job references. Without configured or verified dispatch,
preserve resumable state and report the exact redispatch requirement; never
invent leases, scheduler tools, or successful unattended resumption. On actual
restart, reconcile live ownership, Git, issue/PR, CI, review, and publication
state. Scheduler installation and worker dispatch remain runtime integration
requirements beyond checkpoint instructions.

Resolve label ranks from repository conventions and descriptions. Rank by priority,
then creation time, with issue number breaking timestamp ties. Use a documented
default rank for unlabeled issues; otherwise place them after explicitly prioritized
groups, oldest first. Refresh labels between completed issues, without preempting
the active issue. The helper's chronological listing does not determine execution
order or replace label inspection.

Resolve ambiguous priority rankings or conflicting labels from verified repository
guidance. If unresolved, record the ambiguity and unblock condition, suspend only
affected issues and their dependents, and select the next independent eligible
issue within the authorized queue. Do not invent ranks or alter labels to bypass
ambiguity.

Establish acceptance criteria from verified issue discussion, referenced
specifications, tests, and documented behavior. A missing structured acceptance
section alone is not a blocker; existing behavior and tests alone do not establish
the desired change. If a material requirement remains missing or contradictory,
record the unresolved question and unblock condition, suspend only the affected
issue and its dependents, and continue independent authorized work. Do not invent
product behavior.

Before implementation, follow the [setup readiness checks](../../../skills/agent/github-fix-issues/references/setup.md).
Verify tools, repository/remote identity, implementer authentication, configured
distinct reviewer and token availability, required access, and compatibility
between the integration policy and repository protections. The workflow uses
`main`; verify it exists on the publishing remote without silently choosing
another branch. Persist non-secret findings and exact missing requirements.
Missing prerequisites suspend dependent actions while prepared work is preserved;
continue independent authorized preparation or eligible issue work under the
scheduling and blocker protocols. Recheck prerequisites before resuming and at
the existing review/integration gates. Do not dump credentials, change default
authentication, bypass protections, or escalate existing permissions.

Before implementation, inspect applicable CI workflows, trigger conditions, and
required access. Missing same-repository CI configuration follows the bounded
prerequisite-repair policy; missing access or an external outage suspends only
dependent work. Follow the [checks reference](../../../skills/agent/github-fix-issues/references/checks-and-ci.md)
to distinguish code failures, confirmed infrastructure failures, missing
configuration/access, and pending checks. Infrastructure retries use documented
repository policy or, when absent, at most two automatic reruns per unchanged PR
revision, waiting 30 seconds before the first and 60 seconds before the second.
Persist the revision, evidence locators, attempt count, and next retry time before
rerunning; reconcile live runs on restart without resetting the budget or
duplicating requests. Exhaustion with continuing infrastructure-failure evidence
invokes the blocker protocol. Pending CI or review does not consume retry
attempts or justify suspension merely because time passes. Check gates remain.

After publication, follow the [integration reference's reconciliation policy](../../../skills/agent/github-fix-issues/references/integration.md).
Persist the published head, observed remote main SHA, PR head and native state,
first observation time, deadline, and next poll. Use repository policy or poll
every 15 seconds for up to 120 seconds; restarting does not reset the window.
Closure and cleanup require remote main to contain the published commit and the
PR to have the expected head and native MERGED state. Reuse current fetch/API
results without a separate connectivity check. If the window expires and the
commit is still contained but the PR is not MERGED, preserve work, record the
exact missing state and unblock condition, and suspend affected work under the
blocker protocol. Never mark completion, manually close or recreate the PR,
rewrite commits, or repeat publication solely to force a merged flag. Recheck
suspended reconciliation at selection boundaries. Investigate changed PR heads
or a published commit missing from remote main. This window does not limit
ordinary pending CI or running review.

For each issue: implement, push, watch CI, fix failures until green, request bot
review, address findings, and repeat CI/review until approved. Then verify every
integration gate, fast-forward, verify GitHub reports the PR merged, and clean up.
Select another issue afterward, or after suspending a verified blocker. Pending CI or review is unfinished work;
wait with bounded polling and progress updates instead of starting another PR.
A verified blocker caused by missing requirements, denied access, unavailable
reviewer capacity, or an external outage suspends the issue and its dependents.
Record evidence, attempted recovery, last check time, exact unblock condition,
and resume stage; preserve edits, branches, worktrees, PRs, base/head, checks,
reviewer identity, and review state. Continue the next independent eligible issue
within the authorized queue, keeping only one active. A single-issue request
does not authorize unrelated issues. If no eligible authorized work remains,
report the blocker and next action. Recheck suspended rows at selection boundaries;
verify the unblock condition and refresh requirements, dependencies, ownership,
refs, and live checks/reviews before restoring eligibility. Select by priority
and dependency order without interrupting a progressing active issue.

Existing task authorization covers the smallest same-repository prerequisite
repair needed to unblock required checks after reproducing the failure on the
untouched base. Give it its own ticket, dependency edge, change set, and the same
CI/review/integration loop. Suspend the dependent while completing that repair.
Honor explicit exclusions and other owners' changes; do not weaken checks, add
unrelated improvements, or invent repairs for outages or missing access.
Compatibility layers require explicit authorization, including removal and
verification for temporary layers; migration approval alone does not grant it.
Pre-selection dependency cycles or inaccessible requirements hold affected issues
out of the eligible set. Blocked tickets receive a comment explaining the blocker
and resolution, a blocked label, and a saved queue state.

An existing matching branch, worktree, or PR is resumed when no active owner is
present. Conflicting candidates or active ownership block takeover. If an older
queue contains multiple pending PRs, preserve them and resume one eligible PR at
a time. Verified suspension permits the next independent authorized issue;
ordinary pending CI or review does not. A replacement reviewer reads the installed skill, PR
record, live CI, and linked issue without a private briefing.

PR descriptions carry concise problem/result summaries, issue references, change
types, testing summaries, consequential decisions, and risks. CI is the check
record; descriptions and comments do not require logs, evidence bundles, or round
manifests. Completion reports summarize checks actually run, verified outcomes
for the relevant revision, and material limitations, with native CI links or
existing local log paths where applicable. Raw logs remain in the execution
system; local log paths do not replace required CI. Failed, skipped, pending, or
unrun required checks must not be reported as passing.
Comments carry findings, questions, replies, and short status notices.
Descriptions, comments, and replies posted from the user's account speak in the
account owner's first person (`I`, `me`, `my`), including approval and landing
notices. An approval actually given is expressed as "I approved landing this
change," not "The user approved landing this change." Actions, results, and
authorization remain grounded in verified work; wording grants no new permission.
The separate bot reviewer speaks for its own identity, and clean native approvals
remain without prose.
Reviewer contracts, role prompts, and bot setup commands stay in the installed
skill. The implementer executes local checks; the reviewer may inspect source and
GitHub results but never executes repository checks or triggers CI.

## Platform constraints

An empty check list is not green. Watch the expected workflows and inspect live
results for the current PR revision before review and again before integration.
Missing, pending, failed, cancelled, neutral, stale, or unexpectedly skipped checks
do not satisfy the gate. Inspect workflow conditions before excluding inapplicable
jobs. CI may test GitHub's synthetic merge commit; match that run to the PR's
base/head rather than assuming its tested SHA is the branch head.
[CLI check documentation](https://cli.github.com/manual/gh_pr_checks),
[status checks](https://docs.github.com/en/pull-requests/reference/status-checks).

A PR author cannot approve their own PR. The configured reviewer CLI identity
must differ from the author; separate agent sessions do not establish separate
GitHub identities. Native review submissions specify the reviewed commit.
[Review documentation](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request#submitting-your-review),
[review API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request).

A changed base/head requires rebase, current CI, and fresh approval. GitHub's
merge, squash, and rebase-and-merge options do not preserve the fast-forward
contract. Publish approved commits with Git and verify the native merged state.
Indirect merges can be marked merged without satisfying protections, so check
protections before publication; the merged flag alone does not prove compliance.
[GitHub merge behavior](https://docs.github.com/en/pull-requests/reference/pull-request-merges).

## Maintenance verification

Validate changed skill frontmatter and bundled links with the registry validator,
run `bun run build`, and inspect generated harness copies. Review instructions
against priority/no-priority ordering, prerequisites, restart, old overlapping
queues, missing or stale CI, failed checks, returned findings, baseline failure,
bot authentication, concurrent push, and dirty-worktree scenarios. These are
instruction and packaging checks; they do not constitute an executed end-to-end
GitHub issue run.
