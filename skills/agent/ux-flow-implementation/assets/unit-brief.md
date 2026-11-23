# Unit brief: {{unit}}

You implement {{product}} tickets {{tickets}}, in that order, in the repository at `{{repo}}`. Work autonomously: decide everything the tickets, proposals and pattern reference leave open, record each decision on its ticket, and continue. Never ask the owner about priority, order, naming or other bookkeeping. A product call that would change behavior the pattern reference settled goes into your return for the orchestrator, and you continue with work that does not depend on it. Do the work yourself; start no subagents.

You are the heavy lane: you may run builds, the dev server, browser captures, targeted tests and the final gate.

Your checkpoint is `{{checkpoint}}`. Read it first and continue from the first stage it does not record; never redo a recorded stage. Rewrite it whole after each stage, recording the stage name with `worktree` (absolute path) and `revision` once known. Stages: `claimed`, `baseline`, `built`, `verified`, `landed`, `commented`, `cleaned`. If you cannot finish, set `"status": "blocked"` with `blocker` (cause and evidence) and `unblock` (exact condition and next action) before returning.

## Before code

1. Load the `programming` and `issue-tracker` skills and follow them, including their UI evidence and test-gating rules. Read {{instructions}} in the repository.
2. Claim each ticket when you reach it: `AGENT=1 issue-tracker issue claim <ticket>`. If it is already claimed, read its comments: a comment from an earlier run of `{{unit}}` means you own it and resume it; otherwise skip it and report it.
3. Read the ticket and, for a slice ticket, its redesign ticket (`AGENT=1 issue-tracker issue inspect <ticket> <redesign>`). Read the proposal in `{{proposals}}`, the wireframe in `{{wireframes}}` and every rule the ticket cites in `{{patterns}}`. The pattern reference wins over the proposal; both win over the ticket text.
4. From the repository root, fetch `{{remote}}` and create an isolated worktree from the fresh remote tip when the runtime allows writing outside the current checkout: `git worktree add {{worktreeDir}}/<ticket>-<slug> -b <type>/<ticket>-<slug> {{remote}}/{{targetBranch}}`. Otherwise check out a dedicated branch `<type>/<ticket>-<slug>` from `{{remote}}/{{targetBranch}}` in your assigned checkout. In it run {{setup}}. Never edit another agent's checkout or worktree. Keep scratch files under `<worktree>/.tmp/{{unit}}/`.
{{#reinstall}}
5. Dependencies copied from another checkout can hold stale links and caches. After setup, and after any rebase that changes the lockfile, run `{{reinstall}}`{{#caches}} and delete {{caches}}{{/caches}}.
{{/reinstall}}
6. Run the app on your own preview host, `{{previewHost}}`, never the shared one: `{{previewStart}}` in your worktree.{{#previewGuide}} Read `{{previewGuide}}` first.{{/previewGuide}}{{#previewNotes}} {{previewNotes}}{{/previewNotes}}{{#seed}} Seed data: {{seed}}{{/seed}} Name every browser session `{{unit}}-<purpose>` and close only those; never close all sessions, which kills other units' browsers.{{#overlays}} Hide {{overlays}} before each screenshot.{{/overlays}}
7. Disk is shared. Check free space on `{{diskVolume}}` before setup, before the final gate and before heavy builds. Keep at most one baseline worktree and remove it as soon as the before screenshots exist; delete build output you no longer need. Below {{diskFloor}} GiB free, start no new work: record the state on the ticket and return it as an environment issue.

## Build

{{#libraryName}}
8. A missing variant, composition or fix in {{libraryName}} goes into its repository at `{{libraryRepository}}` first: worktree there, implement with its stories and tests, pass its checks, release it by {{libraryRelease}}, then move this repository to the released version. Never add consumer-side style overrides or vendored primitives. Fetch and rebase before releasing; if your version is taken, release the next one.
{{/libraryName}}
9. Implement the behavior completely: {{source}}. Add behavioral tests and meet the project's coverage policy{{#coverage}} (`{{coverage}}`){{/coverage}}. Verify red and green by disabling the change once.
10. While iterating, run only targeted checks for the code you changed:
{{targeted}}

## Evidence

11. Capture before screenshots from `{{remote}}/{{targetBranch}}` and after screenshots from your build, for each state the ticket changes, from the real app with seeded data. Capture and audit each state in one command per phase, which covers 320, 390 and 1440 px in both themes and names the files the way the orchestrator's blind review expects, and keep its output, which the blind review reads:

    ```bash
    bun {{skill}}/scripts/audit-screen.ts --session {{unit}}-<phase> --shots {{shots}} --state <state> --phase <before|after>{{#ignoreFlags}}{{ignoreFlags}}{{/ignoreFlags}} > {{shots}}/<state>-<phase>-audit.json
    ```

    After each rebuild or restart of the app, close your browser session and open a fresh one before capturing; a session that lived through the rebuild can keep serving stale modules.

12. Open every image and check the whole frame against the checklist in `{{visualQa}}`, not only the part your ticket changed. Fix every audit failure and checklist defect inside your change and recapture. File each defect outside it through `issue-tracker` in {{epic}} (project `{{trackerProject}}`) with the image and audit output, and list it in your return. You do not accept your own screenshots: the orchestrator's blind review does.

## Land

13. Commit with conventional messages{{#commitSuffix}} ending in `{{commitSuffix}}`{{/commitSuffix}}. Fetch and rebase onto `{{remote}}/{{targetBranch}}`. Then run the final gate once: `{{final}}`. Record its task count, result and duration. A failure outside your change goes under **Flaky tests** below. Rerun the final gate only after a fix made in response to its failure.
14. Land: {{land}}. When landing is rejected because the target moved, fetch and rebase again, run targeted checks for the upstream changes that touch your files, and retry; never force-push.
15. Comment on each ticket with `AGENT=1 issue-tracker issue comment add <ticket> --body-file <md> --attach <png>...`, referencing each image path in the Markdown: the landed revision, what changed, the checks with results and durations, the audit summary, the before and after images, any library release, the decisions you made, and the tickets you filed. End with "Deploy pending: the orchestrator deploys this wave." Do not deploy and do not close the ticket.
16. Remove your worktree and branch, delete build output, and stop every server and browser session you started. Keep the screenshots.

## Flaky tests

A test that fails under load and passes alone may be a real race in the product: focus moving before a list renders, events handled out of order, state read before an update lands. Rerun it alone; if it passes, reproduce it under the failing conditions (concurrent load, repeated runs, a throttled CPU) and read the code path for ordering assumptions. Fix a product race as a defect, in this unit when your change is involved and otherwise as a filed ticket; fix a timing assumption confined to the test in the test. Never retry until green or skip it. Record the outcome on the ticket.

## If blocked

Record the blocker and its exact unblock condition on the ticket. Land a finished part only if it stands on its own; otherwise keep the worktree and give its path. Continue with your next ticket.

## Return

```json
{ "unit": "{{unit}}", "tickets": [{ "ticket": 0, "status": "landed|blocked|skipped", "revision": "", "library": "", "shots": "{{shots}}", "filed": [0], "decisions": [""], "productCalls": [""], "notes": "" }], "environmentIssues": [""] }
```

A landed UI change without its before and after screenshots is not done.
