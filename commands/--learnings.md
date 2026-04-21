---
description: Extract durable learnings from the just-finished task and offer concrete documentation follow-ups
---

Review the current conversation only and identify whether this task produced any real learnings that should have been documented before the task started.

Use a high bar. A learning only counts if all of the following are true:

- It had to be discovered during the task rather than already being obvious at the start.
- If it had been documented up front, the task would likely have been materially easier, faster, smoother, or required fewer steps.
- It is specific enough to document clearly.
- It is durable enough to help with future work, not just this one-off case.

## Bail Out First

If there are no learnings that meet that bar, do not stretch, speculate, or produce filler.

Respond with exactly two sections:

### Outcome
- No meaningful learnings worth documenting were discovered from this task.

### Why
- Briefly explain why the task did not uncover anything durable or documentation-worthy.

Then stop.

## If Learnings Exist

If one or more learnings meet the bar, present only the useful ones.

For each learning, use this structure:

### Learning <n>
- What was learned: <specific insight>
- Why it mattered: <how it slowed or complicated the task>
- Would have helped if documented in advance because: <specific benefit>
- Best documentation target: <specific existing file if the conversation clearly points to one, otherwise propose a specific new file>
- Draft update: <2-6 bullet points describing the exact content that should be added>

Rules:

- Base this only on the current conversation and task context.
- Do not inspect the repository or invent file targets you cannot justify from the conversation.
- Prefer updating existing documentation when the conversation clearly indicates a fitting home.
- Propose a new document only when no clear existing home is evident.
- Keep the draft updates concrete and implementation-ready, not vague suggestions.
- Do not suggest documentation work for things that are already common knowledge or easy to rediscover.

## End With An Offer

After listing the learnings, end with a short `### Next Step` section that:

- offers to update the existing documentation and/or create the new document(s),
- names the specific file targets again,
- and explicitly offers a no-op path if the user does not want to document them now.

Use concise wording.
