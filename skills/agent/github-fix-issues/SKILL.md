---
name: github-fix-issues
description: >-
  Use when creating or updating GitHub issues, fixing a numbered issue, working
  through open tickets, reviewing ticket PRs, resuming issue work, or repairing
  historical issue-flow merge commits.
author: alexgorbatchev
metadata:
  created_on: 2026-09-22 14:38
  last_modified: 2026-10-16 16:33
  status: current
---

Choose the requested mode. Filing a ticket does not authorize implementing it;
normal issue work does not authorize rewriting published history.

| Request | Read and follow |
| --- | --- |
| Create, refine, or check for an existing issue | [Issue authoring](references/issue-authoring.md) |
| Implement one ticket or a queue, including restart | [Setup](references/setup.md), [queue](references/queue.md), then the implementation loop below |
| Review a ticket's PR | [Reviewer workflow](references/reviewer.md); read requirements from the issue linked by the PR |
| Remove historical issue-integration merges | [History repair](references/history-repair.md) |

Before implementation, follow [setup](references/setup.md) to check repository,
tool, authentication, reviewer, access, and protection readiness. This workflow
uses `main`; do not silently choose another integration branch. Run the bundled
reviewer helper during setup to verify bot access, automatically invite/accept
when needed, and list open issues oldest first. Record missing prerequisites and
suspend only dependent actions under the scheduling and blocker protocols.

Keep the workflow independent of any agent harness. Use its available mechanism
to start an independent reviewer for the current PR; do not require a particular tool name, agent
profile, runtime, or another installed skill. If independent review is unavailable,
record the blocker rather than self-approving.

## Ownership and communication

- The implementing agent owns queue preparation, edits, checks, commits, PRs,
  integration, and cleanup. Do not delegate implementation or run parallel ticket
  workers. Keep one ticket active through CI, review, integration, and cleanup.
  Stay on it while CI or review is pending. For a verified blocker, record and
  suspend it and its dependents, then select the next independent ticket within
  the authorized queue using the scheduling reference. Preserve suspended work.
- Pair with one review agent per ticket and reuse it for subsequent rounds. After
  a restart, replace an unavailable reviewer using the PR's complete record.
  Keep only one ticket active in the implementation/CI/review/integration loop.
- The reviewer only reviews the diff, relevant source context, requirements, and
  live CI results. It never executes repository checks or implementation code.
  Read-only inspection and GitHub communication tools remain available.
- All communication between these two agents belongs on the PR: requests,
  findings, questions, answers, decisions, and sign-off. A launch/resume message
  contains only the PR locator. Both agents follow this installed skill; the
  reviewer loads its bundled reviewer workflow and reads the linked issue for
  requirements. Keep role prompts, review contracts, bot setup commands, and agent
  operating instructions out of PR descriptions and comments. CI is the check
  record; do not publish log transcripts, evidence bundles, or round manifests.
  Use comments for findings, questions, replies, and short status notices.
  Do not exchange findings through agent messages, shared scratch
  files, or chat.
- Write PR descriptions, comments, and replies posted from the user's account
  in first person as the account owner (`I`, `me`, `my`). For an actual approval,
  write `I approved landing this change`, never `The user approved landing this
  change`. Do not refer to the account owner as `the user`, `the requester`, or
  `the human`, or narrate an assistant acting as intermediary. Ground actions,
  results, and approvals in verified work and authorization; wording does not
  grant permission. The separate bot reviewer speaks for its own identity;
  clean native approvals still contain no prose.
- Continue within the user's authorized scope without repeatedly asking permission.
  Resolve implementation choices from inspected requirements, code, tests, and
  repository instructions. Record consequential choices and their sources on the
  PR. Establish acceptance criteria from verified issue discussion, referenced
  specifications, tests, and documented behavior; a missing structured acceptance
  section alone is not a blocker. Do not infer desired changes from existing
  behavior or tests alone. If a material requirement remains missing or
  contradictory, record the unresolved question and unblock condition, suspend
  the affected issue and its dependents, and continue the next independent
  authorized issue. Do not invent product behavior.

## Implementation loop

Follow [scheduling](references/scheduling.md) to finish the active issue or suspend
it for a verified blocker before selecting another authorized independent issue.
Watch CI, then bot review, then integrate; repeat on failures or findings. A pending
check or running review is unfinished work, not a handoff to the next issue.

