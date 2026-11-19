# Which instructions change reply behavior?

Freeze the [isolated TLDR and ID rules](../tuning/v3.md) and the [deployed system prompt](../../../../../system/system.md) at the commit recorded in [prompts.py](prompts.py). Every trial uses native instruction files, two fresh replies per case and arm, medium effort, and the established six-case [transfer suite](../transfer.json) unless indicated otherwise. Opus 5.5 runs through cl-envoy and Astra 6.2 through Codex. The existing blind Astra reviewer grades shuffled, deduplicated answers for completeness, concision and addressability. Joint passes require all three. Each round has its own contemporaneous control.

## Comparisons

- Add each of eight blocks individually to the isolated rules. Preserve their source wording and relative order. Personality includes the boundary on using its tone in drafts. Audience is the paragraph on technical sophistication and tradeoffs.
- Compare the isolated rules with all eight blocks combined. This composition substitutes revision 3 for the deployed reply rules and ending examples. Compare the isolated rules separately with the unmodified deployed file, with its closing examples appended, and with its old reply rules and examples alone.
- Repeat both combined and deployed comparisons on a [second suite](triggers.json) written before looking at the results. These cases exercise recovery, due diligence, parked work, recorded decisions, publication status and queue handoffs.
- Select a suspect from the individual additions by lost joint passes on the historically weaker model, checking case-level reasons, length and the other model. Reverse the intervention by removing it from the combined prompt. Treat an effect that disappears or reverses on retest as inconclusive. Agreement across different requests matters more than two repeats of one request.

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
