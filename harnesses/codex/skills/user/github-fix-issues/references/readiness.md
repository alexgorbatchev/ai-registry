## Queue Preparation

The coordinator owns `<RUN_DIR>/queue.md`. Prepare the queue before provisioning issue worktrees; run readiness checks for each issue before starting its worker.

1. Inventory every issue in the requested scope, regardless of labels. Read issue bodies, comments, and governing specs to identify acceptance criteria, dependencies, and mandatory implementation order. Initialize unexamined issues as `investigate`; an empty Questions section is not evidence of readiness.
2. For a governing spec, obtain the issue's requirements checklist during queue preparation using the pipeline's checklist extractor where provided. Otherwise record the acceptance criteria from the issue with source citations. Save the checklist as `<RUN_DIR>/checklist-<N>.md`. Investigate questions using repository instructions, code, tests, and history; log supported resolutions in `decisions.md` and cite their IDs in the checklist.
3. Assign a readiness state using the table below. Record each issue in `queue.md` with the fields below. Do not invent missing acceptance criteria or dependencies.
4. Once the queue's dependencies are mapped, start eligible ready issues as capacity permits while remaining checklists and investigations proceed. Do not wait for all questions in the queue to be resolved. Respect the pipeline's shared baseline gate and reserve capacity for extraction and review.

## Readiness States

| State | Required evidence | Coordinator action |
|---|---|---|
| `ready` | Acceptance criteria examined and resolved; required access available; prerequisites integrated; mandatory ordering satisfied. | Provision the worktree and start its worker when shared gates and concurrency permit. |
| `investigate` | Readiness checks incomplete, or a question may be resolvable from repository evidence. | Investigate or extract requirements while independent ready issues run. |
| `blocked` | Missing user input or access, an unmet prerequisite, or a required decision unresolved after investigation. | Hold this issue and its dependents; record the exact blocker and continue independent work. |

Readiness and impact are separate. A high-impact issue can be ready and retains its stronger verification and review requirements. Low impact does not make an unanswered acceptance criterion ready.

## Queue Record

Use one row per issue; only the coordinator edits this file:

| Issue | Readiness | Dependencies and status | Required order | Questions or exact blocker | Checklist and source citations | Decision IDs | Execution |
|---|---|---|---|---|---|---|---|
| <issue number/URL> | ready / investigate / blocked | <issue IDs and integrated/pending, or none> | <mandatory predecessor IDs and citation, or none> | <unresolved question IDs and missing input, or none> | <checklist path; issue/spec revision or observation timestamp> | <IDs, or none> | queued / running / integrated |

Record each state change below the table with a timestamp, issue number, old and new state, reason, and supporting evidence or decision IDs. An integrated row describes integration into the pipeline branch, not remote publication or issue closure.

## Scheduling and Rechecks

- Select only queued `ready` rows. Among eligible rows, prioritize issues that unlock the most documented dependents; then use foundational/data/core, services, UI, and tooling order. Use the tracking issue's listed order as a tie-breaker unless the spec or user makes it mandatory.
- Preserve verified dependency constraints and mandatory spec/user order even when a later issue has no questions. Independent ready issues may proceed while an earlier non-mandatory issue is under investigation.
- Apply existing file-disjointness, worker capacity, and review-slot rules. A busy worker slot or a shared gate failure does not justify inventing a user question.
- Recheck the chosen issue's row, checklist, source revisions, and dependencies immediately before provisioning. Reuse the prepared checklist; rerun extraction only when its governing requirements changed.
- Update the queue after investigation, a user answer, a worker blocker report, integration of a prerequisite, a rebase, or evidence invalidating a supporting decision. Move newly eligible issues to `ready` and refill workers automatically.
- If a running issue gains an unresolved acceptance criterion, have its worker preserve its work and hold only the affected implementation. Continue independent work within verified scope; do not integrate the issue while its blocker remains.
- Batch questions requiring user input and present the evidence examined and exact missing decisions. Continue ready work while answers are pending.
- Before reporting completion, account for every issue in the requested scope. If unresolved blockers remain, report their rows and missing input rather than declaring the queue complete or silently dropping them.
