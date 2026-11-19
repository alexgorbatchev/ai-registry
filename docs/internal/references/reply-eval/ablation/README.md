# Shared prompt ablation

The deployed shared prompt is pinned at commit `65c2fa3`, SHA-256 `088877ac92777d36159a845e20bb2cd01014535138b0b19b4d38179be1517225`. Each variant used the same native CLI base instructions, empty work directory, tool restrictions and isolated instruction-file loading path as the verified replay.

| Run | Baseline | Candidate |
| --- | --- | --- |
| scope | [Zero-byte shared file](blank.md) | [TLDR](tldr.md) |
| context | Full deployed file | [TLDR + IDs](tldr-ids.md) |

TLDR retains the brevity rules and examples that can stand alone without IDs. TLDR + IDs restores the deployed ID rules and labeled examples in their original order. The full prompt additionally includes personality and audience guidance, Agent Pages, operating rules, Git authorization, failure investigation, implementation integrity and due diligence. The full versus TLDR + IDs comparison measures removing these sections together.

Both models generated two fresh replies per arm on each of the same six [transfer cases](../transfer.json). The runner alternated arm order. The six blind Astra grading calls shuffled all four arms and both models together within each case, grading exact duplicate replies once. Word counts use whitespace. The [HTML report](../summary.html) includes the outcome, individual replies and judgments. Handoff ID scores cover the one case that explicitly requires preserving a prior ID and assigning a new one. This suite supplies the previous IDs in the request and does not test recall over a live session.

## Results

| Model | Variant | Mean words | Passed all three | Handoff IDs |
| --- | --- | ---: | ---: | ---: |
| Astra 6.2 | Blank | 42.8 | 9/12 | 0/2 |
| | TLDR | 24.8 | 10/12 | 0/2 |
| | TLDR + IDs | 26.9 | 12/12 | 2/2 |
| | Full | 29.7 | 9/12 | 2/2 |
| Opus 5.5 | Blank | 185.1 | 0/12 | 0/2 |
| | TLDR | 53.9 | 7/12 | 0/2 |
| | TLDR + IDs | 58.0 | 8/12 | 2/2 |
| | Full | 97.3 | 5/12 | 2/2 |

Keeping only TLDR and IDs increased the blind pass count by three replies on each model. Both instruction sets handled the explicit handoff IDs correctly. On Opus, most of the length difference came from the release explanation, which averaged 395 words under the full prompt and 201 with TLDR + IDs. The six repeated cases and single judge limit generalization. Identifying an individual interfering section would require varying it separately.

## Reproduce

From the repository root, extract the full control and run both comparisons with the existing runner. Use a fresh output directory to preserve this sample.

```sh
ev=docs/internal/references/reply-eval
work=$(mktemp -d .state/reply-eval/ablation.XXXXXX)
git show 65c2fa3:system/system.md > "$work/full.md"
for pair in scope context; do
  case "$pair" in
    scope) base="$ev/ablation/blank.md"; candidate="$ev/ablation/tldr.md" ;;
    context) base="$work/full.md"; candidate="$ev/ablation/tldr-ids.md" ;;
  esac
  for model in gpt-6.2-astra claude-opus-5-5; do
    case "$model" in
      gpt-*) provider=codex; alias=astra ;;
      claude-*) provider=claude; alias=opus ;;
    esac
    REPLY_EVAL_CLAUDE_BIN=cl-envoy just reply-eval --provider "$provider" --model "$model" \
      --effort medium --repeat 2 --jobs 6 --suite "$ev/transfer.json" \
      --baseline "$base" --candidate "$candidate" --output "$work/$pair-$alias.jsonl" || exit 1
  done
done
mkdir "$work/combined"
uv run --no-project python -B "$ev/review_replay.py" "$work/combined" "$ev/transfer.json" --responses "$work"/*.jsonl
```

Each JSONL header records the selected prompt and suite digests. Each scored reply links to its private native session by raw attempt ID. The [receipt index](raw-index.json) fingerprints the retained attempts. In the blank condition the verifier requires the actual user request in the native transcript and either zero instruction-file entries or one empty entry. The two providers used medium effort as requested. Claude's envelope confirms model identity and does not independently attest to effective effort.