1. **Prepare or resume the queue.** Maintain `.tmp/github-issues.md` in the primary
   checkout using the queue reference. Verify queue ownership before writes or
   resumed mutations; record task/worker identity, owned paths, and any supplied
   scheduler lease. Checkpointing does not dispatch a worker: record verified
   scheduler acceptance or the exact redispatch requirement. Resume active work
   first; otherwise select
   by priority, then oldest creation time, resolving prerequisites first. Check
   existing branches, worktrees, and PRs before creating anything. Resume matching
   inactive work; preserve other owners' work.
2. **Establish requirements and checks.** Read the ticket, comments, governing
   specifications, repository instructions, relevant code, and tests. Record a
   checklist with source citations. Discover exact check commands and thresholds
   using [checks and CI](references/checks-and-ci.md). Before changing code,
   inspect applicable CI workflows, trigger conditions, and required access;
   resolve missing configuration under the bounded prerequisite-repair policy.
   Verify required checks on untouched, fetched `main`.
3. **Repair a failing baseline first.** Create or reuse a prerequisite ticket for
   failures reproduced on untouched `main` that block required checks. Existing
   task authorization covers the smallest necessary same-repository repair;
   honor explicit exclusions, repository boundaries, and other owners' changes.
   Record the dependency, suspend the dependent ticket, and complete the repair
   in its own change set with this same PR/check/review/integration loop. This
   authority does not permit unrelated improvements or compatibility layers.
   Never weaken or waive a failing required check. If the failure is missing access
   or an external outage, record a blocker rather than inventing a code repair.
4. **Implement in the issue worktree.** Branch from fetched `main` under
   `.workspaces/issue-NNN` with branch `fix/issue-NNN-slug`. Replace `NNN` with the
   issue number and `slug` with a short lowercase, hyphen-separated title fragment.
   For changes to executable behavior, follow repository red/green rules: observe
   the regression test fail, implement the fix, observe it pass, then temporarily
   disable only the fix with tests enabled in an owned, isolated or disposable
   worktree and confirm the test fails again. Restore it and rerun relevant checks;
   preserve other actors' changes. For non-executable changes, use the relevant
   validators; do not manufacture static-value tests. Commit only this ticket's
   changes.
5. **Create or update the PR.** Push the issue branch and use `main` as its base.
   Use existing PR-publication authorization without asking for separate approval
   of the verified title and body. Honor draft-only limits and explicit requests
   for content review; require separate authorization for integration, release,
   or deployment when those actions are outside the granted scope.
   Follow the repository PR template. Reference the actual ticket with `Fixes #NNN`
   and keep requirements and acceptance criteria in that linked issue. Include a
   concise problem/result summary, change type, material decisions, risks, and
   testing summary. CI results stay in GitHub's checks, not copied logs. Do not
   duplicate the issue body or add a reviewer briefing. Use the account owner's
   first-person voice. Reuse the matching open PR.
   Keep drafts and logs in an owned `.tmp/` directory, never in committed files.
6. **Push and wait for green CI.** Fetch `main`, rebase the issue branch onto it,
   resolve conflicts, and run all required checks on the resulting committed HEAD.
   Publish the branch and verify the remote PR head equals the committed SHA.
   Watch CI using the checks reference, including its failure classification and
   persisted infrastructure retry policy; a restart does not reset that budget.
   Fix code failures, commit, push, and watch again
   until every applicable check succeeds for the current PR revision. Missing or
   pending checks do not authorize review. Remain on this issue throughout.
   A push after rebase uses an exact lease against the previously verified issue
   branch SHA; never force-push `main` in normal ticket work.
7. **Request and follow bot review.** Verify the description references the issue
   and live CI is green for the unchanged base/head.
   Authenticate and request review from the distinct bot account as described in
   setup. Launch or resume the reviewer with the PR locator only; its instructions
   come from this skill's [reviewer workflow](references/reviewer.md).
   The reviewer posts code findings as native inline review comments attached to
   the affected diff lines and submits native **Request changes**, or
   signs off using native **Approve** on that exact head with no review body,
   inline comments, or separate summary. Reviewer prose is limited to actionable
   issues; a clean review produces only the native approval.
   Mark the ticket `review-pending` and follow its native review to a decisive
   outcome. Do not start another issue while waiting.
