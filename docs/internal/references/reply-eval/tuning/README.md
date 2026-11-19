# Isolated TLDR and ID tuning

Only the experimental reply instructions vary. Both providers use their native base instructions, the isolated instruction-file verifier and medium effort. Opus runs through `cl-envoy`. The full shared prompt stays deployed.

The development suite is the six-case transfer set from the preceding ablation. Each comparison generates two new replies per arm, model and case. A blind Astra reviewer sees shuffled responses from both arms and models and grades completeness, concision and addressability. A pass requires all three. Mechanical checks run separately.

Choose the candidate with the most passes on the weaker model, using preserved ID behavior and completeness to decide close results. Check the selected prompt against the original isolated prompt on eight previously unused cases frozen before inspecting the first development results. An exploratory target for the fresh run is at least 14/16 passes per model with all explicit ID contracts preserved. A miss on this target is reported separately from comparative improvement. The cases simulate history within each request.

## Development comparisons

The baseline in every round is the [original isolated TLDR + IDs](../ablation/tldr-ids.md). Counts below are joint blind-review passes, baseline → candidate, out of 12.

| Revision | Change | Astra 6.2 | Opus 5.5 |
| --- | --- | ---: | ---: |
| [1](v1.md) | Condensed the original guidance and removed worked examples. Opus added parked work and unsupported follow-up claims. | 12 → 12 | 9 → 5 |
| [2](v2.md) | Chose content before IDs, reserved numbers for omitted items, and restored a worked example. Opus passed all mechanical checks but added diagnostic advice or unsupported retention behavior. | 12 → 12 | 8 → 9 |
| [3](v3.md) | Made the stopping point explicit and distinguished a supported consequence from a plausible addition. | 12 → 11 | 9 → 11 |

Revision 3 achieved the highest score on the weaker model. Its Opus miss was an unsupported guarantee about when a browser would receive a new manifest. Astra's miss was a reviewer objection to a single finding label grouping two facts in an incident notice. The original fixture allows an unlabelled audience-facing notice. These six cases were used to tune the wording.

## Reproduce a round

Use `transfer.json` and revision 1, 2 or 3 for the first three rounds. For the fresh comparison use `tuning/fresh.json` and revision 3. Run each model twice per arm through the existing CLI runner and grade both models together. For example, from the repository root:

```sh
ev=docs/internal/references/reply-eval
work=$(mktemp -d .state/reply-eval/tune.XXXXXX)
name=$(basename "$work")
suite="$ev/tuning/fresh.json"
for alias in astra opus; do
  case "$alias" in
    astra) provider=codex; model=gpt-6.2-astra ;;
    opus) provider=claude; model=claude-opus-5-5 ;;
  esac
  REPLY_EVAL_CLAUDE_BIN=cl-envoy just reply-eval --provider "$provider" --model "$model" \
    --effort medium --jobs 6 --repeat 2 --baseline "$ev/ablation/tldr-ids.md" \
    --candidate "$ev/tuning/v3.md" --suite "$suite" --output "$work/$name-$alias.jsonl" || exit 1
done
uv run --no-project python -B "$ev/review_replay.py" "$work" "$suite"
```

Each round's JSONL links its scored text to an isolated native transcript. The raw-index fingerprints the privately retained files for generation and review calls. The [HTML report](../summary.html) links the answers and individual judgments.

## Fresh confirmation

| Model | Joint passes, original → revision 3 | Mean words, original → revision 3 | Explicit ID cases, original → revision 3 |
| --- | ---: | ---: | ---: |
| Astra 6.2 | 16/16 → 16/16 | 22.5 → 21.9 | 8/8 → 8/8 |
| Opus 5.5 | 13/16 → 14/16 | 36.9 → 32.2 | 8/8 → 8/8 |

Revision 3 met the exploratory target and is the frozen experimental baseline for future section comparisons. All four model/arm combinations passed every mechanical check. Both revisions preserved the old ID, chose the next unused ID, put table IDs in the first column and retained nested option IDs. On the two Opus review misses, a rider notice repeated that an operational lift was available, and an explanation implied the original label was the only possible source for checking a lot number. The gain on unseen cases was one Opus reply; two samples per case and a single reviewer leave substantial sampling uncertainty.
