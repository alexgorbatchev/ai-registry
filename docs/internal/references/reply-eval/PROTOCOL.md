---
created_on: 2026-11-18 19:08
last_modified: 2026-11-18 19:28
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

The following shell commands reconstruct the inputs for any numbered round and generate new samples on both models concurrently. Set `round` to the desired comparison. The prompt hashes and suite hash in the saved headers identify the exact inputs. Model outputs can vary between invocations.

```sh
round=07
eval_dir=docs/internal/references/reply-eval
mkdir -p .state/reply-eval
run_dir=$(mktemp -d .state/reply-eval/run.XXXXXX)
git show 940a2ca:system/system.md > "$run_dir/baseline.md"
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
esac
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

Rebuild the checked-in HTML from the saved files with `just reply-eval-report`.

The [older pilot](PILOT.md) uses a chat-completions endpoint. To run that transport, set `REPLY_EVAL_BASE_URL` to the API base, set `REPLY_EVAL_API_KEY` in the environment and pass `--provider chat --model MODEL`. Compare arms within each provider.

## Interpret

Each arm gets two fresh responses per case. Launch order alternates by case and reverses on the next repetition. With multiple workers, the file records completion order. The model receives the request without the rubric. Cases describe earlier decisions in the request itself. This measures reconstruction of supplied context. Long-session recall, Agent Pages integration, installed harness prompts, and tool execution need separate evidence.

The JSONL file records prompt and suite hashes, reported model names, the original responses, whitespace word counts and each automatic miss. A stream that ends early is a partial run. A complete run has one header plus one response per arm, case and repetition. Use `--check` when any automatic miss should fail the command. By default a completed comparison exits successfully so a failing baseline can be measured.

The word limits in `cases.json` apply only to their individual questions. The detail request has no length ceiling. The mechanical grader checks expected concepts, excluded details, and bold IDs at the start of an item, including IDs inside a bold heading or in the first table cell. A short answer that drops a required fact fails. Exact patterns can reject valid paraphrases and cannot establish factual correctness or whether an ID labels the right point.

Before promoting a candidate, read shuffled responses with arm labels hidden. Verify that each retained point matters, each independent action or decision has a usable ID, and old IDs still name the same things. For the recovery case, check all three steps in sequence and the reason for each. Report mechanical results and reading disagreements separately. Keep the original responses when revising a grader. Check a promising change on fresh cases and the affected model before shipping it.
