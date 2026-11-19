---
created_on: 2026-11-18 19:08
last_modified: 2026-11-18 20:14
status: current
---

# Concise replies and reply IDs

Maintainers can use these paired trials to check whether a change to the shared communication rules makes replies shorter while preserving the requested facts and reply IDs. The [round notes](rounds/NOTES.md) identify the candidate, suite, and outcome of each comparison. The [HTML report](summary.html) includes the saved answers.

## Reproduce a comparison

Run `just reply-eval-test` from the registry root to test the grader and runner offline. To score a saved comparison, supply the suite named in the round notes. Regrading validates that every arm, case and repetition occurs exactly once.

```sh
eval_dir=docs/internal/references/reply-eval
just reply-eval --regrade "$eval_dir/rounds/05-opus.jsonl" --suite "$eval_dir/verify.json"
```

The following shell commands reconstruct the inputs for first-pass rounds 01 through 12 and generate new samples on both models concurrently. Set `round` to the desired comparison. The prompt hashes and suite hash in the saved headers identify the exact inputs. Model outputs can vary between invocations.

```sh
round=12
eval_dir=docs/internal/references/reply-eval
mkdir -p .state/reply-eval
run_dir=$(mktemp -d .state/reply-eval/run.XXXXXX)
baseline_ref=940a2ca
case "$round" in
  01)  change=candidate.patch; suite=cases.json; jobs=1 ;;
  02)  change=rounds/revision-02.patch; suite=cases.json; jobs=6 ;;
  02b) change=rounds/revision-02b.patch; suite=cases.json; jobs=6 ;;
  03)  change=rounds/revision-02b.patch; suite=holdout.json; jobs=8 ;;
  04)  change=rounds/revision-04.patch; suite=holdout.json; jobs=8 ;;
  05)  change=rounds/revision-04.patch; suite=verify.json; jobs=8 ;;
  06)  change=rounds/revision-06.patch; suite=verify.json; jobs=8 ;;
  07)  change=rounds/revision-06.patch; suite=final.json; jobs=8 ;;
  08)  change=rounds/revision-06.patch; suite=cases.json; jobs=8 ;;
  09) baseline_ref=aa692f8; change=rounds/revision-09.patch; suite=final.json; jobs=8 ;;
  10) baseline_ref=aa692f8; change=rounds/revision-09.patch; suite=challenge.json; jobs=8 ;;
  11) baseline_ref=aa692f8; change=rounds/revision-11.patch; suite=challenge.json; jobs=8 ;;
  12) baseline_ref=aa692f8; change=rounds/revision-11.patch; suite=transfer.json; jobs=8 ;;
esac
git show "${baseline_ref}:system/system.md" > "$run_dir/baseline.md"
patch -s -o "$run_dir/candidate.md" "$run_dir/baseline.md" < "$eval_dir/$change"

run_model() {
  just reply-eval --provider "$1" --model "$2" --effort medium --repeat 2 \
    --jobs "$jobs" --suite "$eval_dir/$suite" --baseline "$run_dir/baseline.md" \
    --candidate "$run_dir/candidate.md" --output "$run_dir/$3.jsonl"
}
run_model claude claude-opus-5-5 opus > "$run_dir/opus.log" 2>&1 &
opus_pid=$!
run_model codex gpt-6.2-astra astra > "$run_dir/astra.log" 2>&1 &
astra_pid=$!
wait "$opus_pid"; opus_status=$?
wait "$astra_pid"; astra_status=$?
test "$opus_status" -eq 0 && test "$astra_status" -eq 0
```

Each provider needs a working CLI login. To run Claude through an authenticated wrapper, set `REPLY_EVAL_CLAUDE_BIN` to its executable before starting the comparison. Otherwise the runner invokes `claude`. Codex uses an ephemeral read-only scratch directory, the supplied instructions in a file, disabled shell tools and medium reasoning. Round 01 predates the shell-tool restriction, and some first-round trials predate the parallel runner. Claude uses explicit system instructions, safe mode, an empty tool list, strict MCP configuration and no saved session. Claude reports model usage, while effective reasoning effort is unavailable in its result envelope. Managed settings may still apply.

For a partial run, repeat its generation command with the same output path and add `--resume`. The runner preserves completed rows, rejects changed inputs and writes each new result as it arrives. Keep stderr with the attempt so a missing row can be traced. For a new proposal, supply its complete prompt to `--candidate`. The default baseline is the current `system/system.md`. Omitting the candidate runs only the baseline.

## Reproduce the editing pass

Rounds 13 and 14 compare each saved baseline reply with a fresh revision of that same text. The editor receives the original request and its draft as a JSON object and uses [the editor instructions](editor.md) as its entire system prompt. Each edit has one model call. The baseline needs none. The source is round 10 for round 13 and round 12 for round 14.

