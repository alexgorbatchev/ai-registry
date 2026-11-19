---
created_on: 2026-11-18 19:20
last_modified: 2026-11-18 20:14
status: current
---

# Paired reply trials

First-pass rounds compare two fresh responses per case per arm. Editing rounds compare each original draft with its own edited reply. Rounds 01–08 use the full shared prompt at `940a2ca` as baseline. Rounds 09–12 compare against the adopted round 06 wording at `aa692f8`. Rounds 01, 02, 02b and 08 use the six development cases. Rounds 03 and 04 share five transfer cases. Rounds 05 and 06 share four verification cases. Round 07 uses four fresh cases that round 09 replays. Round 10 introduces six engineering cases that round 11 replays. Round 12 uses fresh transfer cases. The older GPT pilot is a separate experiment. For evidence from actual conversations, see the [field observations](field-observations.md).

| Round | Candidate relative to baseline | Purpose |
| --- | --- | --- |
| 01 | [Original appended guidance](../candidate.patch) | Test the prior proposal on the requested models. |
| 02 | [Answer scope and ID placement](revision-02.patch) | Replace the original two paragraphs with direct stopping and grouping rules. |
| 02b | [Question-specific stopping and deletion pass](revision-02b.patch) | Answer narrow questions directly, group evidence and delete dispensable sentences. |
| 03 | Same as 02b | Compare against the baseline on frozen cases after selecting the candidate on development results. |
| 04 | [Ground the reply in supplied facts and label individually addressable steps](revision-04.patch) | Reuse the 03 cases after inspecting their results. This is a targeted replay. |
| 05 | Same as 04 | Check the revised wording on four fresh cases covering location, uncertainty, existing IDs and requested procedural detail. |
| 06 | [Short examples, task-specific scope and optional humor](revision-06.patch) | Replay the four 05 cases after revising the prompt in response to their results. |
| 07 | Same as 06 | Check lookup, uncertainty, persistent IDs and a requested printable draft on four fresh cases. |
| 08 | Same as 06 | Recheck the original development cases, including the separate closing offer and the approved action’s completion. |
| 09 | [Use supplied facts, lead with the ID and state each requested point once](revision-09.patch) | Replay the 07 cases to test known weaknesses in handling uncertainty and previously labeled findings. |
| 10 | Same as 09 | Check a fresh command lookup, offer, rollout status, data-loss consequence, latency interpretation and transaction explanation. |
| 11 | [Completed examples appended to the adopted prompt](revision-11.patch) | Return to the adopted wording and demonstrate short replies. Replay the round 10 cases. |
| 12 | Same as 11 | Check a role lookup, independently labeled offer, incident status, destructive restore, unidentifiable worker and release explanation on fresh cases. |
| 13 | [Separate editing pass](../editor.md) | Edit the saved round 10 baseline drafts using the original engineering requests. |
| 14 | Same editor as 13 | Edit the saved round 12 baseline drafts on the transfer cases. |
| 15 | Same editor, Astra editing Opus | Use the exact Opus drafts from 13 to isolate the change of editor on the challenge cases. |
| 16 | Same editor, Astra editing Opus | Use the exact Opus drafts from 14 to repeat the comparison on the transfer cases. |

Astra ran via Codex CLI 0.170.0 with an explicit model instructions file, an empty temporary working directory, and medium reasoning effort confirmed by the CLI. The first Astra round allowed its default read-only shell. Subsequent rounds disabled the shell tool. One first-round reply contained a private hostname. The published response substitutes `private-host.invalid`. The word count and grading are unaffected.

Opus ran via Claude Code CLI 2.1.327 with an authenticated launcher, an explicit system prompt, safe mode, empty tool list, strict MCP configuration, and medium effort requested. Its result envelope confirmed the model ID. The API did not expose effective reasoning effort. The first wrapper invocation returned a flag conflict before generation, preserved under `attempts/`. The parallel runner resumed the first Opus file. In rounds 02 and 02b, the second baseline location request timed out at 180 seconds. Each run preserved its other 23 responses and a retry generated its single missing row. Round 02 exited after 193.33 seconds and resumed in 13.7 seconds. Round 02b exited after 192.37 seconds and resumed in 12.9 seconds. See the [02 attempt](attempts/02-opus-timeout.json) and [02b attempt](attempts/02b-opus-timeout.json).

