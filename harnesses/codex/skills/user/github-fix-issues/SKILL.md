---
name: github-fix-issues
description: >-
  Run a gated Codex multi-agent pipeline for a GitHub tracking issue or a queue of
  bug/feature issues, including github-issue-pipeline requests.
author: alexgorbatchev
metadata:
  created_on: 2026-09-29 15:09
  last_modified: 2026-10-02 21:58
  status: current
---

You are the coordinator. You own the queue, worktrees, briefs, gates, reviewer spawning, merges, and the push/close handshake. Delegate ALL code and doc edits in issue worktrees to worker subagents.

Filing issues and single ad-hoc reviews are outside this pipeline's scope.

## Roles and Models

| Role | Default model | Edits | Output |
|---|---|---|---|
| Coordinator (you) | session model | run dir and integration Git operations | status to user |
| Checklist extractor | inherited session model | `<RUN_DIR>/checklist-<N>.md` only | checklist |
| Worker | inherited session model | its issue worktree | `READY FOR REVIEW` + evidence file |
| Reviewer | inherited session model | nothing | checklist marks + findings or `NO DEFECTS FOUND` |

Use the collaboration tools exposed by the active Codex session; check their schemas before calling them. If delegation is unavailable, stop and report the missing capability rather than doing the workers' edits yourself.

- Create new agents with `spawn_agent`, using unique task names. Include absolute worktree and brief paths in each assignment, including follow-ups; instruct the agent to run every command in its assigned worktree. Agents share the filesystem; spawning one does not create a worktree or change its working directory.
- Omit model and reasoning overrides by default. Honor explicit user choices only when the tool exposes and supports them. For an override, use `fork_turns: "none"` or a supported positive turn count; full-history forks inherit the parent settings. Do not substitute another model if the requested one is unavailable.
- Send messages to running agents with `send_message`. For an idle worker or reviewer, use `followup_task` to start its next assignment. Use `wait_agent` for results and `list_agents` for status. These collaboration calls are direct tool calls, never calls inside `functions.exec`.
- Reviewers may be reused across review rounds, issues, and the final integration review. Before reuse, check `list_agents` and the recorded assignments: the agent must be idle and must not have written any code it will review. Do not assign a second review to a running agent or resume one stopped by the user without permission to continue. Spawn a new reviewer when no eligible idle reviewer is available.
- Record agent identifiers, assigned worktrees, issue numbers, review rounds, and reviewed SHAs in the run directory. A returned report does not establish that the agent has exited; inspect its status before takeover or worktree removal.

