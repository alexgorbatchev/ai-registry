---
description: >-
  Execute ticket-driven work in isolated branches or worktrees with separate
  implementation and review passes, bounded forward-sync, and real verification
  before integration. Use when asked to work on tickets or task lanes that need
  structured implementation, independent review, verification discipline, or
  controlled merge-back to the primary branch. Do not use for trivial one-off
  edits that do not need ticket workflow, isolated lanes, or separate acceptance
  review.
name: 'agentic-workflow'
---
## Mission

Execute work reliably in isolated branches/worktrees, use separate implementation and review passes, require real verification before accepting results, and integrate approved work back to the main branch one lane at a time.

## Important operating assumption

Assume other work is always happening in the same repo while a lane is in flight.

That means:
- the primary branch moving is normal, not exceptional
- unrelated drift on the primary branch is not, by itself, a reason to block integration forever
- the goal is bounded forward-sync + proof, not endless rebase/re-review churn

## Non-negotiable rules

1. **Do not work directly on the primary branch.**
   - Create an isolated worktree or equivalent isolated branch checkout for every implementation lane.
   - Treat the primary checkout as integration territory, not as a development sandbox.

2. **Separate implementation from acceptance.**
   - A worker or implementation pass may claim completion, but that is never final acceptance.
   - Every lane must be reviewed by a separate reviewer pass before it can be merged.

3. **Do not overstate completion.**
   - Task status, checklists, and summaries must match actual verification.
   - If required verification is blocked, incomplete, or failing, mark the work as partial/blocked rather than complete.

4. **Do not manually poll logs unless necessary.**
   - Prefer background/async execution where agents report back on completion.
   - Investigate logs directly only when there is a specific failure that requires it.

5. **Do not loop on reruns.**
   - Count every full verification rerun explicitly.
   - One blind rerun is the maximum allowed for a suspected transient startup/harness failure when no code changed.
   - After the second failure of the same command on the same snapshot, stop rerunning and debug the root cause.
   - If the failure signature matches a prior failure, treat it as the same unresolved blocker until proven otherwise.
   - Do not launch another full repo-wide check until there is either:
     1. a code/config/docs change intended to fix the failure, or
     2. a narrower reproducer that demonstrates the previous failure was environmental only.

6. **No merge before proof.**
   - No merge before reviewer pass.
   - No merge before the required verification command for that lane has actually passed.
   - Then integrate onto the primary branch explicitly, one lane at a time.

## Default operating model

### 1) Discover and scope

Before implementation:
- identify the exact task or ticket scope
- identify the files, modules, or systems that belong to that scope
- identify any shared infrastructure that may be affected
- identify the required verification commands up front
- decide whether the task should be split into multiple isolated lanes

If project-specific instructions, standards, or skills exist, read them before making changes.

### 2) Split into lanes when appropriate

Use multiple lanes when work can be isolated by domain, file area, or ticket range.

Each lane must have:
- its own isolated worktree/branch
- a clear scope boundary
- explicit allowed files/areas
- explicit verification requirements
- explicit instructions not to touch unrelated areas

Do not combine unrelated work into one lane just because it is convenient.

### 3) Dispatch implementation passes

For each lane, run an implementation pass that is instructed to:
- work only inside its assigned scope
- keep changes minimal and focused
- avoid unrelated refactors
- leave the branch clean
- make focused commits
- report exactly what changed and what verification passed

### 3a) Tool usage for async agentic workflows

When launching agentic workflows programmatically, use the **`subagent` tool**, not slash commands embedded in task text.

Rules:
- use explicit tool-native dispatch (`agent`, `task`, `chain`, `tasks`)
- do **not** put `/run`, `/chain`, or other slash commands inside the task body
- always pass an **absolute** `cwd` pointing at the dedicated worktree
- prefer `context: "fresh"` so each lane starts clean
- set `clarify: false` for unattended/background execution
- use `agentScope: "both"` unless you intentionally need a narrower source
- for long-running background work, use `async: true`
- worker and reviewer should be launched as **separate runs**, not as one coupled worker-review chain

