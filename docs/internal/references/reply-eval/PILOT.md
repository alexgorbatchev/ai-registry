---
created_on: 2026-11-18 19:11
last_modified: 2026-11-18 19:11
status: current
---

# First reply regression run

Keep the current prompt for this comparison. Appending the candidate guidance produced the same four passing responses out of twelve and increased mean length from 104 to 149 words. On the narrow location question alone, baseline responses used 45 and 39 words. Candidate responses used 243 and 227 and volunteered setup details both times.

The run used the complete shared instructions at `da15b5b` and the checked-in candidate patch. Six synthetic cases ran twice per arm in 140.3 seconds. The chat-completions gateway reported `gpt-5.5` for all 24 responses. Upstream snapshot and sampling parameters were unavailable. The target Claude Code CLI v2.1.327 rejected the expired login before generation. This run supplies no Claude treatment effect.

| Case | Baseline passes | Candidate passes | Observed behavior |
| --- | ---: | ---: | --- |
| Narrow location question | 0/2 | 0/2 | Both candidates volunteered excluded details. |
| Approved action completed | 0/2 | 0/2 | All four reported routine checks. Both candidates missed the expected action prefix. |
| Update and independent offer | 0/2 | 0/2 | All four replies exceeded the case budget. On both candidate runs the ID-bearing items followed introductory text. |
| Progress with one blocker | 0/2 | 0/2 | All four repeated the unchanged backlog, formatting result and memory measurement. |
| Explicit detail request | 2/2 | 2/2 | All four contained the expected steps and reasons. |
| Revisit one finding and add another | 2/2 | 2/2 | All four used the existing and next finding IDs at item starts. |

The original grader required a closing bold marker immediately after the ID. It scored both arms 2/12 and missed usable IDs such as an entire bold heading beginning with f2. The corrected grader recognizes those prefixes, including the first cell of a table. The table above regrades the original responses without resampling. The JSONL preserves the original automatic misses.

The blocked-progress replies illustrate why word count alone is insufficient. They named the blocker but also reported all three irrelevant facts. Conversely, the detailed recovery request legitimately takes more words. The offer case can also trigger the shared Agent Pages fallback in this tool-free setting. An opening availability notice can therefore be correct under the full rules even when the prefix check flags it.

This is an exploratory comparison with two samples per case. The retained rows support inspection and regression checks. They do not estimate compliance in long-running Claude sessions. See the [replay protocol](PROTOCOL.md) and [original responses](pilot.jsonl).
