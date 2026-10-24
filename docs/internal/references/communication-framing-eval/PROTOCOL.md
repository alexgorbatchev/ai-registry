---
created_on: "2026-10-16 14:29"
last_modified: "2026-10-16 14:40"
status: current
author: "GPT-6 (exact snapshot unavailable)"
source_url: "https://github.com/ayghri/i-have-adhd"
---

# Communication framing evaluation

This corpus compares an ADHD style cue with a neutral reader style cue while keeping operational rules identical. It is a small exploratory experiment for prompt authors, not a clinical assessment or proof of a general model effect.

## Frozen design

See `suite.json` for the cases, exact v1 rules, split, and metadata; `rubric.json` defines observable acceptance checks. Cases are synthetic and self-contained. Their fictional commands are supplied contracts, not claims about external software. Generation does not execute them.

Use two repetitions per arm. Complete development generation and blind grading before revising the shared rules once. Apply the same revision to both arms. Freeze v2 before running holdout cases. Do not tune against holdout results. Count each applicable criterion separately; continuity is evaluated only on scripted conversation histories. Report failures rather than a subjective prompt-quality score.

## Rerun on another model

1. Choose a new run identifier. Preserve existing runs. Record provider, exact model ID/snapshot when exposed, reasoning effort, temperature, seed, limits, date, runtime, and inherited instructions. Use null plus an explanation for unavailable fields.
2. Load `suite.json`. For each version, arm, repetition, and case, put that arm's framing plus the version's shared rules in the system instruction and send the case's messages in order. Prefer one fresh conversation per case. Keep model settings identical across arms. Alternate or randomize arm order and retain the schedule.
3. Store the exact sent messages and unedited assistant response, finish reason, usage when exposed, any tool activity, and errors. The preserved `replay/` files contain provider-neutral message arrays for replay; they need only the selected provider's native transport. The `jobs/` files preserve the pilot's batch assignments. Do not assume a common HTTP API or invent unknown sampling settings.
4. Assign opaque response IDs and shuffle before judging. Give the judge only case messages, acceptance criteria, rubric, and response text. Keep arm/version mappings away from the judge. Use the same judge configuration across arms. Retain independent human review or another judge when available.
5. Save judgments and decode only after grading. Report per-criterion pass counts, paired disagreements, overall all-applicable-criteria passes, and output lengths. Separate development from holdout. Never treat multiple answers from one batch worker as independent statistical samples.

For an agent-orchestrated replay, start fresh agents without parent conversation history. Give each agent one selected prompt and its case messages, never opposing prompts, expected answers, experiment conclusions, or grading records. Ask for the answer only. If batching is necessary, record that case contexts share one session and report the resulting limitation. An API replay with actual system-message placement is a different runtime from a subagent task instruction; record that distinction rather than pooling them silently.

## Current runtime limits

The collaboration runtime exposes fresh-agent task instructions and parent-history exclusion, but not a raw system-prompt replacement or exact model/sampling metadata. Existing platform instructions may already favor concise, action-oriented output. Batching and the shared model family limit independence and may cause ceiling effects. Scripted histories test reconstruction of state, not long-session attention. A blinded same-family judge is not independent human validation. No clinical claim follows from any result.

## Preservation

This folder is a repository-ready experiment artifact in the owned `experiment/communication-framing` worktree. It is not generated registry output. Prompt versions, cases, replay jobs, responses, judgment inputs/outputs, and the report are intended to be retained. No credentials or real project data belong here. This experiment does not change the installed system prompt.