Recommended patterns:

#### A) Launch one async worker lane

Use this when one worktree owns one scoped implementation lane.

```json
{
  "agent": "worker",
  "task": "<clear scoped instructions>",
  "cwd": "/absolute/path/to/repo/.agents/worktrees/<lane>",
  "context": "fresh",
  "async": true,
  "clarify": false,
  "agentScope": "both",
  "maxOutput": { "bytes": 120000, "lines": 4000 }
}
```

Task text should include:
- exact scope
- required files/areas
- required skills/docs to read first
- required verification commands
- instruction to avoid unrelated edits
- instruction to leave the branch clean

#### B) Launch one async reviewer lane

Use a separate reviewer after the worker reports completion.

```json
{
  "agent": "reviewer",
  "task": "<review the completed lane; do not modify code>",
  "cwd": "/absolute/path/to/repo/.agents/worktrees/<lane>",
  "context": "fresh",
  "async": true,
  "clarify": false,
  "agentScope": "both",
  "maxOutput": { "bytes": 120000, "lines": 4000 }
}
```

Reviewer instructions should explicitly require:
- no code changes
- concrete findings only
- severity, file path, impact, and fix guidance
- scrutiny of verification claims, not just code shape

#### C) Launch a discovery/planning chain inside one lane

Use a chain when the lane needs a structured scout -> planner -> worker handoff.

```json
{
  "chain": [
    { "agent": "scout", "task": "Analyze the lane scope and identify relevant files, constraints, and risks." },
    { "agent": "planner", "task": "Produce an implementation plan based on {previous}." },
    { "agent": "worker", "task": "Implement the plan from {previous} within the lane scope and run verification." }
  ],
  "cwd": "/absolute/path/to/repo/.agents/worktrees/<lane>",
  "context": "fresh",
  "async": true,
  "clarify": false,
  "agentScope": "both",
  "maxOutput": { "bytes": 120000, "lines": 4000 }
}
```

Use this only for the implementation side. Do **not** treat this as review/acceptance. Review still happens in a separate reviewer run.

#### D) Launch multiple independent lanes in parallel

Use this only when lanes are truly isolated.

```json
{
  "tasks": [
    {
      "agent": "worker",
      "task": "<lane A instructions>",
      "cwd": "/absolute/path/to/repo/.agents/worktrees/lane-a"
    },
    {
      "agent": "worker",
      "task": "<lane B instructions>",
      "cwd": "/absolute/path/to/repo/.agents/worktrees/lane-b"
    }
  ],
  "context": "fresh",
  "async": true,
  "clarify": false,
  "agentScope": "both",
  "maxOutput": { "bytes": 120000, "lines": 4000 }
}
```

Only parallelize when there is no meaningful file or workflow overlap.

#### E) Async supervision policy

When using async subagent runs:
- let the system report completion back automatically
- do not manually poll logs as the default workflow
- dispatch follow-up reviewer/fix runs only after a run reports back
- preserve the same worktree for the lane through worker -> reviewer -> fix -> re-review

### 4) Dispatch independent review passes

After a lane reports completion, run a separate reviewer pass against that lane.

The reviewer should evaluate:
- whether the implementation actually satisfies the task definition
- whether tests/stories/harnesses match real production behavior
- whether any testing seam added to production code is justified and safe
- whether verification is sufficient for the lane’s completion claim
- whether task tracking/status updates are truthful

Review findings should include:
- severity
- file path(s)
- why the issue matters
- what the fix should be

### 5) Run a fix -> re-review loop

If review finds issues:
- send the lane back for a scoped fix pass
- limit the fix pass to the reviewer findings and the minimum support changes required
- rerun verification
- re-run review

Repeat until the lane has:
- no meaningful unresolved review findings
- real verification proof for the lane’s acceptance criteria

## Verification policy

Verification must match the task’s actual completion gate.

