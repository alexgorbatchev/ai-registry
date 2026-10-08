---
name: github-fix-issues
description: >-
  Use when creating or updating GitHub issues, fixing a numbered issue, working
  through open tickets, reviewing ticket PRs, resuming issue work, or repairing
  historical issue-flow merge commits.
author: alexgorbatchev
metadata:
  created_on: 2026-09-22 14:38
  last_modified: 2026-10-07 19:43
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

Run the bundled reviewer helper during [setup](references/setup.md) to verify bot
access, automatically invite/accept when needed, and list open issues oldest first.

Keep the workflow independent of any agent harness. Use its available mechanism
to start an independent reviewer for each pending PR; do not require a particular tool name, agent
profile, runtime, or another installed skill. If independent review is unavailable,
record the blocker rather than self-approving.

## Ownership and communication

- The implementing agent owns queue preparation, edits, checks, commits, PRs,
  integration, and cleanup. Do not delegate implementation or run parallel ticket
  workers. Edit one ticket's worktree at a time; while its PR is being reviewed,
  implement the next eligible issue in a separate worktree.
- Pair with one review agent per ticket and reuse it for subsequent rounds. After
  a restart, replace an unavailable reviewer using the PR's complete record.
  Multiple PRs can await review while the single implementer continues work.
- The reviewer only reviews the diff, relevant source context, requirements, and
  supplied evidence. It never executes repository checks or implementation code.
  Read-only inspection and GitHub communication tools remain available.
- All communication between these two agents belongs on the PR: requests,
  findings, questions, answers, decisions, and sign-off. A launch/resume message
  contains only the PR locator. Both agents follow this installed skill; the
  reviewer loads its bundled reviewer workflow and reads the linked issue for
  requirements. Keep role prompts, review contracts, bot setup commands, and agent
  operating instructions out of PR descriptions and comments. Put check evidence
  in the PR description; use comments for findings, questions, replies, and short
  status notices. Do not exchange findings through agent messages, shared scratch
  files, or chat.
- Continue within the user's authorized scope without repeatedly asking permission.
  Resolve implementation choices from inspected requirements, code, tests, and
  repository instructions. Record consequential choices and their sources on the
  PR. Missing acceptance criteria are blockers, not permission to invent behavior.

## Implementation loop

Use [scheduling](references/scheduling.md) to switch between implementation,
returned reviews, and integration. Review handoff releases the implementer to
work on the next eligible issue; it does not block the queue until sign-off.

1. **Prepare or resume the queue.** Maintain `.tmp/github-issues.md` in the primary
   checkout using the queue reference. Select the oldest eligible ticket, resolving
   its prerequisites first. Check existing branches, worktrees, and PRs before
   creating anything. Resume matching inactive work; preserve other owners' work.
2. **Establish requirements and checks.** Read the ticket, comments, governing
   specifications, repository instructions, relevant code, and tests. Record a
   checklist with source citations. Discover exact check commands and thresholds
   using [checks and evidence](references/checks-and-evidence.md). Verify required
   checks on untouched, fetched `main` before changing code.
3. **Repair a failing baseline first.** Create or reuse a prerequisite ticket for
   failures already present on untouched `main`. Record the dependency, suspend
   the dependent ticket, and complete the repair with this same PR/check/review
   loop. Never waive a failing required check. If the failure is missing access
   or an external outage, record a blocker rather than inventing a code repair.
4. **Implement in the issue worktree.** Branch from fetched `main` under
   `.workspaces/issue-NNN` with branch `fix/issue-NNN-slug`. Replace `NNN` with the
   issue number and `slug` with a short lowercase, hyphen-separated title fragment.
   Follow repository red/green rules: observe the regression test fail, implement
   the fix, observe it pass, then temporarily disable only the fix and confirm the
   test fails again. Restore it and rerun. For non-executable changes, explain why
   a reproduction test is inapplicable and use the relevant validators; do not
   manufacture static-value tests. Commit only this ticket's changes.
5. **Create or update the PR.** Push the issue branch and use `main` as its base.
   Follow the repository PR template. Reference the actual ticket with `Fixes #NNN`
   and keep requirements and acceptance criteria in that linked issue. Include a
   concise problem/result summary, change type, material decisions, risks, and
   folded check evidence in the description itself. Do not duplicate the issue
   body or add a reviewer briefing. Avoid first-person narration. Reuse the
   matching open PR.
   Keep drafts and logs in an owned `.tmp/` directory, never in committed files.
6. **Prepare every review round.** Fetch `main`, rebase the issue branch onto it,
   resolve conflicts, and run all required checks on the resulting committed HEAD.
   Publish the branch and update the PR description with the round's manifest and
   complete recorded evidence using the evidence reference. Do not publish logs
   or manifests as comments. Verify the remote PR head equals the checked SHA.
   A push after rebase uses an exact lease against the previously verified issue
   branch SHA; never force-push `main` in normal ticket work.
7. **Request review on the PR.** Verify its description references the issue and
   contains the current round number, base/head SHAs, and complete evidence.
   Authenticate and request review from the distinct bot account as described in
   setup. Launch or resume the reviewer with the PR locator only; its instructions
   come from this skill's [reviewer workflow](references/reviewer.md).
   The reviewer posts findings with native **Request changes** or
   signs off using native **Approve** on that exact head.
   Mark the ticket `review-pending`, scan all pending PRs for returned reviews,
   and start the oldest eligible independent issue when none needs action.
8. **Pair until clean when reviews return.** Read the PR, implement fixes, and answer each finding on
   the PR with the corrective commit or grounded explanation. Return to step 6
   for every review request, including evidence-only corrections. No findings,
   complete passing evidence, and current native approval are all required.
   Do not treat silence, a plain comment, or an old approval as sign-off.
9. **Integrate and clean up.** Follow [integration](references/integration.md).
   Preserve the approved commits with fast-forward-only integration into `main`.
   A changed base or head invalidates the round: rebase, rerun checks, and obtain
   another native approval. Verify remote integration and PR merged state before
   closing the issue and deleting owned artifacts. Retain every round's folded
   evidence in the PR description and the persistent queue across cleanup and
   restarts.
10. **Continue the queue.** Refresh affected dependencies and blockers after each
    transition. After every PR submission or review resubmission, inspect all
    pending reviews before starting more implementation. Continue while eligible
    implementation, returned reviews, or integration remain; pending reviews are
    unfinished work. Report ticket/PR links, landed SHAs, evidence and approval
    links, cleanup results, and exact blockers; never describe blocked work as done.

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
