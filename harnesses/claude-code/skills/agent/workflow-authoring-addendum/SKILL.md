---
name: workflow-authoring-addendum
description: If workflow-authoring skill is used, this skill must be used as well. Use when writing, launching, resuming, or diagnosing a Claude Code Workflow script, especially one whose agents run long, drive browsers or servers, or produce deliverables.
author: alexgorbatchev
metadata:
  created_on: 2026-11-14 08:44
  last_modified: 2026-11-15 08:27
  status: current
---

# Workflow authoring addendum

Workflow agents end mid-run. A model request that gets no response for about 10 minutes is aborted and recorded as `[Request interrupted by user]`, and the workflow restarts that agent from its prompt. API outages and machine restarts end every running agent. Design each workflow so that a restart costs one checkpoint, not the run.

## Units and checkpoints

- Scope each agent to about 30 minutes of work or less. Split by flow, entity, or file set rather than by open-ended exploration of a whole area.
- Before fanning out agents that design or write artifacts that must stay consistent with each other, such as flows, pages, wireframes, API surfaces, or docs, build one shared reference: conventions with IDs and the decisions they need. Give every agent that reference as its authority, verify each output against it, and reconcile existing outputs whenever it changes. Parallel agents without one produce divergent designs that need rework.
- Give each agent a durable checkpoint file in an ignored scratch or state directory. Its prompt must require it to load that file at start and continue without redoing recorded work, and to rewrite the complete file, valid on every write, after each result.
- Have agents validate their checkpoint or handoff file with a script before returning.

## Resume and skipping

- Scripts cannot read files. Before launching or relaunching, determine which units already have valid output and pass that list through `args` so the script skips them.
- `resumeFromRunId` replays only agent calls that returned. Killed or failed agents rerun from their prompt; their checkpoint files are what preserve their work.
- Before attributing an agent restart to any cause, read the end of its transcript under the run's `subagents/workflows/<run>/agent-*.jsonl`. A final API request followed about 600 seconds later by `[Request interrupted by user]` is a stalled-request abort, not a user or notification interrupt.

## Claimed tickets

issue-tracker claims record no worker identity, and every session claims as the same account, so a claim cannot show which session or run holds a ticket. The run comment is that record.

- When a session hands claimed work to a background workflow, pass a launch key through `args`, such as the session ID, workflow name, and launch time, and keep it unchanged on resume. Give the ticket number and launch key to every agent that commits, pushes, publishes a release, or releases the claim.
- After each launch or resume, comment on the ticket with the run ID, workflow name, launch key, the paths of the run's journal, agent transcripts, and checkpoints, and how to tell whether the run is alive. The script path in the Workflow result lies under the session directory's `workflows/scripts/`. When the run ends, `workflows/<run>.json` appears in that session directory with a `status` saying how; until then, recent writes to `subagents/workflows/<run>/` show it running.
- Before treating a claimed ticket as abandoned, read its newest run comment and apply its liveness check. A running workflow keeps the claim.
- Immediately before each commit, push, release publication, or claim release, an agent working a claimed ticket confirms that the ticket is still open in Doing and that its newest claim or run comment carries the agent's launch key. Otherwise it stops before that action, leaves its work in its worktree and checkpoint for review, and reports the mismatch.

## Delivery

- Deliver each unit inside the pipeline as soon as it is verified, for example by filing its tickets or publishing its artifact, within the authorized scope and publication limits.
- Use a barrier only for genuinely cross-unit work such as deduplication. Run it over the units that exist, and do not hold every delivery behind the slowest unit.
- Make delivery idempotent with recorded receipts, such as created issue numbers, so reruns skip completed deliveries. Keep concurrent writers off shared receipt files by using one receipt per unit or an explicit lock.

## Services

- Start servers and browsers that agents need outside the session's background tasks, which stop at their time limit and with the session. Use an idempotent start as a detached or supervised process, such as a devhost stack's detached start, and health-check it before launching agents.
- Tell agents how to detect an unavailable service and to report it as an environment problem rather than recording outage behavior as findings.
- Give each concurrent browser agent its own browser session. When agents share persisted application state, such as saved selections or view preferences, give each its own isolated application instance.

## Sizing

- Keep concurrent heavy agents moderate, about 8 to 12. Log any coverage the workflow drops or caps.