Rules:
- do not substitute compilation/build success for behavioral verification
- do not substitute lint/typecheck for behavioral verification
- if an exception requires a separate non-default test path, run it explicitly
- if shared test infrastructure changed, rerun the affected verification after that fix is in place
- prefer the narrowest command that actually proves the lane, but do not use a narrower command that misses required behavior
- if a full verification command fails, capture the exact failing phase and first concrete error before deciding the next step
- if the failure is in shared harness/config/bootstrap infrastructure, treat that as the active task; do not keep rerunning the full suite while the root cause is unresolved
- before repeating a full verification command, state why the next run is expected to produce a different result

### Failure triage and rerun budget

Use this exact triage order after any failed repo-wide check:
1. identify the first failing phase (format, lint, typecheck, unit, storybook/browser, e2e, mergeability, or other)
2. extract the first concrete actionable error, not just the top-level process exit
3. decide whether the failure is:
   - product code
   - test fixture/mock
   - shared harness/config/import/bootstrap
   - environment/transient startup
4. run the narrowest command that can confirm the diagnosis
5. make the fix
6. rerun the narrow proof first
7. only then rerun the full repo-wide command

Rerun budget rules:
- maximum 2 full runs of the same repo-wide command on the same unresolved failure chain
- the second run is allowed only to confirm or refute a transient-startup hypothesis
- a third full run is forbidden unless something material changed and that change is named explicitly in the progress note
- “material changed” means code, config, dependency state, environment state, or verification inputs changed in a way that plausibly fixes the failure
- “waited longer” or “try again” is not a material change

Examples of acceptable proof:
- lane-specific automated test command that exercises the changed behavior
- broader suite run when shared infrastructure changed
- paired commands when one command covers stories/UI behavior and another covers direct unit/contract behavior

## Truthfulness rules

Task trackers, checklists, and progress summaries must remain honest.

Allowed:
- marking items complete only after required verification has passed
- marking items partial or blocked when proof is incomplete
- documenting explicit exceptions where the task definition itself allows an exception

Not allowed:
- marking work complete based only on builds or static checks
- claiming coverage for behavior that the verification does not actually exercise
- leaving completion boxes checked after review shows the claim is false

### Verification provenance template

When a lane needs an in-repo proof note, use a **stable provenance template** instead of relative wording like:
- “tested HEAD”
- “current branch head”
- “this refresh”
- “implementation commit”

Those phrases become ambiguous as soon as a docs-only follow-up commit moves the tip.

Use explicit roles instead:
- **last code-bearing commit**: the last commit that changed the implementation or tests for the lane
- **tested commit**: the exact commit on which the verification commands were run
- **current tip**: the branch tip at the time the note is written
- **docs-only follow-up commits**: any later commits that changed only tracking/provenance files

Preferred note structure:
- exact commands run
- exact timestamps/results
- last code-bearing commit SHA
- tested commit SHA
- current tip SHA
- explicit statement of whether only tracking/docs files changed between the tested commit and the current tip

### Provenance rules

- Do **not** call a docs-only commit the “implementation” commit.
- Do **not** call a previously tested commit “current HEAD” after the tip has moved.
- If the tip moves because of a docs-only proof refresh, either:
  1. rerun the verification on the new tip, or
  2. explicitly state that the tested commit is earlier and that the current tip is docs-only with no code changes.
- If there are multiple docs-only commits after the tested commit, enumerate them or clearly describe the full docs-only chain so a reviewer does not need to reconstruct history manually.
- Prefer one stable proof note per accepted code snapshot. Avoid repeated provenance-only tip churn when a note can instead describe the code-bearing commit, tested commit, and docs-only chain explicitly.
- When possible, attach proof to the **tested code snapshot**, not to a later wording-only tip.

## Shared infrastructure policy

Treat shared testing/build/runtime support files as integration hotspots.

Typical examples:
- test runner config
- Storybook/test harness config
- shared mock/interceptor helpers
- package scripts / verification scripts
- shared fixtures or runtime helpers

Rules:
- keep shared infra changes minimal
- make them safe after merge, not only in one local layout
- avoid global last-wins monkey-patching that is unsafe for concurrently mounted tests/stories
- preserve unmatched behavior so existing mocks/infrastructure still work
- prefer scoped, composable mocking over one-off global overrides

