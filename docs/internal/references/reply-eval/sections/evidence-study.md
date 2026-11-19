# Which closing instructions improve TLDR and reply IDs?

The [final change](reply-ending.patch) replaces only the last section of the full system prompt. It asks the model to edit the supplied facts into the answer, preserve their scope and certainty, and place independent findings’ IDs inside a draft. Operating Instructions and personality are present in both arms. The full prompt with this ending met the previously specified criteria on all four development suites. On the separately frozen final requests, Opus 3 → 7 out of 12, Astra 10 → 12 out of 12.

On the final untouched requests, Opus averaged 34.2 → 23.8 words and Astra averaged 22.7 → 21.5. The final Opus replies missed five times. Both signup-count replies proposed matching forms, both corrected listings added an editorial label or the superseded day, and one correctly numbered erratum added “The cause is unknown.” That last phrase appears verbatim in the candidate’s example. This is consistent with example copying, although the trial does not establish where the phrase came from. All four replies per model requiring particular IDs had the right prefixes. [Inspect the held-out replies and reasons](../summary.html#answers-evidence-19-holdout-opus).

On the four development suites together, Opus passed 21 → 41 of 48 replies and averaged 53.7 → 34.1 words. Astra passed 41 → 45 and averaged 26.4 → 24.0 words. The stricter ID check passed on all 16 final replies per model with specified IDs, including all eight in fresh sets A and B. The preceding source-editing version also matched the isolated TLDR and ID prompt within one joint pass per model on both suites tested. The [ranked ops removals](ops-removals.md) had produced smaller or inconsistent gains. The experiments support changing the ending while keeping ops; they do not identify a single sentence as the cause of all earlier misses.

The draft-ID sentence placed the labels inside each maintenance-chat draft. Both models preserved the identities they had assigned in 4/4 final chats each, the same continuity score as the control. With the preceding source-editing wording, one Opus chat omitted IDs throughout. Across all 32 conversations, the other 31 established IDs and recovered them after an interruption. These four-turn chats establish short-term continuity only. [Read each conversation](../summary.html#native-continuity).

## Scores and reply lengths

Each arrow compares fresh independent generations on the same six requests. Each model produced two replies per request per arm, giving 12 per score cell. A blind Astra reviewer graded completeness, concision and correct addressability together. The means count every reply, including failures. Repeated suites and repeated samples of each request are related observations. Both models ran at medium effort through their ordinary user instruction files. No editing pass was used. The [HTML report](../summary.html#evidence-study) links every score to the exact replies and blind judgments.

| Round | Control → candidate | Requests | Opus passes | Opus mean words | Astra passes | Astra mean words |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| [1](evidence-01-example/comparison.json) | Current → One example | Operational | 6 → 6 | 23.2 → 25.5 | 10 → 9 | 18.2 → 17.8 |
| [2](evidence-02-ending/comparison.json) | Current → First ending | Operational | 3 → 11 | 23.9 → 19.8 | 10 → 12 | 17.9 → 17.9 |
| [3](evidence-03-repeat/comparison.json) | Current → First ending | Operational | 7 → 11 | 24.4 → 19.3 | 9 → 12 | 17.6 → 17.7 |
| [4](evidence-04-transfer/comparison.json) | Current → First ending | Transfer | 7 → 8 | 85.9 → 78.2 | 10 → 10 | 29.3 → 30.8 |
| [5](evidence-05-fresh/comparison.json) | Current → First ending | Fresh | 8 → 7 | 60.6 → 46.2 | 11 → 10 | 31.2 → 29.7 |
| [6](evidence-06-prose/comparison.json) | Current → Prose only | Operational | 8 → 11 | 24.9 → 21.9 | 9 → 11 | 18.0 → 18.4 |
| [7](evidence-07-examples/comparison.json) | Current → Examples only | Operational | 3 → 10 | 23.9 → 22.9 | 11 → 9 | 18.5 → 18.2 |
| [8](evidence-08-contrast/comparison.json) | Prose only → First ending | Transfer | 9 → 9 | 76.3 → 78.8 | 10 → 11 | 27.1 → 29.2 |
| [9](evidence-09-ops/comparison.json) | Current → Edit the record | Operational | 3 → 9 | 25.3 → 21.2 | 9 → 11 | 19.0 → 18.2 |
| [10](evidence-10-transfer/comparison.json) | Current → Edit the record | Transfer | 6 → 11 | 78.3 → 45.3 | 11 → 11 | 29.8 → 27.2 |
| [11](evidence-11-fresh/comparison.json) | Current → Edit the record | Fresh set A | 4 → 10 | 72.4 → 29.5 | 11 → 11 | 32.2 → 26.3 |
| [12](evidence-12-unseen/comparison.json) | Current → Edit the record | Fresh set B | 5 → 10 | 43.2 → 28.2 | 12 → 12 | 27.7 → 24.8 |
| [13](evidence-13-isolated/comparison.json) | Isolated rules → Edit the record | Operational | 9 → 10 | 21.0 → 20.4 | 11 → 10 | 18.3 → 18.5 |
| [14](evidence-14-isolated/comparison.json) | Isolated rules → Edit the record | Fresh set B | 9 → 9 | 40.2 → 27.8 | 11 → 12 | 25.1 → 26.3 |
| [15](evidence-15-draft/comparison.json) | Current → Final ending | Operational | 5 → 10 | 25.9 → 20.4 | 10 → 11 | 16.8 → 18.9 |
| [16](evidence-16-draft/comparison.json) | Current → Final ending | Transfer | 7 → 10 | 79.7 → 60.2 | 10 → 10 | 29.5 → 24.7 |
| [17](evidence-17-draft/comparison.json) | Current → Final ending | Fresh set A | 3 → 11 | 69.1 → 29.2 | 11 → 12 | 31.6 → 26.7 |
| [18](evidence-18-draft/comparison.json) | Current → Final ending | Fresh set B | 6 → 10 | 40.0 → 26.7 | 10 → 12 | 27.8 → 25.9 |
| [19](evidence-19-holdout/comparison.json) | Current → Final ending | Final untouched requests | 3 → 7 | 34.2 → 23.8 | 10 → 12 | 22.7 → 21.5 |

The archive covers 912 single-turn replies, 114 blind judge calls and 128 chat turns across 32 native conversations. Each single-turn launch and each chat turn has an ancestor check. Public records contain replies, scores and hashes. Original CLI streams, native transcripts and prompt records were retained separately in private storage.

## Experiments and selection

The full prompt supplies a broad claim followed by narrower evidence (“Labels now print in colour. The sample label confirms it.”). In prior graded replies, Opus repeatedly used the same construction for a single duplicate receipt. The example-only intervention changes just those two sentences to “The sample label printed in colour.” Its primary outcome is the two-finding case. The second intervention replaces the closing examples and their guidance with an [evidence-first ending](evidence-ending.md), while preserving every preceding byte, including all workflow instructions and personality. It tests a practical repair; several things change together.

Use the complete system prompt from commit `9999cae` as the control throughout. Run the example-only intervention then the replacement ending on the operational requests, with two new replies per arm, case and model. Test the replacement against the same control on transfer and six [previously unused requests](evidence-fresh.json), including a detailed handover and an explanation. Run a fresh operational replication to check that any improvement repeats. Keep the existing blind rubric, medium-effort models, clean ancestor audits and raw session receipts. Count joint passes first, then word counts and structurally correct IDs. Inspect failures and the cases that explicitly ask for detail. A candidate is worth carrying forward if Opus improves on both operational runs, transfer and fresh requests, without a reduction in combined Astra joint passes or broken explicit IDs on the fresh suite. Results describe these cases; the checks use single-turn replies.

## ID continuity in native conversations

Independently test the original prompt and the replacement ending in four fresh chats per arm and model. Use the same [four-turn script](id-continuity.json) in each. The first reply establishes the two finding IDs. An unrelated lookup intervenes. The third reply must preserve the east cabinet’s ID and allocate the next free finding ID to the south cabinet. The fourth reply must recover the west and south IDs in the requested order. No user turn supplies an ID. Compare each reply with IDs actually introduced in that conversation; retain missing labels, wrong bindings, extra labels and failed trials. Score the lookup independently. This tests short interruptions in one conversation.

## Separating the replacement text from its examples

The initial full replacement improved the Opus operational score. Two additional operational rounds cross the old and new prose with the old and new example lists. Each uses its own fresh, unedited full-prompt control. This checks whether either half alone can produce the observed improvement. Compare the receipt handoff and the two-finding case as well as total passes. The strongest smaller candidate by Opus operational score (ties favor prose) gets a separate fresh head-to-head with the complete replacement on transfer.

## Confirmation after the first fresh-suite miss

The judge for the first fresh suite interpreted a second fleck as a new subject, contradicting the fixture’s required **f7** and **f9**. Retain the original blind grades. For a sensitivity check on that round only, replace just addressability on the glass case with its published structural ID check; keep completeness, concision and all other grades. Subsequent trials use the same rubric with explicit case interpretations for the two corroborating-sample requests.

The [next ending](source-ending.md) asks the model to edit the supplied record, gives a complete two-person handoff, and explicitly defines how corroborating evidence attaches to a finding. Test it against the current full prompt on operations, transfer, the first fresh suite and [six further requests](source-fresh.json) frozen before scoring. Report every suite and both models. To qualify as a general repair, it must improve Opus joint passes on operations and both fresh suites, match or improve transfer, preserve the fresh suites’ explicit IDs, and match or improve Astra overall. Reusing a suite after examining its errors makes it development evidence. Only the six further requests are new to this test.

As a final reference, run the isolated TLDR and ID prompt and the complete source-editing candidate head to head on operations and fresh set B under the same rubric. This measures the remaining cost of carrying the workflow instructions on these requests. It is separate from the comparison against the current full prompt.

## What the first rewrite changed

On the specific two-finding request, changing only the original label example moved Opus from one to two passes out of two. Across the whole suite Opus still scored 6/12 on both arms. The larger rewrite gave a reproducible operational gain, from 3 to 11 and from 7 to 11. The receipt handoff passed in all four rewritten answers and none of the four controls. Each half also helped independently on that suite. With only the new prose, Opus went from 8 to 11; with only the new examples it went from 3 to 10. A direct transfer comparison between the new prose alone and the whole rewrite finished 9 to 9.

The first fresh suite exposed a remaining problem with requested detail. Both rewritten gallery handovers supplied all steps but repeated the transitions or added another reporting duty. Both librarian explanations claimed the due-date slip was the borrower's only record or could never be corrected. The original blind totals on that suite were Opus 8 → 7 and Astra 11 → 10. Applying the fixture’s declared ID mapping to the glass case alone changes the totals to Opus 6 → 5 and Astra 11 → 12. The original joint scores and reviewer explanations remain in the [round ledger](../summary.html#answers-evidence-05-fresh-opus).


One of four source-editing Opus conversations omitted IDs from every maintenance-chat draft. To distinguish omission at introduction from forgetting an established ID, a final fixed variant adds one sentence placing the bold IDs inside a draft containing multiple independent findings, actions or options. Repeat the native conversations and all four single-turn comparisons against the unedited control. Keep the same acceptance criteria and archive the result regardless of outcome. These are replications on known suites, not additional unseen requests.

## Final untouched requests

Freeze the draft-ID variant and test it once more against the same full control on [six new requests](frozen-holdout.json). They cover a bounded count, a public correction, two editorial findings, observation time, conditional instructions and reordered booking options. Keep the existing source-editing rubric and two samples per model and arm. Report this suite separately, including any regression. This is the last comparison and its results do not select another wording.

## Reproduction

Run `sections/prompts.py` to materialize the exact control and candidates. Each round directory records the two snapshot names, suite, rubric and SHA-256 digests. Follow the [clean-directory procedure](clean-path.md#reproduction) with the recorded rubric for both models and the blind judge. For the native continuity experiment, run `REPLY_EVAL_CLAUDE_BIN=cl-envoy uv run --no-project python -B docs/internal/references/reply-eval/id_continuity.py OUTPUT --raw PRIVATE_LOG_DIRECTORY` from the checkout. The runner launches in fresh system-temp workspaces, resumes each conversation by its own native ID, and retains the complete native transcript, per-turn stdout and stderr, reply and ancestor inventory. The published records contain the four answers and hashes of those originals.
