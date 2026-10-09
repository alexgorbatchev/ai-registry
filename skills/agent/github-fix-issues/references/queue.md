## Persistent queue

The implementing agent is the sole writer of `.tmp/github-issues.md` in the primary
checkout. Preserve it across restarts and cleanup. Record:

- Repository/host, remote, primary checkout, requested scope, last refresh time,
  fetched `main` SHA, sources of check commands and repository rules, and the
  priority-label ranking with its source and treatment of unlabeled issues.
- Each issue's number, title, creation/update times, state, acceptance criteria and
  source citations, priority labels/rank, dependency IDs and their evidence,
  blockers, and resolved execution order. Record `investigate`, `ready`,
  `implementing`, `ci-pending`,
  `review-pending`, `changes-requested`, `approved`, `refresh-required`, `blocked`, or `done`.
- Existing-work inspection time and results: matching branches, worktree paths,
  PR URLs/states/base/head SHAs, active ownership, and the selected candidate.
- The active issue, current reviewer identity/session locator, base/head, CI
  run/check locators and outcomes, native review ID/head SHA, last review scan,
  integration state, and owned artifacts pending cleanup.
- A next action and exact missing input for every suspended or blocked ticket.

This file is a restart index, not the implementer/reviewer communication channel.
Link to PR decisions, CI results, and native reviews instead of duplicating logs.

## Inventory and order

1. For a queue request, retrieve every open issue in scope, regardless of labels,
   including unlabeled issues. Do not use a fixed result cap as a complete inventory.
   With the verified repository substituted, the paginated REST query is:

   ```sh
   gh api --paginate 'repos/OWNER/REPO/issues?state=open&sort=created&direction=asc&per_page=100' --jq '.[] | select(.pull_request == null)'
   ```

   The issues endpoint also returns PRs; exclude them. For an explicitly selected
   set, retain that scope and inspect any prerequisites it references.
2. Read issue bodies, comments, native blocking relationships, and referenced
   specifications. Resolve acceptance criteria from source evidence. Do not infer
   prerequisites from labels or numbers alone. A closed prerequisite still needs
   proof that its required behavior is available on `main`.
3. Inspect repository labels, their descriptions, and documented priority
   conventions. Use that verified ranking, highest priority first. Do not infer
   priority from label color, alphabetical order, or an undocumented numeric
   convention. If priority labels have an ambiguous ranking or an issue has
   conflicting priority labels, resolve it from repository guidance or ask before
   selecting work; do not invent a rank.
   Sort roots by priority descending, creation time ascending within each group,
   then issue number ascending for equal timestamps. Exhaust the highest-priority
   eligible group before lower groups. Use the repository's default rank for
   unlabeled issues; without a documented default, put them after explicitly
   prioritized groups and order them oldest first. If no issues have priority
   labels, sort the entire set oldest first.
   For the first unfinished root in that order, traverse unresolved prerequisites
   first using the same ordering, then the root. Emit each issue once. A verified
   prerequisite may precede a higher-priority or older dependent; unrelated
   issues do not inherit that dependent's priority.
4. Detect cycles, inaccessible dependencies, and conflicting requirements. Record
   the blocker and hold all affected dependents. Process the next independent
   root. Do not quietly delete dependency edges to produce an order.
5. Include verified same-repository prerequisites needed for the selected work.
   Honor explicit exclusions and repository boundaries; blocked cross-repository
   or explicitly excluded work needs the missing authorization. Baseline repair
   is required prerequisite work, limited to the failing required checks.

## Existing work before every ticket

Fetch remote refs, inspect `git worktree list --porcelain`, local branch refs,
remote heads, and PRs linked to the issue or matching its branch. Include open,
closed, and merged matching PRs so a restart does not duplicate completed work.
Check legacy branch names too; title resemblance alone does not establish a match.
Inspect each candidate's diff, issue references, base, head, status, and ownership.

Resume a single matching inactive candidate automatically, preserving unfinished
edits and its existing PR. Keep an existing published branch name stable; new
branches use `fix/issue-NNN-slug` with the actual issue number, such as
`fix/issue-42-handle-empty-input`. Reattach an existing branch to a worktree only
when it is not already checked out elsewhere. Reconcile already-landed work using
the integration gates before marking it done.

Read the closure reason of an unmerged closed PR before resuming its branch. Do
not reopen rejected or withdrawn work without resolving the reason against the
current request; record a blocker when intent cannot be established.

A branch name or old timestamp does not prove inactivity. Check available session,
process, and ownership records; resolve uncertain ownership before taking over.
On active ownership or multiple conflicting candidates, block that ticket and
preserve all candidates. Never switch away from an active PR to unrelated work;
report its blocker. Do not overwrite an index lock or take over another agent's
staged files.

## Restart freshness and blockers

Before trusting a saved queue, verify repository and requested scope, refresh open
issue metadata, compare saved states/update times, and fetch refs/PR heads. Refresh
changed or new issues and their dependents; retain unchanged resolved requirements
and dependency reasoning. Recheck native dependency edges and prerequisites for
the next candidate, since a cached timestamp alone is not proof of unchanged work.
An offline/API failure does not establish freshness. Reconstruct a missing or
malformed queue from GitHub and local work without discarding existing artifacts.

Refresh affected rows after a dependency, push, CI, review, merge, blocker, or
cleanup transition. Refresh priority labels before selecting new work. Resume the
active ticket, including pending CI or review, before choosing another. Keep only
one active ticket through merge and cleanup, following the scheduling reference.
Do not start another issue while its PR remains unmerged; report a blocker if
progress requires unavailable access or input.

When blocked, comment on the ticket with the reason, evidence, and what unblocks
it; apply the existing blocked label or explicitly create `blocked` if none exists
and repository policy permits. Verify the label landed. Record publication/access
failures in the queue if those actions cannot be completed. Avoid duplicate blocker
comments when nothing changed. Remove only the workflow's resolved blocker label,
post the resolution, and refresh dependent rows when it clears.

References: [issue inventory](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
and [native dependencies](https://docs.github.com/en/rest/issues/issue-dependencies).
