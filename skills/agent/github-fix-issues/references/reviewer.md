## Review contract to publish on the PR

You are the independent review agent for this PR. Read the PR description,
conversation, review threads, native reviews, requirements, and the current round
manifest. Obtain all task context and communicate solely through this PR. Reuse
the PR record after a restart; do not request a private implementer briefing.

1. Run the installed skill's reviewer helper with `access ensure --pr NUMBER
   --no-issues` before posting, using the setup/configuration reference on the PR.
   This authentication/access helper is permitted tooling; the implementer must
   have installed its dependencies before handoff. It verifies the bot differs
   from the PR author. Use that verified identity for every comment and review;
   never approve through the author's account.
2. Review the full diff at the manifest's base and head, with source context and
   applicable repository instructions. Inspect changes since the prior round too,
   but do not substitute that delta for checking the complete proposed result.
   Verify live PR base/head still match the round. Treat a changed head or base as
   stale and request refreshed evidence/review on the PR.
3. Do not run tests, builds, linters, typechecks, formatters, coverage, benchmarks,
   reproduction commands, package installs, repository scripts, or application
   code. Do not trigger CI or ask another agent to run checks on your behalf.
   Git diff/show, source/file reads, searches, GitHub inspection, the installed
   reviewer access helper, authentication,
   comments, and native review submission are permitted. Use the supplied logs
   to assess execution results; never claim to have executed them yourself.
4. Verify the round identifies every required check, command, exit status, tested
   revision, and complete recorded output. Require final passing evidence for the
   exact head and documented red/green evidence or the static-only rationale.
   Check that generated artifacts, docs, tests, and acceptance criteria match the
   diff. Missing, truncated, unrelated, or stale evidence is a finding; request
   the implementing agent to supply it on the PR rather than running the check.
5. Review for correctness, edge cases, regressions, security, data loss, semantic
   misuse, unsupported assumptions, maintainability, and project-rule violations
   within the diff and affected callers. Trace consequential decisions to cited
   requirements. Distinguish actionable defects from personal stylistic preferences.
6. Post each actionable finding on the PR with severity, file/line or evidence
   reference, failing scenario, impact, and requested correction. Include unresolved
   earlier findings. Ask questions on the PR. Submit native **Request changes**
   when any finding or evidence gap prevents sign-off; a comment alone does not
   communicate the required review outcome.
7. When every finding is resolved and all evidence requirements hold, submit
   native **Approve** against the exact reviewed head. State the base/head,
   round/evidence links, and that repository checks were assessed from supplied
   evidence, not executed by you. Recheck the live PR immediately before submission.
8. Read back the review to verify its author, submitted state, and commit ID.
   Do not send findings or approval through agent messages or final chat reports.
   Remain available for the next PR round; the implementing agent reads GitHub.

## Submit an outcome bound to the reviewed commit

Use GitHub's native review API through the configured reviewer CLI command:
`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` with `commit_id` set to the
full reviewed head, `event` set to `REQUEST_CHANGES` or `APPROVE`, and `body`
containing the findings or sign-off above. Use a structured JSON file with
`api --method POST ... --input PATH`; do not interpolate review text into a shell
command. GitHub returns `CHANGES_REQUESTED` or `APPROVED` respectively.

Read back the native review and recheck the head after submission. If either SHA
changed during submission, report staleness on the PR; that review does not unlock
integration. A pending review, plain comment, reaction, or approval on a previous
head cannot satisfy sign-off. Repository-required additional reviewers still apply.

References: [native review API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request)
and [structured CLI API input](https://cli.github.com/manual/gh_api).
