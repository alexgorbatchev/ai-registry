# Ranked removals from Operating Instructions

The clean-path comparison found F16 claiming “Ownership released” in a receipt handoff and promising work that had only been authorized. This study uses the complete pinned F16 prompt and removes its eight Operating Instructions paragraphs in a fixed order. The [prompt builder](prompts.py) matches each paragraph by its opening words. Each round compares the preceding cut with the same text minus one paragraph. The section heading stays in both arms, even after the last deletion.

| Rank | Paragraph removed | Reason for its position |
| ---: | --- | --- |
| 1 | Stopping, next action, relinquishing ownership | Direct match to “Ownership released” and redundant statements about remaining work. |
| 2 | Durable records of scope, evidence, remaining work and ownership | Names the bookkeeping fields Opus put in a user-facing handoff. |
| 3 | Claiming and continuing queued work | A receipt-only handoff discussed a second, independent job. |
| 4 | Completing work through validation, integration and cleanup | Could turn a factual update into a claim of having done the work. |
| 5 | Resuming interrupted work and reporting completed units | Could encourage continuing or promising work beyond a requested update. |
| 6 | Proportional investigation, checks and tradeoffs | Could invite explanations of investigation scope in a short incident finding. |
| 7 | Loading the programming skill and tracking edits | The requests mention fixes and tests but ask for replies only. |
| 8 | Copying worktree dependencies and caches | None of the six operational requests involves setting up a worktree. |

## Comparison and confirmation

Run the [operational requests](triggers.json) in this order. Each arm gets two new generations per request from Opus 5.5 via cl-envoy and Astra 6.2 via Codex, at medium effort. Start the next cut after the preceding cut has been blindly graded. Preserve the [ancestor checks](clean-path.md) for every generation and review. Apply the existing [sarcasm-accepting rubric](mode-rubric.json). A joint pass requires completeness, concision and addressability. Also inspect receipt handoffs, incident findings, correctly numbered items and mean reply length.

Among partial cuts (ranks 1 through 7), select the highest candidate Opus joint score on the operational suite. Break ties in favor of fewer removals. Retest that exact candidate against intact F16 with fresh samples on both the operational and [transfer](../transfer.json) suites. The latter was used in earlier studies but is excluded from this selection. These experiments test replies with tools disabled. Deployment and live workflow acceptance are outside this comparison.

To reproduce a step, generate the snapshots with the [prompt builder](prompts.py) and use the [clean-directory procedure](clean-path.md#reproduction). Use deployed.md for the first baseline, then the preceding ops-prefixed snapshot as the baseline at each step. Use the selected snapshot and deployed.md for the confirmation pairs.