```sh
round=14
eval_dir=docs/internal/references/reply-eval
mkdir -p .state/reply-eval
run_dir=$(mktemp -d .state/reply-eval/edit.XXXXXX)
case "$round" in
  13) source_round=10; suite=challenge.json ;;
  14) source_round=12; suite=transfer.json ;;
esac
edit_model() {
  just reply-eval --provider "$1" --model "$2" --effort medium --jobs 8 --repeat 2 \
    --suite "$eval_dir/$suite" --editor "$eval_dir/editor.md" \
    --edit-source "$eval_dir/rounds/$source_round-$3.jsonl" --output "$run_dir/$3.jsonl"
}
edit_model claude claude-opus-5-5 opus > "$run_dir/opus.log" 2>&1 &
opus_pid=$!
edit_model codex gpt-6.2-astra astra > "$run_dir/astra.log" 2>&1 &
astra_pid=$!
wait "$opus_pid"; opus_status=$?
wait "$astra_pid"; astra_status=$?
test "$opus_status" -eq 0 && test "$astra_status" -eq 0
```

Rounds 15 and 16 send the same saved Opus drafts to Astra for editing. Specify the expected source provider and model explicitly. Both generation and editing used medium effort. Each command below generates only the 12 edited replies for that round.

```sh
round=16
eval_dir=docs/internal/references/reply-eval
mkdir -p .state/reply-eval
run_dir=$(mktemp -d .state/reply-eval/cross-edit.XXXXXX)
case "$round" in
  15) source_round=10; suite=challenge.json ;;
  16) source_round=12; suite=transfer.json ;;
esac
just reply-eval --provider codex --model gpt-6.2-astra --effort medium --repeat 2 --jobs 8 \
  --source-provider claude --source-model claude-opus-5-5 \
  --edit-source "$eval_dir/rounds/$source_round-opus.jsonl" --editor "$eval_dir/editor.md" \
  --suite "$eval_dir/$suite" --output "$run_dir/$round-astra-editor.jsonl"
```

The saved header records the source filename and its SHA-256, the original generation prompt hash, the editor prompt hash and the suite hash. Each edited reply carries its source draft's hash and matches the copied baseline by case and repetition. The runner rejects incompatible source model, provider, effort, suite and repetitions. Resume an interrupted edit with the same inputs and `--resume`. Generated rows include elapsed time and provider-reported cost where available.

### Production boundary

Same-model and cross-model editing are experiments. The source draft and latest request contain the evidence needed for these fixtures. A live conversation can rely on ID assignments made several turns earlier, tool results proving a change succeeded or a decision link absent from the latest turn. An editor receiving only the fixture inputs could lose those facts. A cross-provider editor also receives both the user's request and the draft. These trials configure no global editing hook.

Claude Code's `turn.complete` extension point can display returned text below the answer and preserves the original transcript. A blocking `Stop` hook can give feedback and continue the turn. Neither behavior implements the draft-to-final replacement measured here. See the [pinned `turn.complete` contract](https://github.com/anthropics/claude-code/blob/20747d886ccf274207383de127b1abc404364d50/mods/types/claude-code.d.ts#L5667-L5677) and [Stop hook reference](https://code.claude.com/docs/en/hooks#stop).

Rebuild the checked-in HTML from the saved files with `just reply-eval-report`.

The [older pilot](PILOT.md) uses a chat-completions endpoint. To run that transport, set `REPLY_EVAL_BASE_URL` to the API base, set `REPLY_EVAL_API_KEY` in the environment and pass `--provider chat --model MODEL`. Compare arms within each provider.

## Interpret

Each arm gets two fresh responses per case. Launch order alternates by case and reverses on the next repetition. With multiple workers, the file records completion order. The model receives the request without the rubric. Cases describe earlier decisions in the request itself. This measures reconstruction of supplied context. Long-session recall, Agent Pages integration, installed harness prompts, and tool execution need separate evidence.

The JSONL file records prompt and suite hashes, reported model names, the original responses, whitespace word counts and each automatic miss. A stream that ends early is a partial run. A complete run has one header plus one response per arm, case and repetition. Use `--check` when any automatic miss should fail the command. By default a completed comparison exits successfully so a failing baseline can be measured.

The word limits in `cases.json` apply only to their individual questions. The detail request has no length ceiling. The mechanical grader checks expected concepts, excluded details, and bold IDs at the start of an item, including IDs inside a bold heading or in the first table cell. A short answer that drops a required fact fails. Exact patterns can reject valid paraphrases and cannot establish factual correctness or whether an ID labels the right point.

Before promoting a candidate, read shuffled responses with arm labels hidden. Verify that each retained point matters, each independent action or decision has a usable ID, and old IDs still name the same things. For the recovery case, check all three steps in sequence and the reason for each. Report mechanical results and reading disagreements separately. Keep the original responses when revising a grader. Check a promising change on fresh cases and the affected model before shipping it.
