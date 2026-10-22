## Discover and execute local checks

Read repository instructions, task definitions, CI workflows, and executable check
scripts. Discover exact commands, working directories, required environments, and
coverage thresholds. Run required local tests, lint, typecheck, build, and generated
artifact checks; CI does not waive repository development rules.
Never invent commands or thresholds. Keep diagnostics in owned `.tmp/` files when
needed for debugging; no published transcript or evidence archive is required.
Completion reports summarize the checks actually run, verified outcomes for the
relevant revision, and material limitations. Link native CI results, or reference
existing local log paths in local reports where applicable. Keep raw logs in the
execution system; do not create a separate evidence bundle. Local log paths do
not replace required CI, and failed, skipped, pending, or unrun required checks
must not be described as passing.

Before implementation, inspect applicable CI workflows, trigger conditions, and
required access. Resolve missing same-repository CI configuration under the
existing bounded prerequisite-repair policy when necessary for the task. Missing
access or an external outage suspends only dependent work; record the evidence
and unblock condition. An absent or empty check result never counts as success.

Verify required checks on untouched, fetched `main` before implementation. Create
or reuse a prerequisite repair issue for a reproduced baseline failure that blocks
required checks. Existing task authorization covers the smallest necessary
same-repository repair, with its own change set and the same checks, review, and
integration gates. Honor explicit exclusions and other owners' changes; never
weaken checks or add unrelated improvements. Compatibility layers still require
explicit authorization. Failures introduced by the current diff belong to the
current ticket. After rebase, reproduce failures on the new untouched base when
needed to classify them. Missing access or an external outage is a blocker, not
permission to invent a code repair.

For non-executable changes, run existing validators. Do not manufacture
static-value tests or publish test transcripts as a review requirement.

Commit the intended final tree before the review gate. If checks generate tracked
changes, commit those changes and rerun checks for the new SHA. Do not describe
results from a modified working tree as results for a published commit.

## Classify failures and preserve retry state

Distinguish code failures, confirmed infrastructure failures, missing
configuration or access, and pending checks using inspected evidence. Repair code
failures within the authorized scope. For confirmed transient infrastructure
failures, follow the repository's documented retry policy; if none exists, allow
at most two automatic reruns per unchanged PR revision, waiting 30 seconds before
the first and 60 seconds before the second. Persist the revision, failure
evidence, attempt count, and next retry time in the queue; restarting the agent
does not reset the budget. If the budget is exhausted and evidence still
establishes an infrastructure failure, record the blocker, preserve the resume
state, and continue independent authorized work under the blocker protocol. Do
not bypass CI or rerun code failures blindly.

Save the retry state before requesting a rerun. After a restart, reconcile it
with live CI runs before issuing another request; do not duplicate an already
requested or running rerun. Reference native run/check locators rather than
copying logs into the queue.

Pending CI or a running review does not consume infrastructure retry attempts
and does not justify suspension merely because time passes. Continue watching
with bounded polling and progress updates unless a verified unavailable
requirement, access failure, capacity failure, or outage establishes a blocker.

## Watch CI before every bot review

CI is the completion record for executed checks. Keep the PR description to its
issue reference, problem/result, change type, testing summary, decisions, and risks.
Do not copy logs, attach evidence bundles, create round manifests, or retain a
history of check attempts in PR text. GitHub's live check results are sufficient;
the reviewer does not need a separate proof package.

1. Read workflows and protection/ruleset requirements to identify the checks
   applicable to this PR. Include applicable CI even when branch protection does
   not mark it required. Inspect trigger conditions so an absent run cannot be
   mistaken for success. If CI is absent or cannot validate the change, apply the
   readiness and prerequisite-repair policy above; record unavailable requirements
   as blockers. Do not substitute a prose claim or silently waive CI.
2. Push the committed branch, verify the live PR head, and watch its checks:

   ```sh
   gh pr checks PR --watch --fail-fast
   ```

   Substitute the actual PR locator. Do not filter to `--required`, which can hide
   applicable failures. The CLI reports pending checks with exit code 8. If no
   checks have appeared yet, wait for the expected workflows; an empty result is
   not green. Use bounded waits and keep the user informed during long runs.
3. Inspect failures in CI, fix their cause, run required local checks, commit, and
   push. Watch the replacement run. Apply the classification and persisted retry
   policy above to infrastructure failures. Rerun affected CI only through
   permitted repository tooling and verify its outcome; do not rerun code
   failures blindly or bypass checks.
4. Before requesting review, refresh the PR and check results. Every applicable
   check must have completed successfully for the latest PR revision; pending,
   failed, cancelled, neutral, or unexpectedly skipped checks do not satisfy this
   gate. Exclude a conditional job only when inspected workflow conditions prove
   it is inapplicable. Confirm expected checks are present rather than relying
   solely on a watcher exit code or an aggregate badge.
5. Record the base/head and CI run/check locators in the local queue. A PR workflow
   may test GitHub's synthetic merge commit: verify that run belongs to this exact
   PR base/head, rather than requiring its tested SHA to equal the branch head.
   After any code push or rebase, discard old results and wait for current CI
   before a new bot review. Description-only edits do not require rerunning CI
   when the tested revision is unchanged.

The implementer stays on this issue through CI, review, integration, and cleanup
unless a verified blocker suspends it under the scheduling reference. Pending CI
alone does not justify suspension, and suspension never waives check gates.
Read live CI again before integration. A rerun that becomes pending or fails
closes the gate even if the same head already has an approval.

References: [watch PR checks](https://cli.github.com/manual/gh_pr_checks),
[status checks](https://docs.github.com/en/pull-requests/reference/status-checks),
[PR workflow revisions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request),
and [workflow logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs).
