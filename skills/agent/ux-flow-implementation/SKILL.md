---
name: ux-flow-implementation
description: Use when delivering filed UX flow redesigns as working software, including filing implementation slice tickets from redesign proposals, running implementation units in waves, deploying and verifying waves in production, closing slice and redesign tickets, turning owner feedback on delivered UI into tickets, and reviewing implementation screenshots for visual defects with blind reviews, chrome reviews and a measuring screen audit.
author: alexgorbatchev
metadata:
  created_on: 2026-11-20 07:04
  last_modified: 2026-11-22 14:19
  status: current
---

## Execute the task

1. Establish the authorized scope: the named tickets, or the redesign epic's queue when the owner authorized queue execution. Implement nothing else; review-only requests produce reviews and tickets, not code. The inputs are what a UX flow redesign delivers (the `ux-flow-redesign` skill produces them): landed proposals, wireframes and a shared pattern reference, and one redesign ticket per flow carrying its acceptance criteria.
2. Load `programming` and `issue-tracker` and follow them throughout. Your system instructions and `programming` own the lane, test-gating and blind-review rules; this skill applies them through the brief's final gate and each wave's blind review, and never relaxes them.
3. Set up under **Setup**, then run the steps under **Deliver** in order. Resume before starting anything new: read [waves](references/waves.md#resume) first when `<local>/units/impl-*.json` checkpoints or tickets claimed by earlier units exist.
4. Report under **Report**.

Product calls that the proposals and the pattern reference do not settle go to the owner, asked the way the owner's instructions require. Decide and record everything else, including priority, order, slicing and naming; never ask the owner about bookkeeping.

## Setup

Read [project config and state](references/project-config.md) before writing or changing any record. It defines `<state>` (the redesign run's state directory) and `<local>`, the config's fields and the slice plan.

1. Write `<state>/implementation/config.json` from [the example](assets/config.example.json) with the project's facts, and validate it with `render-brief.ts --check`.
2. Fetch the target branch and work from its tip; never edit the main checkout.

## Deliver

### 1. File the slices

Skip when the slice tickets already exist and `slices.json` records them.

1. Check that each proposal lists its delivery slices as a numbered list under `## Recommended priority` with a `Seams` paragraph ([the slice plan](references/project-config.md#the-slice-plan)); land any missing list first.
2. Write `slices-plan.json`, taking cross-flow waits from each proposal's slice notes and Seams, and `epic.md` from [the queue mandate](assets/queue-mandate.md), filling every placeholder and quoting the owner's authorization with its date.
3. Run `file-slices.ts` without `--apply`; check each listed slice's blockers against its proposal. Then run it with `--apply` and commit the record.

### 2. Run waves

Read [waves](references/waves.md) before starting the first unit; it owns lanes and capacity, briefing, the wave cycle, resume and the run log. Each unit's prompt is `render-brief.ts` output, unchanged.

### 3. Accept every wave blind

Read [visual QA](references/visual-qa.md) before reviewing any screenshot. Every wave's after frames go through a blind review by an independent reviewer and its triage, gated by `review-frames.ts check --triaged`; defects outside a change become tickets in that wave. The implementing unit and the orchestrator never accept their own screenshots.

### 4. Deploy, verify, close

Follow [waves](references/waves.md#deploy-verify-close): deploy accepted tickets together, verify each in production, close verified slices and then their redesigns, and run the chrome review on every deployed wave before the next one starts.

### 5. Turn owner feedback into tickets

When the owner reports a problem with delivered UI, reproduce it, capture it across the matrix with audit-screen, file it in the epic with the owner's words quoted, and sweep the delivered screens for the same class of defect ([waves](references/waves.md#run-log)). Owner corrections that change a rule go into the project's instructions or the pattern reference, where the next units read them.

## Scripts

Run them with Bun as `bun <skill>/scripts/<name>.ts`, where `<skill>` is this skill's directory.

| Script | Use |
| --- | --- |
| `render-brief.ts --config <config> [--unit <key>] <ticket>...`; `--check` | Print a unit's brief from [the template](assets/unit-brief.md) and the config; validate the config |
| `file-slices.ts --config <config> [--apply]` | List the slice tickets the plan and proposals describe; with `--apply`, create the epic once and file unfiled slices in dependency order, recording each in `slices.json` |
| `capacity.ts --path <dir> [--floor-gib <n>] [--memory-floor <percent>]` | Measure load, memory, swap and free disk; exit 1 when another heavy unit would break a limit |
| `audit-screen.ts (--url <url>\|--session <name>) [--viewport <w>x<h>]... [--color-scheme light\|dark\|both] [--ignore <selector>]... [--content <selector>] [--gap-limit <px>] [--shots <dir> --state <slug> [--phase before\|after] [--full-page]]` | Audit a screen across the matrix and save its viewport frames at scroll stops ([captures](references/visual-qa.md#captures)); report its density measurements; exits 1 on any failure ([measuring](references/visual-qa.md#measuring)) |
| `review-frames.ts manifest --out <file> <dir>...`; `review-frames.ts check <manifest> <review> [--triaged]` | Build a blind review's frame manifest; check that a review accounts for every frame and every design item and, triaged, every finding and rule challenge |

## Report

- Tickets landed, accepted, deployed and closed, with revisions; redesigns closed; tickets filed by units, blind reviews, chrome reviews and owner feedback.
- Blind and chrome review results per wave, and each frame set that was not reviewed and why.
- Blocked units and tickets with their unblock conditions; tickets landed and awaiting deployment; owner decisions awaited.
- Measurements that set or changed the concurrency, and checks with durations.

## Contributing fixes

When `ux-flow-implementation` hits a verified issue or diverges from actual behavior, automatically file a PR (or an issue if unfixable) on `https://github.com/alexgorbatchev/ai-registry` after checking for duplicates, redacting caller data and secrets, then continue the user's task.