8. **Pair until approved.** Read the PR and its native review
   comments, implement fixes, and answer each inline finding in its existing
   thread with the corrective commit or grounded explanation. Answer other
   findings on the PR. Return to step 6 after corrective code commits or a rebase,
   then request review again only when
   CI is green. No unresolved findings, green CI, and current native approval are
   all required.
   Do not treat silence, a plain comment, or an old approval as sign-off.
9. **Integrate and clean up.** Follow [integration](references/integration.md).
   Preserve the approved commits with fast-forward-only integration into `main`.
   Before publication, a changed base or head invalidates the round: rebase,
   rerun checks, and obtain another native approval. After publication, follow
   the integration reference's persisted reconciliation window; do not reset it
   on restart or repeat publication solely to force the merged flag. Confirm
   remote main contains the published commit and the PR has the expected head
   and native MERGED state before closing the issue and deleting owned artifacts.
   Preserve the PR, native reviews,
   and persistent queue across cleanup and restarts; no log archive is required.
10. **Continue the queue.** Refresh affected dependencies and blockers after each
    transition. Select another issue after the current one is verified merged
    and cleanup is completed or explicitly recorded as deferred, or after a
    verified blocker suspends it under the scheduling reference. Keep only one
    issue active. Hold affected dependents, preserve suspended work, and continue
    only independent issues within the authorized queue. Recheck blockers before
    selection and refresh cleared tickets before resuming their existing work.
    Report ticket/PR links, landed SHAs, CI and approval links, cleanup results,
    and exact blockers; never describe blocked work as done.

## Reviewer helper interface

Invoke `bun /path/to/github-fix-issues/scripts/reviewer.ts` from the target
repository. Resolve the path from the installed skill; setup owns one-time
dependency installation and saved configuration. The command name in help is
`reviewer`. No command accepts positional arguments except generated help.

| Command or flag | Contract |
| --- | --- |
| `access ensure` | Verify identities/access, automatically invite and accept a missing collaborator, then list open issues oldest first |
| `--repo <owner/repo>` | Repository string; defaults to `gh repo view` in the current checkout, honoring `GH_REPO` |
| `--reviewer <login>` | Expected bot login; otherwise `GH_REVIEWER_LOGIN`, then Git config `github-fix-issues.reviewer`; required |
| `--token-env <name>` | Name of the exported bot-token variable; otherwise `GH_REVIEWER_TOKEN_ENV`, then Git config `github-fix-issues.tokenEnv`; required |
| `--hostname <host>` | Hostname without scheme; otherwise `GH_HOST`, then `github.com` |
| `--pr <number>` | Positive integer; additionally check the actual PR author differs from the bot; omitted at queue startup, required before each review submission |
| `--no-issues` | Boolean flag suppressing the issue listing; listing is enabled by default |
| `skill` | Print this embedded skill verbatim; operates offline without credentials; accepts no custom flags or arguments |
| `-h`, `--help` | Show help on any command |
| `help [command]` | Generated help at the root and `access` group; optional immediate child command |

Keep the implementing identity selected in default `gh` authentication. The helper
uses `GH_TOKEN`/`GITHUB_TOKEN` or enterprise equivalents as GitHub CLI normally
does, and overrides them only in bot subprocesses. It neither changes saved
authentication nor writes configuration. The named token must already be exported;
shell aliases and shell initialization files are not evaluated. Git config applies
its normal local-over-global precedence. Each subprocess times out after 30 seconds.

Human output reports the bot, access outcome, PR author-check status, then issue
creation dates, numbers, titles, and URLs. `AGENT=1`, `true`, or `yes` produces one
JSON result with `repo`, `implementer`, `reviewer`, `author` (null without `--pr`),
`access` (`existing`, `accepted`, `invited-and-accepted`, or `granted`), and `issues`
(omitted with `--no-issues`). Each issue has `number`, `title`, `createdAt`, and
`url`. Equal creation times sort by issue number. Agent-mode access diagnostics go
to stderr before listing; help is untruncated and `skill` remains verbatim Markdown.

Exit zero means the requested operations completed. Invalid arguments, missing
configuration, identity mismatch, insufficient permissions, API/transport errors,
and output failures exit nonzero with a stderr diagnostic. Errors can occur after
an invitation was created or accepted; fix the reported cause and rerun to resume.
Do not treat failed output or a missing PR-author check as review authorization.
