---
created_on: "2026-10-16 14:40"
last_modified: "2026-10-24 10:28"
status: current
author: "GPT-6 (exact snapshot unavailable)"
source_url: "https://github.com/ayghri/i-have-adhd"
---

# ADHD framing pilot results

This pilot found one extra passing development answer with the ADHD cue and no held-out advantage. It does not establish that the cue is essential, useless, or reliably beneficial. It compares compliance with communication rules; it does not measure reader comprehension or clinical outcomes.

## What was compared

The two first sentences were:

- Neutral: “Use a reader-friendly communication style.”
- ADHD: “Use an ADHD-friendly communication style.”

The remaining instructions were identical within each version. This isolates the label in these extracted rules, not the full upstream skill’s diagnosis assertion and explanatory rationale. Eight fresh generation agents produced 40 answers: six development cases and four holdout cases, with two repetitions per arm. Four fresh agents graded shuffled, arm-blinded answers; a thirteenth agent audited the method. Answers from one generation agent share a batch context.

After development grading, one shared revision added a functional rationale about reducing effort to start, follow, and resume, and explicitly required exactly one diagnostic input when evidence was missing. Both arms received the same revision. The holdout then ran without further prompt tuning. The cases differ between phases, so the scores cannot establish improvement from that revision.

## Results

Counts are responses passing the applicable criterion. Continuity applies only to cases with scripted conversation histories.

| Criterion | V1 neutral | V1 ADHD | V2 holdout neutral | V2 holdout ADHD |
| --- | ---: | ---: | ---: | ---: |
| Answer placement | 12/12 | 12/12 | 8/8 | 8/8 |
| Actionable steps | 10/12 | 11/12 | 6/8 | 6/8 |
| Continuity | 2/2 | 2/2 | 2/2 | 2/2 |
| Completeness | 12/12 | 12/12 | 6/8 | 6/8 |
| All applicable criteria | 10/12 | 11/12 | 6/8 | 6/8 |
| Mean words | 74.8 | 74.8 | 94.8 | 101.6 |

Development had eleven paired ties and one ADHD win. The sole difference concerned a missing-evidence task: one ADHD answer requested only error output, while its neutral counterpart requested error output, input file, and code together. The other repetition failed in both arms. This is a one-answer observation, not a demonstrated repeatable effect.

All eight holdout pairs tied. Every release-status answer correctly retained compilation and unit-test success, staging failure, unknown cause, and the production gate. All four requested the named log for diagnosis rather than recommending its inspection. The frozen rubric marked actionable steps and completeness as failures because its general completeness definition includes every acceptance requirement.

That holdout failure is ambiguous: the case names an available log but supplies no contents or tool access. Asking for the log can reasonably precede inspecting it. A post hoc interpretation accepting that request and separating status completeness would yield 8/8 in both arms. The frozen scores remain unchanged; either interpretation leaves the framing contrast tied.

## Grading and method audit

The development judges initially disagreed on three actionable-step checks. One interpreted “one concrete diagnostic input” as allowing multiple inputs. A label-blind audit using the original acceptance text resolved all three; both initial judgments and the correction are preserved. The holdout judges agreed on all 52 applicable checks.

The method audit also found that development case d4 requires recommending B although both A and B satisfy the stated constraints, without an explicit preference resolving price against speed and automation. All four observed answers chose B, so this defect does not change these scores, but future cases should state the preference. Preserve this suite as frozen rather than silently repairing it.

The rubric has overlapping dimensions: a missing required action can also fail completeness. The combined pass count is a strict conjunction, not four independent measurements.

## Limits on interpretation

- Exact model snapshot, provider, sampling settings, reasoning settings, generation limits, usage, and finish reasons were unavailable. No values were inferred.
- Fresh agents excluded parent conversation history but retained platform instructions. Those instructions already favor concise, action-oriented responses, which can reduce sensitivity to either experimental prompt. The full inherited instruction envelope is not captured.
- There are only two generation workers per arm per phase, each answering a batch. Forty answers are not forty independent generation sessions.
- Binary checks on short synthetic tasks have substantial ceiling effects. Continuity tests state reconstruction from supplied histories, not sustained behavior in a long live conversation.
- Judges used the same inherited model family. Agreement is not independent human validation.
- Neither a no-rules control nor a full-upstream-framing arm was tested. The results do not isolate the contribution of the explicit rules themselves or settle every possible use of the ADHD label.

No significance or equivalence claim is warranted. The evidence supports using the explicit behavioral rules as the reviewable instruction contract; it does not justify treating the label as a required control token. Retaining or omitting it remains a preference pending stronger evidence.

## Preserved data and reruns

See [PROTOCOL.md](PROTOCOL.md) for replay steps, [suite.json](suite.json) for frozen cases, [revision.json](revision.json) for the shared edit, and [runs/pilot/summary.json](runs/pilot/summary.json) for counts and response-level failures. The folder also preserves exact prompts, eight generation jobs, 40 responses, shuffled judge inputs, hidden mappings, all judgment files, runtime metadata, and the method audit.

[replay/v1.json](replay/v1.json) and [replay/v2.json](replay/v2.json) contain provider-neutral request arrays with actual system and conversation message roles. They require the chosen provider’s native transport; this is a replay corpus, not an executable cross-provider runner. Native system-message replay differs from the pilot’s subagent task instruction and batch wrapper. Record that runtime difference instead of pooling the runs as identical.

For a stronger next experiment, freeze a new suite with explicit preferences and artifact access, separate action coverage from completeness, increase fresh per-case repetitions, specify exact model IDs and settings, and use independent blinded human or cross-family grading. Retest both prompt versions on the same new cases if estimating revision effects. Keep this holdout as used data; it cannot become unseen again.

These artifacts originated in the `experiment/communication-framing` worktree and are preserved here with the integrated communication guidance. The pilot did not change an installed prompt.

