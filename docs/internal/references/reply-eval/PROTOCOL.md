---
created_on: 2026-11-18 19:08
last_modified: 2026-11-18 19:08
status: current
---

# Concise replies and reply IDs

Use this suite when changing the shared communication rules. The six synthetic requests recreate failures observed in engineering conversations. They cover a narrow factual answer, completion of an approved action, a separate closing offer, a blocked progress update, explicitly requested detail, and a new finding alongside an existing one.

## Run

From the registry root, run `just reply-eval-test` to test the graders offline. For a live comparison, supply the two full system prompts and a new output path. This example reconstructs the pilot from Git without modifying the installed instructions.

```sh
mkdir -p .state/reply-eval
run_dir=$(mktemp -d .state/reply-eval/run.XXXXXX)
git show da15b5b:system/system.md > "$run_dir/baseline.md"
patch -s -o "$run_dir/candidate.md" "$run_dir/baseline.md" \
  < docs/internal/references/reply-eval/candidate.patch
just reply-eval --model claude-opus-5-5 --baseline "$run_dir/baseline.md" \
  --candidate "$run_dir/candidate.md" --output "$run_dir/claude.jsonl"
```

For a future proposal, pass its full prompt to `--candidate`. Omitting `--baseline` uses the working tree's `system/system.md`. Omitting `--candidate` runs one arm. Claude Code requires a valid login and CLI support for safe and restricted modes. Each request starts a fresh process with explicit system text, no built-in tools, no session persistence, and no configured MCP servers. Managed settings can still apply.

For a chat-completions endpoint, set `REPLY_EVAL_BASE_URL` to its API base (including the API version when required), set `REPLY_EVAL_API_KEY` in the environment, and pass `--provider chat --model MODEL`. Requests use only the selected system text and the case prompt. Keep providers separate when comparing results.

## Interpret

Each arm gets two fresh responses per case. Arm order alternates by case and reverses on the next repetition. The model receives the request without the rubric. Cases describe earlier decisions in the request itself. This measures reconstruction of supplied context. Long-session recall, Agent Pages integration, installed harness prompts, and tool execution need separate evidence.

The JSONL file records prompt and suite hashes, reported model names, the original responses, whitespace word counts and each automatic miss. A stream that ends early is a partial run. A complete run has one header plus one response per arm, case and repetition. Use `just reply-eval --regrade PATH` to apply the current grader to a saved complete run without making model calls. Use `--check` when any automatic miss should fail the command. By default a completed comparison exits successfully so a failing baseline can be measured.

The word limits in `cases.json` apply only to their individual questions. The detail request has no length ceiling. The mechanical grader checks expected concepts, excluded details, and bold IDs at the start of an item, including IDs inside a bold heading or in the first table cell. A short answer that drops a required fact fails. Exact patterns can reject valid paraphrases and cannot establish factual correctness or whether an ID labels the right point.

Before promoting a candidate, read shuffled responses with arm labels hidden. Verify that each retained point matters, each independent action or decision has a usable ID, and old IDs still name the same things. For the recovery case, check all three steps in sequence and the reason for each. Report mechanical results and reading disagreements separately. Keep the original responses when revising a grader. Check a promising change on fresh cases and the affected model before shipping it.
