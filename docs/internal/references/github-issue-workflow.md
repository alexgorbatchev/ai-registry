---
created_on: 2026-10-07 15:07
last_modified: 2026-10-07 17:29
status: current
---

# GitHub Issue Workflow

The shared [`github-fix-issues` skill](../../../skills/agent/github-fix-issues/SKILL.md)
owns issue creation, implementation through PR review and integration, cleanup,
and explicitly requested historical issue-merge repair. It is maintained under
`skills/agent/` and ships through the normal profile selection to every harness.
There are no issue-specific command aliases or harness overrides.

## Workflow contracts

| Concern | Contract | Maintained instructions |
| --- | --- | --- |
| Filing | Investigate, deduplicate open issues, follow templates, label, and record dependencies | [Issue authoring](../../../skills/agent/github-fix-issues/references/issue-authoring.md) |
| Scheduling | One implementer works on the next eligible issue during review; scan pending reviews after each PR submission and service returned work before starting more tickets | [Scheduling](../../../skills/agent/github-fix-issues/references/scheduling.md) |
| Ordering | Oldest eligible tickets first, with verified prerequisites before dependents; one implementation at a time and multiple PRs in review | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Restart | Persist resolved order in `.tmp/github-issues.md`; refresh changed metadata and inspect existing work before starting a ticket | [Queue](../../../skills/agent/github-fix-issues/references/queue.md) |
| Branches | New work uses `fix/issue-NNN-slug` in `.workspaces/issue-NNN`, based on `main` | [Skill](../../../skills/agent/github-fix-issues/SKILL.md) |
| Review identity | Bundled `scripts/reviewer.ts access ensure` verifies the configured bot, automatically invites/accepts, then lists open issues oldest first; `--pr NUMBER --no-issues` repeats verification before reviews | [Setup](../../../skills/agent/github-fix-issues/references/setup.md) |
| Evidence | Implementer runs checks; every round retains full stdout/stderr, exit codes, commands, and revisions in folded PR sections | [Checks and evidence](../../../skills/agent/github-fix-issues/references/checks-and-evidence.md) |
| Review | Same independent reviewer across rounds; diff/context/evidence inspection only; all communication on the PR; native Request changes or Approve | [Reviewer](../../../skills/agent/github-fix-issues/references/reviewer.md) |
| Integration | Rebase before each handoff; exact checked and approved commits reach `main` by fast-forward only | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Cleanup | Verify remote reachability and PR merged state, then remove owned worktrees, branches, and scratch; retain PR evidence and queue | [Integration](../../../skills/agent/github-fix-issues/references/integration.md) |
| Recovery | Explicit request, isolated candidate, backup, exact tree preservation, and separately authorized publication with exact lease | [History repair](../../../skills/agent/github-fix-issues/references/history-repair.md) |

Blocked tickets receive a comment explaining the blocker and what resolves it,
a blocked label, and a saved queue state. Their dependents remain on hold while
the implementer continues independent work. Baseline check failures require a
prerequisite repair ticket through the same PR/check/review/integration loop;
the repair remains limited to failures blocking required checks.

An existing matching branch, worktree, or PR is resumed when no active owner is
present. Conflicting candidates or active ownership block takeover. A replacement
reviewer after a restart reconstructs its context from the PR, not private agent
messages. Repository checks remain exclusively the implementing agent's work;
inspection and GitHub tooling are available to the reviewer.

Each submitted review round releases the implementer to the next eligible issue.
Pending PRs retain their own worktrees and reviewer sessions. The implementer
checks all pending reviews after each PR submission, before selecting another
ticket, and at safe implementation checkpoints. Returned findings and approved
work receive attention before more new tickets. Waiting occurs only when no
useful authorized work remains; dependencies still require merged prerequisites.
Every merge invalidates pending rounds based on older `main`, requiring another
rebase, check-evidence round, and approval before integration.

## Platform constraints

GitHub supports folded Markdown sections with `<details>` and `<summary>`. All
rounds remain on the PR after sign-off, including failures and superseded heads.
[Collapsed-section documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections).

A PR author cannot approve their own PR. The reviewer's configured CLI identity
must therefore differ from the author; separate agent sessions do not establish
separate GitHub identities. Native review submissions specify the reviewed commit.
[Review documentation](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request#submitting-your-review),
[review API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request).

GitHub's merge, squash, and rebase-and-merge options do not preserve the required
fast-forward contract. The workflow publishes the approved commits with Git and
verifies GitHub's resulting merged state. Indirect merges can be marked merged
without satisfying PR protections, so the workflow checks protections before
publication and never treats the merged flag alone as proof of compliance.
[GitHub merge behavior](https://docs.github.com/en/pull-requests/reference/pull-request-merges).

## Maintenance verification

Validate changed skill frontmatter and bundled links with the registry's skill
validator, run `bun run build`, and inspect all generated harness copies. Confirm
the obsolete issue skills, command bundles, harness copies, and review-gate
scripts are absent from generated output. Review the instructions against restart,
stale evidence, dependency-cycle, baseline-failure, bot-authentication, concurrent
push, and dirty-worktree scenarios. These are instruction and packaging checks;
they do not constitute an executed end-to-end GitHub issue run.