These are small controlled samples with simulated conversation history. Each response is a fresh request. The same baseline can produce different counts across rounds. Word counts include requested detail, and automated pattern misses can include valid paraphrases.

## Results

The archive contains 688 rows. They represent 616 generated replies plus 72 original drafts copied into the paired editing comparisons. Within each cell, the baseline value comes first. Passes use the case-specific automatic checks. Mean length counts whitespace-delimited words across all cases, including requested explanations.

| Round | Responses per arm per model | Astra passes | Astra mean words | Opus passes | Opus mean words |
| --- | ---: | ---: | ---: | ---: | ---: |
| 01 | 12 | 8 → 9 | 37.1 → 29.3 | 4 → 4 | 160.2 → 134.4 |
| 02 | 12 | 8 → 9 | 33.4 → 31.2 | 7 → 9 | 146.6 → 93.2 |
| 02b | 12 | 8 → 11 | 33.6 → 30.0 | 5 → 10 | 148.2 → 90.0 |
| 03 | 10 | 9 → 9 | 24.9 → 25.0 | 2 → 8 | 131.3 → 74.5 |
| 04 | 10 | 9 → 10 | 26.7 → 23.3 | 3 → 10 | 118.2 → 47.4 |
| 05 | 8 | 8 → 8 | 36.1 → 31.0 | 3 → 6 | 140.8 → 87.1 |
| 06 | 8 | 7 → 8 | 34.8 → 32.5 | 3 → 6 | 149.2 → 74.4 |
| 07 | 8 | 8 → 8 | 26.5 → 21.4 | 2 → 5 | 120.1 → 37.0 |
| 08 | 12 | 7 → 10 | 35.2 → 24.0 | 7 → 9 | 149.2 → 88.2 |
| 09 | 8 | 8 → 8 | 19.9 → 19.0 | 6 → 8 | 36.4 → 34.8 |
| 10 | 12 | 10 → 12 | 47.3 → 37.8 | 7 → 6 | 137.2 → 131.8 |
| 11 | 12 | 11 → 12 | 43.6 → 42.2 | 5 → 10 | 137.2 → 101.1 |
| 12 | 12 | 12 → 12 | 36.7 → 29.8 | 9 → 10 | 135.4 → 75.0 |
| 13 | 12 | 10 → 10 | 47.3 → 48.3 | 7 → 8 | 137.2 → 103.9 |
| 14 | 12 | 12 → 12 | 36.7 → 34.1 | 9 → 10 | 135.4 → 88.3 |

In the two cross-model rounds the baseline is an Opus draft and the candidate is its Astra edit. Each pair uses the same draft as the corresponding Opus self-edit in rounds 13 and 14.

| Round | Pairs | Automatic passes, Opus → Astra edit | Mean words, Opus → Astra edit | Reading passes, Opus → Astra edit |
| --- | ---: | ---: | ---: | ---: |
| 15 | 12 | 7 → 12 | 137.2 → 41.4 | [2 → 12](15-review.json) |
| 16 | 12 | 9 → 12 | 135.4 → 37.8 | [4 → 12](16-review.json) |

For rounds 15 and 16 the reviewer knew the intervention in advance and saw randomized replies mixed with archived decoys. The source model, arm, repetition and automatic score of each reply were hidden. Prior blinded judgments were reused for identical request/reply pairs across the editing rounds. The 24 Astra edits passed all three reading criteria, up from six original Opus drafts. These are two replies per case across twelve synthetic scenarios.

An AI reviewer scored shuffled anonymous responses for completeness, concision and correct use of reply IDs. Each reading pass requires all three. The rubric and case interpretations preceded review, and judgments preceded disclosure of the model, arm, repetition and automatic verdict.

