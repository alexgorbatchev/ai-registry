# Implementing redesign tickets

- [Scope](#scope)
- [Units and concurrency](#units-and-concurrency)
- [The unit brief](#the-unit-brief)
- [Waves: deploy, verify, close](#waves-deploy-verify-close)
- [Resume](#resume)
- [Flaky tests](#flaky-tests)

Phase 10 detail. [Orchestration](orchestration.md) owns checkpoints, failures and services; this file adds what implementation units do. `programming` owns engineering delivery (tests, coverage, UI evidence, Git integration, cleanup) and `issue-tracker` owns claims, comments, blockers and closing; units load both and follow them, and this brief only adds the run's structure.

## Scope

- Implement only the tickets the owner authorized: named tickets, or the redesign epic's queue when queue execution is authorized. Order slice tickets by their blockers and priority, foundations first.
- A unit decides what its tickets, proposals and the pattern reference leave open, records each decision on the ticket, and continues. Precedence: the pattern reference over the proposal, both over the slice ticket's text. Product calls that change behavior the reference settled go to the owner (Phase 7 rules); bookkeeping (order, naming, priorities) never does.

## Units and concurrency

- Unit key `impl-<ticket>` for one ticket, or the first ticket of a short ordered list one unit implements in sequence. Checkpoint stages: `claimed`, `baseline`, `built`, `verified`, `landed`, `commented`, `cleaned`, each recorded when done, plus `worktree` (absolute path) and `revision`.
- Start a unit only while the machine has room, measured just before each start: the 1-minute load average below the CPU core count, memory not under pressure, and free disk on the volume holding worktrees, dependency stores and build output above the floor. Default floor: 8 GiB, raised to at least one unit's measured peak footprint (worktree, installed dependencies, build output, browser) times the units that may still grow. When a check fails, start nothing new and recheck when a unit finishes. Record each measurement and cap in the run log.
- Units check free disk before setup, verification and heavy builds. Below the floor a unit stops starting work, records its state on the ticket and returns it as an environment issue.

## The unit brief

Give every unit these instructions, filled with the project's paths, recipes and hosts:

1. **Read.** Load `programming` and `issue-tracker`; read the project instructions that cover the app.
2. **Claim.** Claim the ticket. If it is already claimed, read its comments: a comment from an earlier run of the same unit key means this unit owns it and resumes (see [Resume](#resume)); otherwise skip it and report it.
3. **Understand.** Inspect the ticket, its redesign ticket, the proposal, the wireframe and the pattern rules it cites.
4. **Isolate.** Create a worktree from the target branch's freshly fetched remote tip on a branch named as `issue-tracker` and the repository require, and prepare it with the project's setup. Dependencies copied from another checkout can hold stale links and caches: after setup, and after any rebase that changes the lockfile, reinstall from the lockfile and delete bundler, test-runner and prebuilt component-gallery caches. Keep scratch under `<worktree>/.tmp/<unit>/`. Never edit the main checkout or another unit's worktree.
5. **Own instances.** Run the app on a preview host name or port of the unit's own, never the shared one. Name every browser session after the unit and close only those; never close all sessions, which kills other units' browsers.
6. **Library first.** A missing variant, composition or fix in a shared component library goes into that library's repository first, with its stories, tests, checks and release by its documented recipe; then bump the app to the published version. No consumer-side style overrides or vendored primitives. When another unit releases at the same time, fetch and rebase before releasing, and take the next version if the planned one is taken.
7. **Build.** Implement the behavior completely, with tests and coverage under the project's policy; verify red and green by disabling the change once.
8. **Evidence.** Capture before screenshots from the target branch (at most one baseline worktree, removed once the before images exist) and after screenshots from the build, for each affected state, at the [visual QA](visual-qa.md) widths and both themes, from the real app with seeded data. Apply the whole-frame checklist and `audit-screen.ts` to every image and act on what they find. Save evidence under `<local>/shots/impl-<ticket>/`.
9. **Verify.** Run the project's scoped verification and record the task count, result and duration. Treat a failure outside the change under [Flaky tests](#flaky-tests).
10. **Land.** Commit with conventional messages, rebase onto the fetched target branch, rerun the checks the rebase affects, and integrate by the project's policy (direct push or pull request). On a rejected push, rebase and retry; never force-push.
11. **Comment.** On the ticket: the landed revision, what changed, checks with results and durations, the before and after images attached, any library release, the decisions made, and "Deploy pending: the orchestrator deploys this wave." Units do not deploy or close tickets.
12. **Clean up.** Remove the worktree and branch, delete build output, and stop every server and browser session the unit started. Keep the screenshots.
13. **If blocked.** Record the blocker and its exact unblock condition on the ticket. Land a finished part only if it stands on its own; otherwise keep the worktree and report its path. Continue with the unit's next ticket.
14. **Return** `{ tickets: [{ ticket, status: landed|blocked|skipped, revision, library, screenshots: [{ path, before|after, width, theme, state }], filed: [ticket], notes }], environmentIssues }`. A landed UI change without its before and after pairs is not done.

## Waves: deploy, verify, close

The orchestrator owns deployment and closing:

1. Review each returned unit: open its screenshots and apply the [whole-frame checklist](visual-qa.md#whole-frame-checklist) to every frame, not only the ticket's states, and check the comment and checks against the ticket's acceptance criteria. Send defects back to a unit or file them.
2. When the project's policy requires or authorizes deployment, deploy the landed tickets of a wave together through the project's deployment workflow.
3. Verify in production: the changed states of each ticket, plus `audit-screen.ts` on the main screens at each width and theme. A regression blocks closing its ticket and becomes a ticket of its own or a fix in the next wave.
4. Close each verified ticket through `issue-tracker` with the deployed revision.
5. Run the [fresh-eyes chrome review](visual-qa.md#fresh-eyes-chrome-review) and file what it finds before starting the next wave's units, so they include those tickets.

## Resume

On restart, before claiming anything new, read each `impl-*` checkpoint and its ticket:

- Its revision is on the target branch: continue from `commented`, `cleaned` or the wave step it reached; never land it again.
- Its worktree exists: inspect its status, branch and log against the remote, and continue from the first stage not recorded. Never recreate or reset a worktree that holds work.
- Its worktree is gone and nothing landed: restart the unit from `claimed`.
- A ticket claimed with no checkpoint and no comment from this run is not owned; resolve it under `issue-tracker` before touching it.

## Flaky tests

A test that fails under load and passes alone may be a real race in the product: focus moving before a list renders, events handled out of order, state read before an update lands. Before calling it flaky, rerun it alone; if it passes, reproduce it under the failing conditions (concurrent load, repeated runs, a throttled CPU) and read the code path for ordering assumptions. Fix a product race as a defect (filed, or in the unit when its change is involved); fix a timing assumption confined to the test in the test. Never retry until green or skip it, and record the outcome on the ticket either way.
