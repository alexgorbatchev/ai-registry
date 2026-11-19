---
created_on: 2026-11-18 19:20
last_modified: 2026-11-18 19:28
status: current
---

# Paired reply trials

Each round contains the contemporaneous baseline and an experimental candidate, with two independent generations per case per arm. The baseline is the full shared system prompt at `940a2ca`. Rounds 01, 02, 02b and 08 use the six development cases. Rounds 03 and 04 share five transfer cases. Rounds 05 and 06 share four verification cases. Round 07 uses four fresh cases. The older GPT pilot is a separate experiment. For evidence from actual conversations, see the [field observations](field-observations.md).

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

Astra ran via Codex CLI 0.170.0 with an explicit model instructions file, an empty temporary working directory, and medium reasoning effort confirmed by the CLI. The first Astra round allowed its default read-only shell. Subsequent rounds disabled the shell tool. One first-round reply contained a private hostname. The published response substitutes `private-host.invalid`. The word count and grading are unaffected.

Opus ran via Claude Code CLI 2.1.327 with an authenticated launcher, an explicit system prompt, safe mode, empty tool list, strict MCP configuration, and medium effort requested. Its result envelope confirmed the model ID. The API did not expose effective reasoning effort. The first wrapper invocation returned a flag conflict before generation, preserved under `attempts/`. The parallel runner resumed the first Opus file. In rounds 02 and 02b, the second baseline location request timed out at 180 seconds. Each run preserved its other 23 responses and a retry generated its single missing row. Round 02 exited after 193.33 seconds and resumed in 13.7 seconds. Round 02b exited after 192.37 seconds and resumed in 12.9 seconds. See the [02 attempt](attempts/02-opus-timeout.json) and [02b attempt](attempts/02b-opus-timeout.json).

These are small controlled samples with simulated conversation history. Each response is a fresh request. The same baseline can produce different counts across rounds. Word counts include requested detail, and automated pattern misses can include valid paraphrases.

## Results

All 368 responses are present. Within each cell, the baseline value comes first. Passes use the case-specific automatic checks. Mean length counts whitespace-delimited words across all cases, including requested explanations.

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

An AI reviewer scored shuffled anonymous responses for completeness, concision and correct use of reply IDs. Each reading pass requires all three. The rubric and case interpretations preceded review, and judgments preceded disclosure of the model, arm, repetition and automatic verdict.

| Round | Astra reading passes | Opus reading passes | What the reading adds |
| --- | ---: | ---: | --- |
| [03 transfer](03-review.json) | 8/10 → 8/10 | 0/10 → 1/10 | Eight Opus candidate answers passed the automatic checks, but only one stayed concise under reading. |
| [05 fresh verification](05-review.json) | 8/8 → 8/8 | 0/8 → 2/8 | Every Opus candidate answer was complete. Six still included dispensable material. |
| [06 verification replay](06-review.json) | 8/8 → 8/8 | 0/8 → 4/8 | All eight Opus candidate answers used IDs acceptably. Four met the concision criterion. |
| [07 fresh confirmation](07-review.json) | 8/8 → 8/8 | 0/8 → 5/8 | Seven Opus candidate answers were complete, seven used IDs acceptably and five stayed concise. |

In round 08, both candidates passed both completion trials. Astra also passed both independent-offer trials. In both Opus replies the finding and offer had separate correct IDs. An Agent Pages availability notice came first, and both replies exceeded the case limit. The full shared prompt requires such a notice if a decision page is unavailable. See the [original responses](08-opus.jsonl) and [reproduction protocol](../PROTOCOL.md).
