# Which instructions change reply behavior?

Freeze the [isolated TLDR and ID rules](../tuning/v3.md) and the [deployed system prompt](../../../../../system/system.md) at the commit recorded in [prompts.py](prompts.py). Every trial uses native instruction files, two fresh replies per case and arm, medium effort, and the established six-case [transfer suite](../transfer.json) unless indicated otherwise. Opus 5.5 runs through cl-envoy and Astra 6.2 through Codex. The existing blind Astra reviewer grades shuffled, deduplicated answers for completeness, concision and addressability. Joint passes require all three. Each round has its own contemporaneous control.

## Results

The full prompt made Opus 5.5 more verbose on both suites. On transfer, the deployed prompt took Opus from 10/12 joint passes to 6/12 and from 44.7 to 83.4 mean words (median 25.5 to 36.5). Both release-process explanations exceeded 290 words. On the operational requests it went from 9/12 to 6/12 and 19.8 to 24.0 mean words. Astra scored 12/12 in both transfer arms and 9/12 to 10/12 on the operational comparison. Substituting revision 3 into the full context still took Opus from 8/12 to 6/12 on transfer and 10/12 to 4/12 on the operational requests.

| Section or change | What the replies did | What the removal established |
| --- | --- | --- |
| Operating Instructions | Adding this section alone cost each model three joint passes on the operational suite. Both Opus receipt handoffs repeated that no work remained after reporting completion. | Removing the section gained one Opus pass in each full prompt (7/12 to 8/12 in both). Both deployed-minus-operating handoffs still added “No further action”. It contributes on these requests, but other instructions can produce the same behavior. |
| Personality | The largest single-block transfer loss on Opus was 11/12 to 8/12. One reply called an unidentified worker a “coin flip”; another added “however long you stare at it.” | Removing personality left Opus's joint score unchanged in both contexts (6/12 to 6/12 with revision 3, 5/12 to 5/12 with deployed wording). It explains particular asides, not the overall regression. |
| Failure Investigation and Recovery | Both Opus operational replies about a possible OOM kill enumerated diagnostic records after the user asked only for the finding. | Removing recovery lost two Opus passes in each comparison (6 to 4 on transfer, 5 to 3 on deployed operational). The diagnostic wording is traceable; removing the section did not restore overall reply quality. |
| Audience, Agent Pages, Git, integrity and due diligence | On transfer, Opus changed by −1, −1, 0, +1 and −1 passes respectively. Due diligence alone scored 10/12 in both operational arms. | These one-block results do not identify a dominant cause. Live page creation was outside the experiment. |
| Closing examples and ordering | Appending just the deployed closing examples improved Opus from 8/12 to 10/12 and reduced mean words from 47.8 to 39.9. The old reply rules plus examples alone also held up (8/12 to 9/12). | Moving identical revision 3 text to the end of the combined prompt yielded 5/12 to 4/12; it did not rescue the combined prompt. |

Removing personality, audience and Agent Pages together from the combined prompt moved Opus from 7/12 to 8/12. Removing the five work sections as a group moved it from 7/12 to 5/12. No individual or group removal restored the isolated result consistently. These were separate matched rounds with fresh controls. Even the identical isolated transfer control ranged from 7 to 11 Opus passes.

**ID behavior.** All 336 replies with explicit ID pairs contained the expected two bold IDs in order, including skipped numbers and nested options. These came from four distinct requests repeated across models and arms. The remaining addressability problem was unsolicited material: in the paired deployed transfer round, an incident notice promised a follow-up twice without giving that promise its own ID. A structural prefix check cannot detect an invented commitment. The cases supply history inside one user message, so this does not establish retention across a long live conversation.

**Scoring limitation.** The keyboard handoff admits two readings: the automatic check requires the passing keyboard test as evidence for the Save fix, while some blind reviews assigned it to the parked keyboard review. Excluding that case preserves the direction of both main operational Opus comparisons (9/10 to 3/10 for adding all eight blocks, 8/10 to 5/10 for the deployed file). All archived scores retain the original grading.

The [offline report](../summary.html#system-sections) contains 26 rounds and 1,248 scored replies. Each score opens the prompts, both arms, individual grades and links to the original JSONL. The 156 blind grading calls have separate native-log receipts.

## Comparisons

- Add each of eight blocks individually to the isolated rules. Preserve their source wording and relative order. Personality includes the boundary on using its tone in drafts. Audience is the paragraph on technical sophistication and tradeoffs.
- Compare the isolated rules with all eight blocks combined. This composition substitutes revision 3 for the deployed reply rules and ending examples. Compare the isolated rules separately with the unmodified deployed file, with its closing examples appended, and with its old reply rules and examples alone.
- Repeat both combined and deployed comparisons on a [second suite](triggers.json) written before looking at the results. These cases exercise recovery, due diligence, parked work, recorded decisions, publication status and queue handoffs.
- Select a suspect from the individual additions by lost joint passes on the historically weaker model, checking case-level reasons, length and the other model. Reverse the intervention by removing it from the combined prompt. Treat an effect that disappears or reverses on retest as inconclusive. Agreement across different requests matters more than two repeats of one request.

The follow-up rounds tested removal of operating instructions, recovery and personality from the reconstructed and deployed prompts. A position control moved the same reply rules to the end. Two final comparisons removed all three surrounding communication blocks or all five work sections together.

These are simulated single-turn replies. The runners disable tools, so the experiment measures how the instructions affect what the models say. It does not measure repository operations or whether a live Agent Page was created. The same model judges all rounds. Differences between independent generations can include ordinary sampling and grader variation.

## Reproduction

From the repository root:

```sh
ev=docs/internal/references/reply-eval
work=.state/reply-eval/sections
uv run --no-project python "$ev/sections/prompts.py" "$work/prompts"
name=add-recovery
mkdir -p "$work/$name"
for alias in astra opus; do
  case "$alias" in
    astra) provider=codex; model=gpt-6.2-astra ;;
    opus) provider=claude; model=claude-opus-5-5 ;;
  esac
  REPLY_EVAL_CLAUDE_BIN=cl-envoy just reply-eval --provider "$provider" --model "$model" \
    --effort medium --jobs 4 --repeat 2 --baseline "$work/prompts/v3.md" \
    --candidate "$work/prompts/recovery.md" --suite "$ev/transfer.json" \
    --output "$work/$name/$name-$alias.jsonl" || exit 1
done
uv run --no-project python -B "$ev/review_replay.py" "$work/$name" "$ev/transfer.json"
```

The checked-in JSONL contains every scored answer and its raw attempt ID. Each round also contains the blind judgments and an index of SHA-256 fingerprints for the privately archived native transcripts, requests and process output, including failed attempts.
