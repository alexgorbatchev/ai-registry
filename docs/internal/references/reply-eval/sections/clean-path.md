# Clean-directory replay

Does the full F16 prompt still change reply quality when the harness has no ancestor instructions to load? The control uses the [isolated TLDR and ID rules](../tuning/v3.md). The other arm uses the complete F16 text pinned in the [prompt builder](prompts.py). Each model answered each of six requests twice per arm on each suite. Opus 5.5 ran through cl-envoy and Astra 6.2 through Codex, both at medium effort. A blind Astra reviewer used the [rubric that accepts conversational sarcasm](mode-rubric.json).

## Results

Arrows run from isolated TLDR + ID rules to the pinned full F16 prompt. Each score counts replies passing completeness, concision and addressability together out of 12. Each model answered six distinct requests twice per suite.

| Model | Request suite | Joint passes | Mean words |
| --- | --- | ---: | ---: |
| Opus 5.5 | Operational | 12 → 6 | 19.8 → 26.8 |
| Opus 5.5 | Transfer | 10 → 5 | 46.5 → 77.3 |
| Astra 6.2 | Operational | 12 → 12 | 18.2 → 18.4 |
| Astra 6.2 | Transfer | 10 → 11 | 23.0 → 31.3 |

Opus produced the expected ID prefixes on all eight replies per arm that specified them. With F16, an incident handoff added diagnostic steps, a release explanation added an unsupported rollback guarantee, and a receipt handoff claimed ownership had been released. The Opus gap reproduced with zero ancestor instruction files across 96 generations and 12 blind reviews. That rules out ancestor files as a necessary cause of this result. The comparison does not isolate an individual F16 instruction. [Read the answers and grades](../summary.html#clean-path).

## Path verification

The launcher ran in a new directory under the physical system temporary directory, outside the checkout. Each CLI started in a fresh, empty work directory with a separate sibling configuration home containing the one intended instruction file. Immediately before executing each real CLI, a wrapper walked from its resolved working directory through the filesystem root and rejected any occurrence of `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, `CLAUDE.local.md` or `.claude/CLAUDE.md`. The same check applied to graders.

The [operational path records](clean-operational/ancestor-audit.json) and [transfer path records](clean-transfer/ancestor-audit.json) identify the checked working directory for each raw attempt. Verification matched each directory to its native transcript and checked the recorded instructions and user request against the intended inputs. The raw indexes fingerprint the original path checks and transcripts.

The two earlier comparisons also ran outside the checkout. All 108 of their generation and grading transcripts recorded working directories in the operating system's per-user temp directory. Those runs recorded the loaded instructions but did not take the new pre-launch ancestor inventory.

## Reproduction

Generate the pinned instruction files from the repository with `sections/prompts.py`. Create a new temporary directory outside the checkout, change into it, and set `TMPDIR` to its physical path. Run [the existing runner](../run.py) with absolute paths to the suite, output, baseline `v3.md` and candidate `deployed.md`. Use `--repeat 2 --jobs 4 --effort medium`, with `REPLY_EVAL_CLAUDE_BIN=cl-envoy` for Claude. Use [the operational suite](triggers.json) and [the transfer suite](../transfer.json). Grade each suite with [the reviewer](../review_replay.py) from the same temporary root and pass `--rubric` with the absolute path to `mode-rubric.json`.

To reproduce the ancestor check, wrap both CLI executables on the launcher's `PATH`. Immediately before invoking the underlying binary, resolve its current working directory, check the five names above there and in each parent, and fail on any match. Retain that inventory alongside the native log. Instructions come from the harness's isolated configuration home, which is beside its work directory and outside the ancestor chain.
