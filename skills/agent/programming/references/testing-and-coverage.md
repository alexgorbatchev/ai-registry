# Testing and coverage

For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair. Do not weaken coverage gates or make token test edits to satisfy this rule. Apply the POC workflow when its conditions hold.

Before running a test, lint, typecheck, coverage, build, or other check, compare changed files with its inputs: source, tests, fixtures, configuration, lockfiles, toolchain files, and documentation it compiles, embeds, or validates. Skip a check when none of its inputs changed and report why; run it when any input changed or the inputs cannot be determined. Never bypass hooks, CI, or other required gates to skip a check.

Instruction-maintenance work does not require implementing newly specified enforcement to finish. Record those gaps as follow-up work, preserve existing gates, and run checks applicable to the actual changes; do not claim unverified compliance.