Reference: [Codex subagents](https://developers.openai.com/codex/subagents). The active tool schemas determine availability and parameters.

## 1. Discovery (once per run)

1. Resolve the following and record each value verbatim, with the file it came from:
   - the default branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`;
   - the commands for targeted tests, the full suite, lint/typecheck, coverage, snapshot refresh, bootstrap, and the final gate (from applicable `AGENTS.md` and other checked-in project instruction files, then `justfile`/`Makefile`/`package.json`/build files);
   - the project rules;
   - the commit convention (from `git log --oneline -30`, overridden by instruction files);
   - the formatter per file extension;
   - paired generated-artifact rules, for example snapshot `.golden` with `.ansi`;
   - generated and snapshot paths, for the reviewer's diff excludes.
   If a category has no documented command, record it as `none documented`. Do not invent one. If the final gate is undocumented, stop for clarification; do not pass `none documented` as a shell command or use `--skip-check` to advance the pipeline.
2. Create the run directory `<RUN_DIR>`. Use the harness scratchpad if one is listed. Otherwise use `.tmp/issue-pipeline/` in the repo, and confirm first that it is git-ignored.
3. Fill in the templates and save the results into `<RUN_DIR>`:
   - [references/worker-brief.md](references/worker-brief.md) as `worker-brief.md`
   - [references/reviewer-brief.md](references/reviewer-brief.md) as `reviewer-brief.md`

   Leave no `<SLOT>` unfilled. When a rule or command changes mid-run, edit these files, not individual prompts.
4. Choose the workspaces dir (the repo's documented location, else `.workspaces/`). Create the integration worktree `<WORKSPACES_DIR>/issues-dev` on branch `issues-dev` from fresh `origin/<default-branch>`. Use the repo's worktree helper if it documents one. If reusing an existing `issues-dev`, verify it contains no merge commits beyond the default branch; stop and report if it does.

## 2. Queue

- **Tracking issue:** use the child issues in the order the tracking issue (and its spec's implementation order) gives. Include every open child, whatever its label.
- **No tracking issue:** use the open issues labeled `bug` or `feature`, ordered: foundational/data/core first, then services, then UI, then tooling.
- **Running in parallel:** run at most 3 issues at once, only when they touch disjoint files and session capacity permits. Count the coordinator and all live extractors, workers, and reviewers against the session limit. Reserve a slot for extraction or review; serialize issues when necessary. An issue whose dependency is still unmerged waits.
- **Baseline repair is included:** invoking this pipeline authorizes repairing pre-existing failures required to pass the discovered final gate. Run that gate on the unchanged integration branch before starting issue workers. If it fails, hold the issue queue and execute the baseline repair loop below without asking for additional scope approval.

### Baseline repair loop

1. Reproduce the failure and save the integration SHA, exact command, exit code, and failure output in `<RUN_DIR>/baseline-failure.md`. Report the failure and the repair task as a progress update; continue working.
2. Create a separate worker worktree `<WORKSPACES_DIR>/baseline-<K>` on branch `fix/baseline-<K>` from the current `issues-dev` tip, using a new K for each repair task. Keep issue workers waiting until the integration gate passes.
3. Save a checklist of the reproduced failures and required passing checks as `<RUN_DIR>/checklist-baseline-<K>.md`. Copy the discovered worker brief to `<RUN_DIR>/worker-brief-baseline-<K>.md`; replace the GitHub issue contract and issue-reference commit requirement with that checklist and the recorded failure evidence, and set the assigned worktree and branch to the baseline task. Give the reviewer the same checklist as C. Use `baseline-<K>` as N in task identifiers and evidence filenames; do not run GitHub issue commands for this task.
4. Delegate the repair to a worker and apply the per-issue loop's steps 3–9, substituting the baseline worktree and `fix/baseline-<K>` branch for the issue paths and branch. Require the gate, independent review, red/green verification, interruption handling, and fast-forward integration; save the final report as baseline evidence rather than an issue closure comment. Limit edits to the reproduced failures and their required tests, generated artifacts, and documentation. Do not disable checks, weaken assertions, or lower coverage thresholds to obtain a passing baseline.
5. Run the final gate on the resulting `issues-dev` tip. If it fails, record the remaining failure and repeat this loop. Start the issue queue automatically only after the integration gate exits 0. Keep the repair SHAs and verification evidence in the run report.

If repair requires unavailable credentials, an unavailable external service, or a user decision that cannot be resolved from repository instructions, report the exact blocker and required input. Do not claim the baseline passes or start issue workers while the gate fails. Unrelated enhancements remain outside baseline repair scope; the finish phase's push and issue-edit approval rules still apply.

## 3. Per-Issue Loop

For each issue N:

1. **Provision.** Fetch the default branch before creating the integration worktree. Once issue commits exist on `issues-dev`, keep its base stable while issue workers are active; do not merge the advancing default branch into it. New issue worktrees branch from the current `issues-dev` tip.
   ```bash
   git worktree add <WORKSPACES_DIR>/issue-<N> -b fix/issue-<N> issues-dev
   ```
2. **Checklist.** If a spec governs N, run the extractor with [references/checklist-brief.md](references/checklist-brief.md). Read the `Questions` section of the result. Ask the user about any question that changes what gets built, before the worker starts.
3. **Worker.** Spawn it with a short prompt that gives only:
   - N, the worktree, and the brief path;
   - the checklist and findings paths;
   - the concurrent issues and their areas, which it must avoid;
   - issue-specific notes: user decisions, and known debt from earlier issues.

   Do not paste the brief's contents into the prompt.
4. **Gate** when the worker reports `READY FOR REVIEW`. Run this skill's `scripts/review-gate.ts` by its absolute path under the skill base directory:
   ```bash
   bun <SKILL_DIR>/scripts/review-gate.ts --worktree <W> --base issues-dev --check "<FINAL_GATE_CMD>" \
     --fmt ".go=gofmt -l" --pair "testdata/*.golden=testdata-ansi/*.ansi" --solo-ok ".ansi" \
     --evidence <W>/.tmp/review-evidence.md
   ```
   Pass one `--fmt` per formatter and one `--pair` per pairing rule found in discovery. Omit either flag when the repo has none. Pass `--solo-ok <ext>` only for a side whose partner the final gate compares on every run (for example, when tests always compare `.golden`, an `.ansi`-only color change is safe). Read the test helpers to confirm which side is compared; do not guess. If the gate exits 1, send its output to the worker as the next round's findings, and do not spawn a reviewer. Also treat a missing evidence file as a gate failure.

   Treat every nonzero exit, including usage errors, as failure. Never use `--skip-check` for review readiness. This bundled gate supports pair rules whose directory names are single path components; validate other pairing rules separately with repository tooling. Inspect deleted and renamed artifact paths separately because the gate excludes deletions. For any one-sided pair, verify the actual no-diff evidence yourself: the script checks only whether the evidence file names the path. Capture HEAD before and after the gate; if it moved or the gate left tracked changes, rerun on the resulting clean HEAD before review. Save the passing SHA with the review round.
5. **Review.** Reuse an eligible idle reviewer with `followup_task`, or spawn a new one. Every assignment must give it N, W, the current reviewer brief path, C (the checklist path or `none`), E (the evidence path), H (the passing gate's HEAD SHA), and the review mode. Require a new report for this assignment; previous findings and approvals do not replace reviewing H:
   - Round 1 is FULL.
   - Later rounds are DELTA: S is the SHA the previous review covered, and P is the previous findings file.
   - Run another FULL review after every 3 DELTA rounds, and whenever a rebase changed code outside the previous delta.
6. **Findings.** Save the reviewer's findings verbatim to `<RUN_DIR>/review-<N>-round<K>.md` and send the path to the worker. Use `send_message` for a running worker or `followup_task` for an idle one; otherwise spawn a new one with takeover instructions (step 8). Repeat from step 4.
7. **Clean.** On `NO DEFECTS FOUND`, tell the worker to do brief step E: the red/green handshake, the final gate, and the post-commit steps. Keep its final report for the issue closure comment.
8. **Interrupted worker** (stopped, rate limited, or killed):
   - Confirm the former worker is no longer running before assigning the worktree to another agent.
   - Inspect the worktree with `git status --short` and `git log issues-dev..HEAD`.
   - Spawn a new worker. Tell it that the existing commits and changes are unverified and must be checked against the checklist, and name any commits it must drop.
   - A worker that was stopped by the user must not be resumed. Spawn a new worker only if the user said to continue.
9. **Integrate.** Verify the worker's branch is based on the current `issues-dev` tip, then fast-forward it:
   ```bash
   git -C <WORKSPACES_DIR>/issues-dev merge --ff-only fix/issue-<N>
   ```
   - If `--ff-only` refuses because another issue advanced `issues-dev`, tell the worker to rebase onto its current tip. Rerun the gate and review the rebased commit before retrying. Use a FULL review when the rebase changed code outside the previously reviewed delta. Never substitute a merge commit for a failed fast-forward.
   - After a successful merge, confirm no agent is still operating in that worktree, then run `git worktree remove` and `git branch -d`. Tell the other active workers that `issues-dev` moved.

## 4. Finish

1. Once every queued issue is integrated and its worktree is removed, fetch `origin/<default-branch>`. If the default branch advanced, rebase `issues-dev` onto it while no issue worker is active. If the rebase conflicts, delegate resolution to a worker with exclusive access to the integration worktree. After any rebase, run the final gate and a FULL review of the resulting integration diff. Do not merge the default branch into `issues-dev`. Run the final gate on the final `issues-dev` tip; stop and report any failure.
2. From the primary checkout on `<default-branch>`, fast-forward to `origin`, then run `git merge --ff-only issues-dev`. If it refuses, fetch and repeat step 1 before retrying. Never fall back to a merge commit. Verify `git rev-list --min-parents=2 origin/<default-branch>..<default-branch>` is empty before asking to push.
3. Show `git log --oneline origin/<default-branch>..<default-branch>` and ask the user for approval to push. If they decline, leave every issue open and report the unpushed commits.
4. After the push, check each issue with `gh issue view <N> --json state`. Comment on it if a `fixes #N` reference already closed it; otherwise close it with a comment. The comment gives the root cause, the fix, and the verification exactly as the worker's final report states them. Tick the tracking issue's checklist items only if the user approves that edit.
5. Remove `issues-dev` (both the worktree and the branch). Report remaining actionable issues. Start another queue only when it is covered by the user's requested scope.

## Prohibited

- Editing implementation, test, or doc files in any issue worktree yourself, including to resolve merge conflicts.
- Starting a review, whether with a new or reused reviewer, before the gate passes, or accepting a worker's claim of "`just check` passed" instead of the gate's own run.
- Merging an issue without a `NO DEFECTS FOUND` from a reviewer that did not write the code.
- Telling a reviewer to skip the checklist, the spot-checked red/green, or the snapshot-list check to save tokens.
- Pushing, closing issues, or editing issue bodies without the user's explicit approval in this run.
- Running bare `git stash`/`git stash pop` in any worktree.
- Treating a subagent's report as user approval.
- Pasting full subagent transcripts into your own context. Read only the final reports.
