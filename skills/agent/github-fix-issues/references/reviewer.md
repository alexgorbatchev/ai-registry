## Reviewer workflow

Read these instructions from the installed skill; do not publish them on the PR.
As the independent reviewer, read the PR description, its linked issue and issue
comments for requirements, the PR conversation, review threads, native reviews,
and live CI results for the current PR revision. Communicate solely through
the PR. Reuse that record and linked requirements after a restart; do not request
a private implementer briefing or a pasted reviewer contract.

1. Run the installed skill's reviewer helper with `access ensure --pr NUMBER
   --no-issues` before posting, using this skill's setup reference and saved local
   reviewer configuration.
   This authentication/access helper is permitted tooling; the implementer must
   have installed its dependencies before handoff. It verifies the bot differs
   from the PR author. Use that verified identity for every comment and review;
   never approve through the author's account.
2. Read and record the live PR base/head, then review the full diff with source
   context and applicable repository instructions. Inspect changes since the prior round too,
   but do not substitute that delta for checking the complete proposed result.
   Verify live PR base/head still match the reviewed revision. Treat a changed
   head or base as stale and require green CI and a fresh review on the PR.
3. Do not run tests, builds, linters, typechecks, formatters, coverage, benchmarks,
   reproduction commands, package installs, repository scripts, or application
   code. Do not trigger CI or ask another agent to run checks on your behalf.
   Git diff/show, source/file reads, searches, GitHub inspection, the installed
   reviewer access helper, authentication,
   comments, and native review submission are permitted. Inspect CI results and
   CI diagnostics as needed; never claim to have executed those checks yourself.
4. Verify the PR references the correct issue and all applicable CI is green for
   the exact PR revision, following [checks and CI](checks-and-ci.md). Missing,
   pending, failed, cancelled, unexpectedly skipped, or stale checks prevent
   approval. Do not require logs, round manifests, evidence bundles, or red/green
   transcripts in the description or comments; GitHub's check results are the
   completion record.
   Check that generated artifacts, docs, tests, and acceptance criteria match the
   diff. Missing CI coverage or a stale result is actionable; request correction
   on the PR rather than executing checks or accepting a prose success claim.
5. Review for correctness, edge cases, regressions, security, data loss, semantic
   misuse, unsupported assumptions, maintainability, and project-rule violations
   within the diff and affected callers. Trace consequential decisions to cited
   requirements. Distinguish actionable defects from personal stylistic preferences.
6. Post each actionable code finding as a native inline review comment anchored
   to the affected diff line or smallest relevant line range. Include severity,
   failing scenario, impact, and requested correction in the comment body. Do not
   substitute a PR conversation comment or review-body list containing paths and
   line numbers for an inline thread. Put CI gaps and other findings with
   no code location in the Request changes body with their source or check link;
   never invent a code anchor. Keep unresolved earlier findings in their existing
   threads and reference those threads in the new review rather than duplicating
   them. Ask only questions needed to resolve actionable issues.
   Keep feedback limited to those findings; omit diff recaps, review summaries,
   compliments, and check-assessment narration. Submit native **Request changes**
   when any finding or CI gap prevents sign-off; a comment alone does not
   communicate the required review outcome.
7. When every finding is resolved and all CI requirements hold, submit
   native **Approve** against the exact reviewed head with no review body and no
   inline comments. Do not post a separate approval comment, summary, diff recap,
   evidence recap, assessment notice, or "no issues" message. The native approval
   is the entire clean-review response. Recheck the live PR immediately before
   submission; all existing review and CI gates still apply.
8. Read back the review and its native review comments to verify the author,
   submitted state, commit ID, and each intended file/line or range anchor.
   Do not send findings or approval through agent messages or final chat reports.
   Remain available for the next PR round; the implementing agent reads GitHub.

## Submit an outcome bound to the reviewed commit

Use GitHub's native review API through the configured reviewer CLI command:
`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` with `commit_id` set to the
full reviewed head. For a clean review, send `event: "APPROVE"` and omit `body`
and `comments`; GitHub's returned `commit_id` records the reviewed revision.
For actionable findings, send `event: "REQUEST_CHANGES"` and put each new code
finding in the review's `comments` array. Each entry supplies `path` (repository
relative), `body`, `line` (file line number, not diff position), and `side`.
Use `RIGHT` for additions or unchanged context and `LEFT` for deletions. For a
multi-line finding, also supply `start_line` and `start_side`; `line` and `side`
identify the end of the range. Derive every anchor from the inspected diff at
the reviewed base/head; do not guess line numbers or use deprecated `position`.

GitHub requires `body` for `REQUEST_CHANGES`. When all findings are inline, use
only a pointer such as "Address the inline review findings." Otherwise include
only the non-code findings and links to unresolved earlier threads. Do not copy
inline findings into the body or post them with `gh pr comment`. `gh pr review`
does not expose inline anchors; use `gh api` through the configured bot identity.
If an inline submission fails, inspect the API error and refresh the diff and
live SHAs before retrying. Do not fall back to a path/line list or claim an
unposted finding was delivered. Do not add a general review summary to either
outcome. Use a structured JSON file in an owned `.tmp/` directory with
`api --method POST ... --input PATH`; do not interpolate review text into a shell
command. GitHub returns `CHANGES_REQUESTED` or `APPROVED` respectively.

Read back the native review and its comments using
`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments`.
Verify each new finding's review ID, bot author, commit ID, path, side, line, and
range match the submitted payload. Read native review comments explicitly;
general PR conversation comments alone do not contain the inline findings.
Reply to an existing finding through
`POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`
with a structured `body`, using the thread's top-level comment ID and the replying
agent's identity. Keep corrections and follow-up questions in that thread.

Recheck the live base/head after submission. If either SHA
changed during submission, report staleness on the PR; that review does not unlock
integration. A pending review, plain comment, reaction, or approval on a previous
head cannot satisfy sign-off. Repository-required additional reviewers still apply.

References: [native review API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request)
and [review comments and replies](https://docs.github.com/en/rest/pulls/comments)
and [structured CLI API input](https://cli.github.com/manual/gh_api).
