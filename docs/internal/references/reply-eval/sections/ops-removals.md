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

## Results by paragraph

Each arrow compares fresh replies to the same six requests, with two samples per request and 12 replies per arm per model. Each baseline repeats the preceding prompt with new generations. Adjacent rows can therefore give different scores for identical text.

| Newly removed paragraph | Opus passes | Opus mean words | Astra passes | Astra mean words |
| --- | ---: | ---: | ---: | ---: |
| [1. Stopping and releasing ownership](ops-01-stop/comparison.json) | 4 → 4 | 26.6 → 22.4 | 9 → 10 | 18.0 → 17.4 |
| [2. Durable task records](ops-02-records/comparison.json) | 3 → 5 | 22.8 → 24.1 | 9 → 12 | 17.8 → 17.8 |
| [3. Queue continuation](ops-03-queue/comparison.json) | 4 → 4 | 24.8 → 24.8 | 10 → 10 | 17.3 → 17.2 |
| [4. Completion and validation](ops-04-completion/comparison.json) | 4 → 4 | 23.1 → 22.8 | 12 → 8 | 19.2 → 17.8 |
| [5. Interrupted work](ops-05-interruption/comparison.json) | 4 → 2 | 24.2 → 23.5 | 8 → 11 | 18.0 → 17.3 |
| [6. Proportional investigation](ops-06-investigation/comparison.json) | 5 → 5 | 22.8 → 22.7 | 10 → 11 | 17.4 → 18.4 |
| [7. Engineering skill loading](ops-07-engineering/comparison.json) | 7 → 5 | 21.8 → 23.0 | 9 → 8 | 17.4 → 18.2 |
| [8. Worktree caches](ops-08-worktrees/comparison.json) | 5 → 4 | 23.1 → 24.5 | 10 → 10 | 18.5 → 18.4 |

Removing task records after the stopping paragraph produced the only positive marginal change on Opus. That two-paragraph cut tied the six- and seven-paragraph cuts at 5/12 candidate passes. The selection rule chose the smaller cut. The same six-paragraph prompt scored 5/12 as a candidate and 7/12 as the next control. A two-reply difference alone is weak evidence for a paragraph effect.

Across the eight candidate prompts, Opus passed 0/16 receipt handoffs and 0/16 label-and-receipt findings, but 16/16 requests to restate a recorded decision. With every operating paragraph removed, one handoff still added “No further action needed” and another explained why the export job was out of scope. In a two-finding reply, Opus preserved **f3** and **f5** while turning one duplicate receipt into “Receipts print twice.” The repeated failures were scope, unsupported claims and redundant status. [Read the receipt replies](../summary.html#answers-ops-08-worktrees-opus) and [the two-finding grades](ops-07-engineering/judgments.json).

On requests specifying ID pairs, Astra passed the structural check in 96/96 replies across the eight ranked comparisons, and Opus passed in 92/96. In each of the four failures, Opus supplied the two requested option IDs and also added an unrequested **q3** heading. These counts include both arms. Stable IDs across turns in a live session require a separate test.

## Direct confirmation against intact F16

| Suite | Opus passes | Opus mean words | Astra passes | Astra mean words |
| --- | ---: | ---: | ---: | ---: |
| [Operational](ops-confirm-operational/comparison.json) | 3 → 5 | 25.1 → 21.7 | 12 → 9 | 18.3 → 18.2 |
| [Transfer](ops-confirm-transfer/comparison.json) | 6 → 6 | 71.5 → 65.4 | 12 → 10 | 29.2 → 30.8 |

The two-paragraph cut shortened Opus replies on both suites. It picked up one operational pass each on the receipt, patch status and worker incident, and lost one on the Save fix by omitting its passing keyboard test. Every transfer case had exactly the same Opus pass count in both arms. Astra lost passes on both suites. Each suite has only six distinct requests, and these tools-disabled trials measure reply quality. The results support keeping F16 deployed. They identify a limited operational improvement for Opus with the combined cut, while leaving the contribution of each paragraph on its own unresolved.

All 480 generated replies and 60 blind review calls have distinct native-log receipts and verified clean ancestor paths. The offline report links every score to the source replies and grades. [Browse the ten rounds](../summary.html#ops-removals).
