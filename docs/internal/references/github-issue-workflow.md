---
created_on: 2026-10-07 15:07
last_modified: 2026-10-08 17:07
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
| Scheduling | Complete one issue through CI, bot review, merge, and cleanup before starting another; stay on its PR while checks or review are pending | [Scheduling](../../../skills/agent/github-fix-issues/references/scheduling.md) |
| Ordering | Highest verified priority first, oldest within each group; without priority labels use oldest first; prerequisites precede dependents | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Restart | Persist the active issue and resolved order in `.tmp/github-issues.md`; refresh metadata and resume current CI/review/integration before new work | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Branches | New work uses `fix/issue-NNN-slug` in `.workspaces/issue-NNN`, based on `main` | [Skill](../../../skills/agent/github-fix-issues/SKILL.md) |
| Review identity | Bundled `scripts/reviewer.ts access ensure` verifies the configured bot, automatically invites/accepts, then lists open issues oldest first as an inventory; `--pr NUMBER --no-issues` repeats verification before reviews | [Setup](../../../skills/agent/github-fix-issues/references/setup.md) |
| Checks | Implementer follows local development checks, pushes the PR, and watches all applicable CI until green before bot review; CI supplies results without a separate evidence package | [Checks and CI](../../../skills/agent/github-fix-issues/references/checks-and-ci.md) |
| Review | PR references its issue; same independent reviewer inspects diff, context, and live CI, then requests changes for actionable findings or submits native approval without body, comments, or summary | [Reviewer](../../../skills/agent/github-fix-issues/references/reviewer.md) |
| Integration | Rebase before handoff; current green CI and exact-head native approval gate fast-forward-only publication into `main` | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Cleanup | Verify remote reachability and PR merged state, then close the issue and remove owned worktrees, branches, and scratch; retain PR discussion, reviews, and queue | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Recovery | Explicit request, isolated candidate, backup, exact tree preservation, and separately authorized publication with exact lease | [History repair](../../../skills/agent/github-fix-issues/references/history-repair.md) |

Resolve label ranks from repository conventions and descriptions. Rank by priority,
then creation time, with issue number breaking timestamp ties. Use a documented
default rank for unlabeled issues; otherwise place them after explicitly prioritized
groups, oldest first. Refresh labels between completed issues, without preempting
the active issue. The helper's chronological listing does not determine execution
order or replace label inspection.

For each issue: implement, push, watch CI, fix failures until green, request bot
review, address findings, and repeat CI/review until approved. Then verify every
integration gate, fast-forward, verify GitHub reports the PR merged, and clean up.
Only afterward select another issue. Pending CI or review is unfinished work;
wait with bounded polling and progress updates instead of starting another PR.
An active PR blocked by access, missing CI, unavailable review, or an external
outage stops the run with an exact blocker and next action.

Baseline check failures require a prerequisite repair ticket through the same
CI/review/integration loop. Suspend the dependent while completing that repair;
do not implement unrelated tickets. Pre-selection dependency cycles or inaccessible
requirements hold affected issues out of the eligible set. Blocked tickets receive
a comment explaining the blocker and resolution, a blocked label, and a saved
queue state. Baseline repairs remain limited to failing required checks.

An existing matching branch, worktree, or PR is resumed when no active owner is
present. Conflicting candidates or active ownership block takeover. If an older
queue contains multiple pending PRs, preserve them and finish one at a time;
do not dispatch more work. A replacement reviewer reads the installed skill, PR
record, live CI, and linked issue without a private briefing.

PR descriptions carry concise problem/result summaries, issue references, change
types, testing summaries, consequential decisions, and risks. CI is the check
record; descriptions and comments do not require logs, evidence bundles, or round
manifests. Comments carry findings, questions, replies, and short status notices.
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
