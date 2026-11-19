---
created_on: 2026-11-18 19:26
last_modified: 2026-11-18 19:26
status: current
---

# What prompted the trials

In a November 10 Claude thread, a one-line scheduler question received a 16-item answer. When asked to debug its interpretation, Claude said it had treated the opening verdict as sufficient for TLDR and promoted checklist details into individually labeled items. This is the model's retrospective explanation. The thread produced an unrelated diagram-skill commit (`d41d816`). The suggested eight-line limit was never adopted.

On November 18 at 05:34 Pacific, `df93a88` revised which items belonged in replies and what should follow each ID. The installed Claude instructions matched the registry source when inspected. Subsequent threads still included a 269-word location answer with seven IDs, an independent offer without an ID, and a 282-word explanation of a single prior ID that added six findings and options.

| Qualifying Claude final replies | Preceding 24 hours | After the commit through 18:56 Pacific |
| --- | ---: | ---: |
| Replies | 97 | 155 |
| Mean words | 334 | 300 |
| Median words | 332 | 280 |
| Contained a bold reply ID | 68% | 70% |

The scan excluded identifiable worker reports and automated turns. No qualifying reply fell between midnight and the change, so the before sample comes from November 17. Across six threads with replies on both sides, pooled mean length fell from 443 to 355 words. Four threads got shorter and two got longer. Commit time is a proxy for exposure. The logs cannot establish when each thread loaded the new instructions, and the requests differ across periods. Finding an ID anywhere also says little about whether it labels the user's decision.

Only aggregate measurements and generalized failure descriptions are published here. The controlled fixtures use synthetic examples.