If multiple lanes need the same infra fix, converge on one safe solution rather than creating several incompatible variants.

## Merge policy

Use this merge gate for future work:

1. **No merge before reviewer pass.**
2. **No merge before lane-specific verification proof.**
3. **No merge before mergeability against the current primary tip is checked explicitly.**
4. **Then explicitly integrate onto the primary branch, one lane at a time.**

Additional rules:
- do not batch-merge multiple lanes at once
- assume the primary branch may advance while the lane is being implemented, reviewed, or queued for integration; that alone is not a blocker
- if the primary branch has moved, bring the lane forward to the latest tip once via rebase or merge before integrating
- do not keep chasing a moving primary tip forever; use a bounded forward-sync step, rerun the relevant proof, and integrate promptly if green
- shared infrastructure conflicts must be resolved deliberately
- rerun the required proof if the forward-sync changed relevant code, changed verification infrastructure, introduced conflicts, or touched overlapping surfaces
- reviewer-clean on an older snapshot is stale when the lane's code-bearing snapshot changes materially, or when the integration base changes in overlapping/relevant areas; unrelated primary-branch movement does not automatically void acceptance
- do not call a lane acceptance-ready until the reviewed snapshot, the mergeable snapshot, and the verified snapshot are either the same code-bearing snapshot or are explicitly documented as a bounded forward-sync with non-overlapping drift

## Integration procedure

When a lane is approved and verified:
- confirm the branch/worktree still exists
- confirm it has not already been integrated
- confirm the latest reviewer pass applies to the exact code-bearing snapshot you intend to integrate
- run an explicit mergeability check against the current primary tip before integrating
- if the primary branch advanced, do one bounded forward-sync step onto the latest primary branch state
- resolve conflicts carefully
- rerun the narrowest relevant proof needed to show the forward-synced lane still holds; do not restart the whole acceptance loop solely because unrelated work landed elsewhere in the repo
- if the forward-sync materially changed the lane or exposed overlapping contract drift, re-review as needed
- merge explicitly
- run the authoritative post-integration verification on the primary branch
- verify that the merge actually landed

Integrate one lane at a time.

### Post-integration failure rule

If the primary-branch post-integration verification fails:
- treat the lane as not complete yet
- do not start another blind full rerun on the primary branch
- debug the first concrete failure on the integrated branch state
- fix the root cause on the primary branch or a fresh fix lane, as appropriate
- rerun narrow proof first, then rerun the full primary-branch verification
- only after that full primary-branch verification passes may the lane be called complete

## Cleanup and audit

After successful integration:
- confirm the lane is truly merged
- only then remove the worktree/branch
- if there is any suspicion that worktrees/refs were deleted unexpectedly, investigate with version-control evidence rather than guessing

Useful audit signals:
- current worktree list
- branch/ref existence
- reflogs
- reachable vs unreachable commits
- worktree administration directories

## Due diligence expectation

Apply “see something, say something.”

Always call out, even if not explicitly requested:
- correctness bugs
- false completion claims
- missing verification
- unsafe mocking or state leakage
- production/test contract mismatches
- testing-only seams added to production code without justification
- shared infrastructure drift across lanes
- merge/integration risks

## Standard checklist

For any future task, use this checklist:

- [ ] read the governing instructions/skills/docs first
- [ ] define exact lane scope and required verification
- [ ] create an isolated worktree/branch
- [ ] dispatch implementation
- [ ] require focused commits and clean branch state
- [ ] dispatch independent review
- [ ] run fix -> re-review until clean
- [ ] confirm required proof actually passed
- [ ] keep task tracking truthful
- [ ] integrate onto the primary branch one lane at a time
- [ ] verify the merge landed before cleanup

## Default stance

Be skeptical of “done” claims until all of these are true:
- the implementation matches the real production path
- the reviewer agrees the lane is complete
- the required verification command for that lane has actually passed
- the latest mergeability check against the current primary tip is clean
- if the lane has already been integrated, the post-integration verification on the primary branch has passed
