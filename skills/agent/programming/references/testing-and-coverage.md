# Testing and coverage

## Select checks by impact

Minimize time to trustworthy feedback. Before running tests or other checks, trace the change through direct and transitive inputs to affected behavior and artifacts: source, fixtures, generated or embedded content, schemas, configuration, dependencies, toolchains, and test infrastructure. File extensions are not an impact model.

- Run no application tests for instruction-only or documentation-only changes that do not affect application behavior, artifacts, or test inputs. A document consumed as a parsing fixture or build input needs the checks for that consumer. Apply relevant instruction, link, or generation validation separately.
- Select the smallest sufficient test cases, packages, components, and integration boundaries. Client-only rendering changes need client checks and UI evidence, not unrelated server tests; include server or contract tests when shared interfaces, generation, or behavior connect them to the change.
- Trace uncertain dependencies before choosing a broader scope. If the affected boundary remains unknown, run the smallest enclosing suite that covers it and record the uncertainty; do not default to the whole repository merely because selection takes investigation.
- Reuse successful evidence only while its relevant inputs, dependencies, environment, and selection remain valid. Run broader suites for demonstrated cross-cutting impact or an applicable integration/release gate, not as a ritual after focused checks pass. Do not rerun unchanged coverage through both test and aggregate recipes.
- Apply the same input-based selection to lint, typechecking, builds, and other checks. Preserve executable hooks and protected gates; change their selection through the authorized repository workflow rather than bypassing them. Reconcile blanket run-everything instructions with this policy when maintaining those instructions.

## Design for fast feedback

Expose independently runnable component and test targets. Keep fast behavior checks separate from expensive integration, browser, native-device, and end-to-end suites; use the least expensive layer that proves the required behavior. Share costly setup only where isolation remains sound, reuse valid build/dependency caches, and run independent checks concurrently within resource limits. Remove redundant setup, duplicate coverage runs, unnecessary sleeps and unrelated service startup. Never trade assertions, isolation, required platforms, or failure visibility for speed.

When implementing automated selection, include transitive consumers and non-source inputs, handle renames/deletions and shared configuration, and provide a conservative fallback for unknown impact. Verify selection with representative affected and unaffected changes before replacing an existing gate. Keep a full-suite entry point for justified whole-project validation.

## Measure and report

Measure elapsed wall-clock time for every test invocation, including failed runs and retries. Preserve the command's exit status. Use the runner's trustworthy command duration or a monotonic timer around the command; include setup/build time in the command total and distinguish it from test execution when separate timings are available. Identify cache hits instead of presenting them as fresh execution.

Record the command, selected scope, result, and measured duration in the task evidence and completion report. For parallel commands, report each duration and the actual elapsed validation window rather than summing them as wall time. When no tests apply, report that no tests ran and the impact-based reason; do not invent a duration. Use existing per-suite/test timing output to identify dominant costs and compare like-for-like environments before claiming a regression. Add history or alert infrastructure only through an authorized tooling change.

## Coverage and integrity

For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. A filtered run does not establish package-wide coverage unless the measurement covers that denominator; reuse valid evidence or run the affected package's coverage gate when needed, without testing unrelated packages. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair. Do not weaken coverage gates or make token test edits to satisfy this rule. Apply the POC workflow when its conditions hold.

Instruction-maintenance work does not require implementing newly specified enforcement to finish. Record those gaps as follow-up work, run checks applicable to the actual changes, and do not claim unverified compliance.
