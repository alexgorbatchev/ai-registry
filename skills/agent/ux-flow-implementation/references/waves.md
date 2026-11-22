# Running waves

- [Lanes and capacity](#lanes-and-capacity)
- [Units](#units)
- [The wave cycle](#the-wave-cycle)
- [Deploy, verify, close](#deploy-verify-close)
- [Resume](#resume)
- [Run log](#run-log)

The orchestrator selects tickets, starts units, reviews what they return, deploys, verifies and closes. Units implement and land; they never deploy or close. `programming` owns engineering delivery inside a unit and `issue-tracker` owns claims, comments, blockers, duplicates and closing; the orchestrator loads both.

## Lanes and capacity

- An implementation unit is heavy work (builds, a dev server, browser captures, the final gate), so units run one at a time; the orchestrator's basic work (reviewing returns, triaging reviews, editing tickets) may run beside it, and so may a blind reviewer, which only reads finished screenshots.
- Before starting each unit, run `bun <skill>/scripts/capacity.ts --path <worktree volume> --floor-gib <floor>`, where the floor is 8 GiB, raised to one unit's measured peak footprint (worktree, installed dependencies, build output, browser). Start the unit only when it exits 0, no other heavy lane runs on the machine, and the previous unit has landed or checkpointed and released. When it exits 1, start nothing and measure again later. Record each reading and the decision in the run log.
- Run units as workers whose lifetime does not depend on the orchestrator's conversation turn (a delegated task or detached run), so ending or compacting the turn does not kill them or strip their tools.

## Units

- One unit per ticket, keyed `impl-<ticket>`, or one unit for a short ordered list of tickets that touch the same code, keyed after the first.
- Brief each unit with `bun <skill>/scripts/render-brief.ts --config <state>/implementation/config.json [--unit <key>] <ticket>...`; pass its output verbatim as the unit's prompt. The [brief template](../assets/unit-brief.md) carries the unit's steps, its checkpoint stages, its evidence names and the final-gate verification, filled with the project's facts. Never paraphrase it.
- The checkpoint `<local>/units/impl-<ticket>.json` records the stages `claimed`, `baseline`, `built`, `verified`, `landed`, `commented`, `cleaned`, plus `worktree` and `revision`. The orchestrator adds `accepted`, `deployed` and `closed` as the wave reaches them.
- Choose each wave's tickets with `issue-tracker` (ready, by priority, then dependencies, foundations first). Tickets that fix test infrastructure hiding regressions, such as failing story or browser tests, go first: every later unit's evidence depends on them. Tickets outside the queue mandate stay queued.

## The wave cycle

1. **Start.** Take the chosen tickets one unit at a time: check capacity, render the brief, start the unit, and start the next once it has landed or checkpointed and released.
2. **Review returns.** As each unit returns, read its checkpoint, ticket comment and checks against the ticket's acceptance criteria. Send gaps back to the unit. Check that each ticket under `filed` exists and file any defect its notes name without one. A `productCalls` entry goes to the owner as the owner's instructions require; work that does not depend on it continues.
3. **Blind review.** When the wave's units have landed, run the [blind review](visual-qa.md#blind-review) of their after frames and its triage. No ticket is accepted without it, and neither the unit nor the orchestrator signs off its own screenshots.
4. **Deploy and verify.** See below.
5. **Chrome review.** Run the [chrome review](visual-qa.md#chrome-review) on the deployed wave and file what it finds.
6. **Log.** Comment on the epic and append to the run log (**Run log**), then start the next wave with the tickets the reviews filed in the queue.

Merge duplicates as they appear: close the later ticket as a duplicate of the survivor through `issue-tracker`, carrying its evidence over.

## Deploy, verify, close

The orchestrator owns these, when the project deploys from the run (the config has `deploy`) and its policy requires or authorizes deployment:

1. Deploy the wave's accepted, landed tickets together with the config's deploy commands, from where the config says they run. Use a disposable worktree at the target branch's fetched tip and remove it afterwards; never deploy from a unit's worktree or the main checkout.
2. Verify in production: each ticket's changed states, plus audit-screen over the config's `qa.screens` across the matrix. A regression blocks closing its ticket and becomes a ticket of its own or a fix in the next wave.
3. Close each verified ticket through `issue-tracker` with the deployed revision. Close a redesign ticket when all its slice tickets are closed and its acceptance criteria are verified in production; close the findings it resolves with it.
4. When deployment is blocked by infrastructure, record the blocker and its unblock condition on the epic, ask the owner when the fix needs their approval, and keep landing units; deploy the waiting tickets together once it clears. When deployment is not authorized, report the tickets as landed and awaiting deployment.

## Resume

On restart, before claiming anything new, read each `<local>/units/impl-*.json` checkpoint and its ticket. On another machine, where those checkpoints are absent, the tickets' comments and the run log carry what landed:

- Its revision is on the target branch: continue from the first orchestrator stage not recorded; never land it again.
- Its worktree exists: inspect its status, branch, local commits and uncommitted files against the remote, and restart the unit with the same key and brief, which continues from the first stage not recorded. Never recreate, reset or clean a worktree that holds work. Resume preserved units in priority order as lanes free up.
- Its worktree is gone and nothing landed: restart the unit from `claimed`.
- A ticket claimed with no checkpoint and no comment from this run is not owned; resolve it under `issue-tracker` before touching it.

## Run log

After each wave, comment on the epic and append the same to `<state>/implementation/run.md`: tickets landed with revisions, the blind and chrome review results, the deployed revision and where it ran, tickets closed, tickets filed, measurements and caps, blockers with unblock conditions, and the next wave. Owner feedback on delivered UI becomes tickets in the epic before the next wave starts, with the owner's report quoted and a measured screenshot; a report that reveals a class of defect starts a sweep over the delivered screens for the same class, and its tickets take priority over the remaining slices when they make controls unusable or unreadable.
