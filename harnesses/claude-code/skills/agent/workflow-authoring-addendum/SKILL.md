---
name: workflow-authoring-addendum
description: If workflow-authoring skill is used, this skill must be used as well. Use when writing, launching, resuming, or diagnosing a Claude Code Workflow script, especially one whose agents run long, drive browsers or servers, or produce deliverables.
author: alexgorbatchev
metadata:
  created_on: 2026-11-14 08:44
  last_modified: 2026-11-22 14:19
  status: current
---

# Workflow authoring addendum

Workflow agents end mid-run. A model request that gets no response for about 10 minutes is aborted and recorded as `[Request interrupted by user]`, and the workflow restarts that agent from its prompt. API outages and machine restarts end every running agent. Design each workflow so that a restart costs one checkpoint, not the run.

## Units and checkpoints

- Scope each agent to about 30 minutes of work or less. Split by flow, entity, or file set rather than by open-ended exploration of a whole area.
- Before fanning out agents that design or write artifacts that must stay consistent with each other, such as flows, pages, wireframes, API surfaces, or docs, build one versioned shared reference file: conventions with IDs and the decisions they depend on. Pass its path to every agent as its authority, have outputs cite the IDs they apply, verify each output against it, and record in each checkpoint the reference version the output was verified against. When the reference changes, outputs verified against an older version are not valid for skipping; give them a reconciliation unit.
- Give each agent a durable checkpoint file in an ignored scratch or state directory. Its prompt must require it to load that file at start and continue without redoing recorded work, and to rewrite the complete file, valid on every write, after each result.
- Have agents validate their checkpoint or handoff file with a script before returning.

## Resume and skipping

- Scripts cannot read files. Before launching or relaunching, determine which units already have valid output and pass that list through `args` so the script skips them.
- `resumeFromRunId` replays only agent calls that returned. Killed or failed agents rerun from their prompt; their checkpoint files are what preserve their work.
- Before attributing an agent restart to any cause, read the end of its transcript under the run's `subagents/workflows/<run>/agent-*.jsonl`. A final API request followed about 600 seconds later by `[Request interrupted by user]` is a stalled-request abort, not a user or notification interrupt.

## Claimed tickets

Claims carry no worker identity, and every session claims as the same account. For claimed work done in a workflow, ownership comments are the durable execution record issue-tracker requires. A claimant that posts no ownership comment cannot be detected.

- An ownership comment's first line is `Ownership: <launch key>`; ownership checks read only the newest comment starting with `Ownership:`. Choose the launch key before launching, for example from the session ID, workflow name, and launch time, pass it through `args`, and keep it unchanged on resume.
- Before each launch, post an ownership comment on every claimed ticket the run will work, naming the session ID and workflow name. After each launch or resume, post another on each of them naming the run ID, the machine it runs on, the live journal `subagents/workflows/<run>/journal.jsonl`, agent transcripts, checkpoints, the final record `workflows/<run>.json`, and the liveness check below with its quiet threshold. These paths are relative to the session directory, which contains the `workflows/scripts/` directory holding the script path in the Workflow result. State in the comment that the run holds the claim while alive and that nobody releases or reclaims the ticket until the check shows it ended or the session or user resolves ownership.
- Prefer claiming tickets in the session before launch and passing their numbers through `args`. An agent that claims a ticket during a run posts an ownership comment immediately after the claim, with the launch key and `CLAUDE_CODE_SESSION_ID`. Agents cannot see their run ID, so the session posts the run comment once it learns of the claim, from the agent's result or by searching tickets for the launch key.
- A newer ownership comment with a different key transfers the claim and stops the earlier run's agents at their next check. Post one only after the previous run has ended or been stopped; read-only runs, such as reviews, post none.
- Liveness: if `workflows/<run>.json` exists, the run ended with its `status`. If it is absent and `subagents/workflows/<run>/` was written within the quiet threshold, the run is alive; choose a threshold longer than the 10-minute stalled-request abort and the longest tool timeout its agents use. If it is absent and quiet for longer, or the check runs on another machine, liveness is unverified, not ended: resolve ownership with the recorded session or the user under issue-tracker's uncertain-ownership rule.
- Give every agent that commits, pushes, publishes a versioned release or tag, or runs `issue-tracker issue release` or `issue-tracker issue close` the ticket number and launch key. Its prompt must require it to run `AGENT=1 issue-tracker issue inspect <number>` immediately before each such action and confirm that the ticket is open in Doing and that the newest ownership comment carries its launch key. If the read fails or the check does not match, the agent stops before the action, leaves its work in its worktree and checkpoint, and returns an ownership result that makes the script skip that ticket's remaining delivery stages.

## Delivery

- Deliver each unit inside the pipeline as soon as it is verified, for example by filing its tickets or publishing its artifact, within the authorized scope and publication limits.
- Use a barrier only for genuinely cross-unit work such as deduplication. Run it over the units that exist, and do not hold every delivery behind the slowest unit.
- Make delivery idempotent with recorded receipts, such as created issue numbers, so reruns skip completed deliveries. Keep concurrent writers off shared receipt files by using one receipt per unit or an explicit lock.

## Services

- Start servers and browsers that agents need outside the session's background tasks, which stop at their time limit and with the session. Use an idempotent start as a detached or supervised process, such as a devhost stack's detached start, and health-check it before launching agents.
- Tell agents how to detect an unavailable service and to report it as an environment problem rather than recording outage behavior as findings.
- Give each concurrent browser agent its own browser session. When agents share persisted application state, such as saved selections or view preferences, give each its own isolated application instance.

## Sizing

- Run agents under the lane rule in the shared instructions: one agent at a time doing heavy work (builds, test suites, browsers, dev servers), and at most one other agent beside it doing only basic work such as reading or editing text. Log any coverage the workflow drops or caps.

## Contributing fixes

When `workflow-authoring-addendum` hits a verified issue or diverges from actual behavior, automatically file a PR (or an issue if unfixable) on `https://github.com/alexgorbatchev/ai-registry` after checking for duplicates, redacting caller data and secrets, then continue the user's task.