| Round | Astra reading passes | Opus reading passes | What the reading adds |
| --- | ---: | ---: | --- |
| [03 transfer](03-review.json) | 8/10 → 8/10 | 0/10 → 1/10 | Eight Opus candidate answers passed the automatic checks, but only one stayed concise under reading. |
| [05 fresh verification](05-review.json) | 8/8 → 8/8 | 0/8 → 2/8 | Every Opus candidate answer was complete. Six still included dispensable material. |
| [06 verification replay](06-review.json) | 8/8 → 8/8 | 0/8 → 4/8 | All eight Opus candidate answers used IDs acceptably. Four met the concision criterion. |
| [07 fresh confirmation](07-review.json) | 8/8 → 8/8 | 0/8 → 5/8 | Seven Opus candidate answers were complete, seven used IDs acceptably and five stayed concise. |
| [09 replay](09-review.json) | 8/8 → 8/8 | 6/8 → 4/8 | Two Opus status pairs regressed. Both candidates added an unrequested AV caveat. |
| [10 engineering challenge](10-review.json) | 9/12 → 11/12 | 2/12 → 2/12 | Opus ID binding fell from 9/12 to 7/12. Revision 09 missed its adoption rule. |
| [11 engineering replay](11-review.json) | 11/12 → 12/12 | 2/12 → 5/12 | Opus gained three joint passes. Its correct ID binding rose from 7/12 to 11/12. |
| [12 fresh transfer](12-review.json) | 12/12 → 12/12 | 4/12 → 7/12 | Revision 11 met the rule exactly. Opus completeness rose from 6/12 to 9/12 and ID binding from 8/12 to 9/12, with no paired loss. |
| [13 edit engineering drafts](13-review.json) | 9/12 → 9/12 | 2/12 → 2/12 | Editing raised Opus completeness from 7/12 to 10/12 but gained no joint passes. |
| [14 edit transfer drafts](14-review.json) | 12/12 → 12/12 | 4/12 → 7/12 | Opus gained three joint passes, with completeness rising from 6/12 to 11/12. |

In round 08, both candidates passed both completion trials. Astra also passed both independent-offer trials. In both Opus replies the finding and offer had separate correct IDs. An Agent Pages availability notice came first, and both replies exceeded the case limit. The full shared prompt requires such a notice if a decision page is unavailable. See the [original responses](08-opus.jsonl) and [reproduction protocol](../PROTOCOL.md).

## Comparing further revisions against the adopted prompt

The adopted wording still produced unsupported caveats. In round 06, both Opus meter answers introduced a possible reset, and one trainee explanation invented a cost and an approval step. In round 07, one Opus answer qualified an explicitly complete entry count. Another repeated both status findings before giving their IDs and added an unsolicited equipment check. These are errors an answer can retain even while passing a length check. See the [06 judgments](06-review.json) and [07 judgments](07-review.json).

Revision 09 changes the general tradeoff guidance and three communication paragraphs. Revision 11 starts again from the adopted prompt and adds five finished examples at its end. The two interventions have independent baseline samples.

Round 09 revisits known examples. Round 10 tests whether a shorter reply still identifies the separate offer, preserves the data-loss risk, distinguishes the observed latency difference from evidence about typical latency, and explains why both transaction writes must succeed together. Compare the two arms within each round because the baseline changed after round 08.

Before generation, the adoption rule required at least three additional Opus responses out of twelve to pass all three reading criteria on round 10. Astra’s joint pass count had to hold, and neither model could lose ground on factual completeness or correct ID binding. Inspect each paired loss and factual error before deciding. The same criteria apply to the fresh round 12 comparison. Rounds 09 and 11 are diagnostic.


## Cost of editing an existing draft

Rounds 13 and 14 each made 12 additional calls per model. In round 13 the average editor call took 9.1 seconds for Astra and 8.5 seconds for Opus. In round 14 it took 8.5 and 7.7 seconds respectively. The 24 Opus edits reported a combined $0.416 in CLI cost estimates. Astra supplied no comparable cost figure. Editing adds this latency to the time spent generating the original reply. With parallel workers the full rounds finished in 18.2 and 19.7 seconds (13, Astra and Opus) and 17.8 and 20.5 seconds (14).

Editing Opus drafts with Astra added an average of 6.7 seconds per reply in round 15 and 6.9 seconds in round 16. The parallel commands finished in 15.3 and 14.4 seconds respectively. Codex supplied no dollar cost. These trials sent saved synthetic drafts to a different provider.
