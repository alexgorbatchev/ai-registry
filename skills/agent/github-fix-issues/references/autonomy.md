## Autonomous Execution

- Continue through discovery, implementation, validation, review, repair, integration, and publishing within the user's requested scope. Do not ask for confirmation between phases or repeat a request for authorization already given. Honor explicit user restrictions and higher-priority instructions.
- Investigate implementation choices using the issue, governing spec, repository instructions, code, tests, and history. A disagreement between the code and a stated requirement can be the defect to fix; it does not automatically require a user question.
- Resolve choices supported by those sources and record them as described below. Do not invent missing acceptance criteria, change authorized scope, or replace evidence with assumptions.
- Workers send unresolved questions to the coordinator, not the user. The coordinator investigates the cited sources before escalating. Ask the user only for a missing decision that changes acceptance criteria or authorized scope and cannot be resolved from available evidence, or for required access or capability that is unavailable.
- Block only the affected issue and its dependents; continue independent work where shared validation permits. Batch remaining questions with the evidence examined and the exact missing input. Progress updates do not require a reply.
- Treat a failed check as a repair task: save the failing command, exit code, output, and SHA; delegate a scoped repair in an isolated worktree from the current integration tip; require applicable red/green verification, a passing gate, and independent review before fast-forward integration. Rerun the integration gate and continue. Never disable checks, weaken assertions, or report a failing gate as passed.
- Respect explicit user stops and preserve unowned work. If no authorized work can proceed, report the blocker and saved run paths; do not claim completion.

## Decision Records

Record choices that resolve a requirement interpretation, reconcile conflicting sources, select validation commands, or determine an implementation approach where multiple approaches affect observable behavior. Skip mechanical choices such as local variable names.

- **Coordinator:** create `<RUN_DIR>/decisions.md` during discovery and remain its sole writer. Give every worker and reviewer its absolute path and this reference's absolute path.
- **Worker:** write `<worktree>/.tmp/decisions.md` before implementing a choice. Use IDs `issue-<N>-D001`, `issue-<N>-D002`, etc.; for repair tasks use the coordinator's unique task identifier instead of `issue-<N>`. Do not edit the shared run log.
  On takeover, read existing entries and continue their sequence; never reuse an ID.
- **Coordinator decisions:** use IDs `run-D001`, `run-D002`, etc. Record discovered validation choices before filling worker briefs.
- **Handoff:** workers include their decision file path and IDs in readiness, blocker, and final reports. The coordinator copies new entries into the run log, preserving IDs, before a review or further assignment relies on them.
- **Updates:** retain earlier entries. Add a dated update for new evidence or verification; if a choice changes, add a new ID with `Supersedes: <old-ID>` and mark the old entry superseded. Never silently rewrite the original rationale.
- **Review:** require the reviewer to verify each decision relevant to the diff against its cited requirement and evidence. A decision record cannot override the issue, governing spec, or user instructions. Cite decision IDs in review findings and worker evidence.
- Keep logs untracked under the run directory or worktree `.tmp/`. Do not commit logs or publish raw tool output. Update durable project documentation only where project rules or the issue require it. Redact credentials and private data from saved evidence.

Use this structure for every entry; fill every field with verified context or explicitly mark it pending:

```markdown
### <decision-ID>
- Recorded: <UTC timestamp>; author: <worker or coordinator identifier>
- Scope: <issue number or run/repair task>
- Question: <the choice or conflict being resolved>
- Decision: <chosen action, or the exact missing input if blocked>
- Status: chosen | blocked | superseded
- Impact: low | medium | high; <reason and affected files, callers, or contracts>
- Depends on: <decision IDs, or none>
- Evidence coverage: supported | gaps; <any missing evidence>
- Requirement: <issue/comment URL or spec/instruction file:line>
- Evidence: <source SHA and file:line, or tool command, exit code, and redacted output/log path>
- Rationale: <why the cited evidence supports this choice within scope>
- Verification: <check command, exit code, tested SHA, and evidence path; pending before execution>
```

A `chosen` entry needs evidence supporting the choice, even while its verification is pending. A `blocked` entry must list the sources already checked and the exact missing input; do not implement the disputed behavior. Update verification with actual results before reporting the choice as verified.

## Impact and Accumulation

Choose the highest applicable impact grade before implementing the decision:

| Grade | Criteria | Required verification beyond the normal pipeline |
|---|---|---|
| Low | Local and reversible; no shared contract, persisted representation, or public behavior changes. | Targeted tests or the applicable static validator. |
| Medium | Affects multiple callers or a shared component while preserving public behavior and stored representations. | Verify affected callers and the shared component together. |
| High | Changes public behavior, compatibility, stored data, access boundaries, or a contract used by another issue. | Verify affected boundaries and interactions; require a FULL review of the combined affected diff before final integration. |

Record evidence coverage separately from impact. `Supported` means cited evidence resolves the choice; verification may still be pending. `Gaps` means some evidence is missing and must be named. No impact grade permits inventing acceptance criteria. A gap that prevents establishing required behavior or safe execution makes the entry `blocked`.

After each handoff and rebase, and before final integration, the coordinator groups decisions that depend on one another or affect the same contract, stored representation, or caller. Record a `run-D...` entry listing the group's IDs, combined effect, effective impact grade, and required checks. Use at least the highest member grade, and raise it when their combined effect meets a higher-grade criterion. Do not add ordinal grades into a numerical risk score or assume independently approved choices remain compatible.

For example, two local serialization choices can jointly change a shared on-disk format; assess that combined change as high impact. If new evidence contradicts a supporting decision, mark it superseded or blocked, identify its dependent IDs, and revalidate their choices and tests before integration. Passing reviews of the individual decisions do not replace verification of their interaction.

Give the reviewer these group entries and require findings for unsupported grades, incompatible choices, missing interaction checks, and invalidated dependencies. Keep all normal gates; grades determine additional verification and review depth, not additional user approval requests.

For a high-impact group, include the integration base and reviewed HEAD SHAs in its record. Before final integration, run the gate on the combined integration tip and assign a FULL review against the fetched default branch, covering all linked changes and their affected callers. Give the reviewer the explicit diff base `origin/<default-branch>`, integration worktree, verified HEAD, and integration gate evidence; replace its normal per-issue diff base for this assignment. Reviewing only the latest issue's delta or comparing the integration branch to itself does not satisfy this check.

## Discovering Validation Without a Named Final Gate

Read applicable instruction files, CI workflows, build definitions, and executable project scripts. Identify the actual test, lint, typecheck, coverage, and artifact checks relevant to the project. If no aggregate final gate is named, compose one from those verified commands, preserving their required order and exit-on-failure behavior, and record its sources and exact command in a `run-D...` entry. Run it on the integration baseline before workers start.

Mark absent optional categories `none documented` and omit them from execution. Never execute that text, invent a command or threshold, use `--skip-check`, or omit a check the project requires. Escalate only if required validation cannot be established from inspected sources.
