---
name: github-fix-issues
description: >-
  Run a gated Codex multi-agent pipeline for a GitHub tracking issue or a queue of
  bug/feature issues, including github-issue-pipeline requests. Excludes filing
  issues and single ad-hoc reviews.
author: alexgorbatchev
metadata:
  created_on: 2026-09-29 15:09
  last_modified: 2026-09-29 15:09
  status: current
---

You are the coordinator. You own the queue, worktrees, briefs, gates, reviewer spawning, merges, and the push/close handshake. Delegate ALL code and doc edits in issue worktrees to worker subagents.

## Roles and Models

| Role | Default model | Edits | Output |
|---|---|---|---|
| Coordinator (you) | session model | run dir, integration merges only | status to user |
| Checklist extractor | inherited session model | `<RUN_DIR>/checklist-<N>.md` only | checklist |
| Worker | inherited session model | its issue worktree | `READY FOR REVIEW` + evidence file |
| Reviewer | inherited session model | nothing | checklist marks + findings or `NO DEFECTS FOUND` |

Use the collaboration tools exposed by the active Codex session; check their schemas before calling them. If delegation is unavailable, stop and report the missing capability rather than doing the workers' edits yourself.

- Create agents with `spawn_agent`, using unique task names for each issue, role, and review round. Include absolute worktree and brief paths in each task; instruct the agent to run every command in its assigned worktree. Agents share the filesystem; spawning one does not create a worktree or change its working directory.
- Omit model and reasoning overrides by default. Honor explicit user choices only when the tool exposes and supports them. For an override, use `fork_turns: "none"` or a supported positive turn count; full-history forks inherit the parent settings. Do not substitute another model if the requested one is unavailable.
- Send messages to running agents with `send_message`. For an idle worker, use `followup_task` to start its next round. Use `wait_agent` for results and `list_agents` for status. These collaboration calls are direct tool calls, never calls inside `functions.exec`.
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
4. Choose the workspaces dir (the repo's documented location, else `.workspaces/`). Create the integration worktree `<WORKSPACES_DIR>/issues-dev` on branch `issues-dev` from fresh `origin/<default-branch>`. Use the repo's worktree helper if it documents one.

## 2. Queue

- **Tracking issue:** use the child issues in the order the tracking issue (and its spec's implementation order) gives. Include every open child, whatever its label.
- **No tracking issue:** use the open issues labeled `bug` or `feature`, ordered: foundational/data/core first, then services, then UI, then tooling.
- **Running in parallel:** run at most 3 issues at once, only when they touch disjoint files and session capacity permits. Count the coordinator and all live extractors, workers, and reviewers against the session limit. Reserve a slot for extraction or review; serialize issues when necessary. An issue whose dependency is still unmerged waits.
- **Pre-existing failures:** run the final gate on the unchanged integration branch before starting workers. If it fails, stop the issue queue, reproduce the failure, and report the evidence. Repair it through a separate worker worktree only when the user authorizes that additional scope.

## 3. Per-Issue Loop

For each issue N:

1. **Sync and provision.**
   ```bash
   git -C <WORKSPACES_DIR>/issues-dev fetch origin <default-branch>
   git -C <WORKSPACES_DIR>/issues-dev merge origin/<default-branch>
   git worktree add <WORKSPACES_DIR>/issue-<N> -b fix/issue-<N> issues-dev
   ```
   Never rebase `issues-dev`.
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
5. **Review.** Spawn a fresh reviewer for every round. Give it N, W, C (the checklist path or `none`), E (the evidence path) and the review mode:
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
9. **Merge.**
   ```bash
   git -C <WORKSPACES_DIR>/issues-dev merge --no-ff fix/issue-<N> -m "merge: fix/issue-<N> into issues-dev"
   ```
   - If the merge conflicts, run `git merge --abort`. Tell the worker to rebase onto `issues-dev`, then run the gate and one DELTA review again. Never resolve conflicts yourself.
   - After a successful merge, confirm no agent is still operating in that worktree, then run `git worktree remove` and `git branch -d`. Tell the other active workers that `issues-dev` moved.

## 4. Finish

1. Once every queued issue is merged, sync `issues-dev` with `origin/<default-branch>` and run the final gate there. If it fails, stop and report.
2. From the primary checkout on `<default-branch>`, fast-forward to `origin`. Then run `git merge --ff-only issues-dev`, falling back to `--no-ff` with `merge: integrate issues-dev into <default-branch>`.
3. Show `git log --oneline origin/<default-branch>..<default-branch>` and ask the user for approval to push. If they decline, leave every issue open and report the unpushed commits.
4. After the push, check each issue with `gh issue view <N> --json state`. Comment on it if a `fixes #N` reference already closed it; otherwise close it with a comment. The comment gives the root cause, the fix, and the verification exactly as the worker's final report states them. Tick the tracking issue's checklist items only if the user approves that edit.
5. Remove `issues-dev` (both the worktree and the branch). Report remaining actionable issues. Start another queue only when it is covered by the user's requested scope.

## Prohibited

- Editing implementation, test, or doc files in any issue worktree yourself, including to resolve merge conflicts.
- Spawning a reviewer before the gate passes, or accepting a worker's claim of "`just check` passed" instead of the gate's own run.
- Merging an issue without a `NO DEFECTS FOUND` from a reviewer that did not write the code.
- Telling a reviewer to skip the checklist, the spot-checked red/green, or the snapshot-list check to save tokens.
- Pushing, closing issues, or editing issue bodies without the user's explicit approval in this run.
- Running bare `git stash`/`git stash pop` in any worktree.
- Treating a subagent's report as user approval.
- Pasting full subagent transcripts into your own context. Read only the final reports.
