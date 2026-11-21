# Testing and coverage

## Select checks by impact

Compute is the binding constraint. Spend the least test time that gives the same assurance as the full suite. A test's result can change only when one of its transitive inputs changed: source, fixtures, generated or embedded content, schemas, configuration, dependencies, toolchains, and test infrastructure. Run exactly those tests; an unaffected test's last passing result stands. File extensions are not an impact model.

- Run no application tests for instruction-only or documentation-only changes that do not affect application behavior, artifacts, or test inputs. A document consumed as a parsing fixture or build input needs the checks for that consumer. Apply relevant instruction, link, or generation validation separately.
- Select the smallest sufficient test cases, packages, components, and integration boundaries. A front-end-only change never runs server tests, and a server-only change never runs front-end, browser or story tests. Code imported by both sides, such as shared types, schemas or generated clients, selects the tests of each consumer that imports it, and nothing more.
- Trace uncertain dependencies before choosing a broader scope. If the affected boundary remains unknown, run the smallest enclosing suite that covers it and record the uncertainty; do not default to the whole repository merely because selection takes investigation.
- Reuse successful evidence only while its relevant inputs, dependencies, environment, and selection remain valid. The final gate before landing is the affected set for the whole change against its base, not the full suite. Run the full suite only when the change reaches every test's inputs, such as a toolchain, root configuration or lockfile change that every package depends on, or when impact cannot be established for the whole repository. Broaden scope only for demonstrated cross-cutting impact, never as a ritual after focused checks pass. Do not rerun unchanged coverage through both test and aggregate recipes.
- Apply the same input-based selection to lint, typechecking, builds, and other checks. Preserve executable hooks and protected gates; change their selection through the authorized repository workflow rather than bypassing them. Reconcile blanket run-everything instructions with this policy when maintaining those instructions.

## Design for fast feedback

Expose independently runnable component and test targets. Keep fast behavior checks separate from expensive integration, browser, native-device, and end-to-end suites; use the least expensive layer that proves the required behavior. Share costly setup only where isolation remains sound, reuse valid build/dependency caches, and run independent checks concurrently within resource limits. Remove redundant setup, duplicate coverage runs, unnecessary sleeps and unrelated service startup. Never trade assertions, isolation, required platforms, or failure visibility for speed.

## Set up affected-test selection

Every project's test setup provides a `test-affected` recipe under the [task automation contract](cli/best-practices.md#task-automation-justfile), and CI runs the same selection against the pull request's merge base. When a project lacks it, add it before relying on manual selection.

- Build selection from the real dependency graph: workspace package dependencies, the module import graph, and the runner's native related-test or changed-file selection where the installed version provides it. Verify each runner option against its installed help or documentation.
- Map non-source inputs to their consumers: fixtures, snapshots, schemas, generated code, environment files, test helpers, and per-package configuration. Root configuration, lockfile and toolchain changes select every package that consumes them.
- Handle renames and deletions by selecting the consumers of the old path.
- When impact cannot be determined for a changed file, select its enclosing package, not the repository, and print why.
- Keep client and server suites, and fast unit checks and expensive browser, integration and end-to-end suites, in separately selectable targets so selection never forces an unrelated suite to run.
- Verify the selector with representative changes before it replaces an existing gate: a front-end-only change selects no server tests, a server-only change selects no front-end tests, a shared module selects both consumers, and a fixture change selects its tests.
- Keep the full-suite `test` recipe for the cases the final-gate rule above allows.

## Measure and report

Measure elapsed wall-clock time for every test invocation, including failed runs and retries. Preserve the command's exit status. Use the runner's trustworthy command duration or a monotonic timer around the command; include setup/build time in the command total and distinguish it from test execution when separate timings are available. Identify cache hits instead of presenting them as fresh execution.

Record the command, selected scope, result, and measured duration in the task evidence and completion report. For parallel commands, report each duration and the actual elapsed validation window rather than summing them as wall time. When no tests apply, report that no tests ran and the impact-based reason; do not invent a duration. Use existing per-suite/test timing output to identify dominant costs and compare like-for-like environments before claiming a regression. Add history or alert infrastructure only through an authorized tooling change.

## Coverage and integrity

For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. A filtered run does not establish package-wide coverage unless the measurement covers that denominator; reuse valid evidence or run the affected package's coverage gate when needed, without testing unrelated packages. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair. Do not weaken coverage gates or make token test edits to satisfy this rule. Apply the POC workflow when its conditions hold.

Instruction-maintenance work does not require implementing newly specified enforcement to finish. Record those gaps as follow-up work, run checks applicable to the actual changes, and do not claim unverified compliance.
