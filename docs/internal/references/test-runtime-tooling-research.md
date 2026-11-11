---
created_on: 2026-11-11 09:20
last_modified: 2026-11-11 09:23
status: current
---

# Test runtime tooling research

This report helps maintainers choose free, open-source tooling that records test runtimes and exposes suspicious changes to coding agents across Go, Rust, Bun/TypeScript, Python, and browser tests. It evaluates upstream documentation and source as of November 11, 2026. It does not install tooling, change test selection, or establish a mandatory timing policy. The proposed integrations remain untested locally.

## Recommendation

Start with **one command duration plus the test runner's existing machine-readable results for each required test invocation**. Retain those artifacts through existing local storage and CI artifact facilities. Do not repeat an entire suite merely to populate a timing database.

Pilot **Allure Report 3** where cross-language history and agent-readable reporting justify another dependency. Its local history and Agent Mode cover much of the reporting work without a paid service. Start with existing JUnit artifacts; adopt native Allure adapters only where their additional detail warrants the integration cost. Allure's built-in thresholds are useful guardrails, but they do not establish that a slowdown is statistically credible. [Allure Report source and Apache-2.0 license](https://github.com/allure-framework/allure3), [Agent Mode](https://allurereport.org/docs/agent-mode/)

Use **Hyperfine**, or **pyperf when its statistical comparison is useful**, for a bounded investigation after a suspicious timing change. Both operate locally on arbitrary commands. Adopt one investigation tool initially. Neither replaces normal test execution or provides an automatic cross-repository history service. [Hyperfine](https://github.com/sharkdp/hyperfine), [pyperf commands](https://pyperf.readthedocs.io/en/latest/cli.html)

This combination has no required paid SaaS dependency. Existing CI storage can still have infrastructure or retention costs. Do not deploy a new database, dashboard service, or custom test runner for the first experiment.

## Shortlist and tradeoffs

| Tool | License and deployment | Useful capability | Material limitation |
| --- | --- | --- | --- |
| Native results, with gotestsum where useful | Existing runners; gotestsum is Apache-2.0 and local | Per-test durations and outcomes; gotestsum retains Go event JSON and exports JUnit | History, environment grouping, and regression decisions remain integration work. [gotestsum](https://github.com/gotestyourself/gotestsum) |
| Allure Report 3 | Apache-2.0; local CLI and static reports | Cross-language results, local history, Agent Mode, duration limits and performance metric gates | Format fidelity varies; relative gates compare stored metric values rather than estimating timing noise. Allure TestOps is a separate product and is unnecessary here. [Source](https://github.com/allure-framework/allure3), [configuration](https://allurereport.org/docs/v3/configure/) |
| Hyperfine | MIT OR Apache-2.0; local binary | Repeated command measurements, warmups, preparation, JSON export | No durable baseline workflow or automatic regression gate. Version 2 changes its JSON format and executes commands without a shell by default; pin the version before writing consumers. [Source](https://github.com/sharkdp/hyperfine), [2.0 release](https://github.com/sharkdp/hyperfine/releases/tag/v2.0.0) |
| pyperf | MIT; local Python package | Arbitrary-command benchmarks, metadata, stability checks, statistical comparison of saved JSON | Python runtime dependency; history naming, revision identity, and CI decisions need integration. `compare_to` output should not be assumed to provide a fail-on-regression exit contract. [License](https://github.com/psf/pyperf/blob/main/COPYING), [CLI](https://pyperf.readthedocs.io/en/latest/cli.html), [comparison implementation](https://github.com/psf/pyperf/blob/main/pyperf/_compare.py) |
| github-action-benchmark | MIT; GitHub Actions, retained JSON/static history | Custom numeric JSON, comparison, workflow failure and job summaries | GitHub-specific; default alert ratio is 200% of the previous result, not a statistical test. Use only where this workflow already fits. [Source, inputs, and license](https://github.com/benchmark-action/github-action-benchmark) |
| Bencher | Core MIT OR Apache-2.0; proprietary Plus features; self-hostable | Persistent branch/testbed history, statistical thresholds, JSON CLI and alert exits | Free projects are public within the instance; private-project access controls require Plus. Standard self-hosted deployment contacts Bencher Cloud and sends statistics; opting out of daily statistics requires Plus. Not the default for private or offline repositories. [Licensing](https://bencher.dev/legal/license/), [pricing](https://bencher.dev/pricing/), [privacy](https://bencher.dev/legal/privacy/) |

Bencher is worth revisiting if centrally managed performance history becomes a demonstrated need and its access/telemetry model is acceptable. It supports sample windows and several statistical models, but a model cannot correct incompatible measurements. Its documented adapters include Hyperfine and Bencher Metric Format; per-test JUnit ingestion is not listed. A custom build or network-blocked deployment is not verified here. [Thresholds](https://bencher.dev/docs/explanation/thresholds/), [adapters](https://bencher.dev/docs/explanation/adapters/), [CLI alert handling](https://bencher.dev/docs/explanation/bencher-run/)

ReportPortal is another Apache-2.0 self-hosted option, but its multi-service deployment is disproportionate if the immediate need is runtime observation. Reuse an existing installation before considering a new one solely for timing. [Source and license](https://github.com/reportportal/reportportal), [deployment requirements](https://reportportal.io/docs/installation-steps/DeployWithDocker/)

## What each measurement actually means

**Command wall-clock duration** measures the delay experienced by the developer or CI job. Depending on the command boundary, that includes compilation, discovery, fixtures, process startup, retries, teardown, and reporting. Record the boundary explicitly. A wrapper around the entire command is portable across languages, but it cannot identify which test causes a change.

**Per-test duration** attributes time according to the runner's semantics. It may omit compilation and shared fixtures, include setup and teardown, or report attempts separately. Parallel test durations do not sum to command elapsed time. A command-only record must remain command-only: dividing its duration among tests fabricates precision.

| Ecosystem | Low-disruption collection | Interpretation and integration caveat |
| --- | --- | --- |
| Go | `go test -json`; optionally gotestsum `--jsonfile` and `--junitfile` | Event JSON identifies package/test and elapsed time. Distinguish cached results from execution. Deliberate comparison runs can use `-count=1` to disable test-result caching; build-cache state remains separate. gotestsum can inspect saved slow-test data without rerunning tests. [test2json](https://pkg.go.dev/cmd/test2json), [gotestsum](https://github.com/gotestyourself/gotestsum) |
| Rust | Existing nextest JUnit output, when nextest is already the runner; otherwise begin with command duration | nextest exports retry information and supports fixed slow-test warnings. These warnings are not learned regressions. Switching from `cargo test` deserves separate compatibility review, rather than being a prerequisite for timing. [JUnit](https://nexte.st/docs/machine-readable/junit/), [slow tests](https://nexte.st/docs/features/slow-tests/) |
| Bun / TypeScript | `bun test --reporter=junit --reporter-outfile=<path>` | Native JUnit includes durations and metadata, but lacks per-test stdout/stderr and precise per-test timestamps. Review exported hostname/CI properties before publishing artifacts. [Bun reporters](https://bun.sh/docs/test/reporters) |
| Python | pytest `--junitxml=<path>`; `--durations=N` for immediate diagnosis | JUnit duration defaults to setup, call, and teardown. Keep this setting stable across comparisons; call-only measurements are a different series. [pytest JUnit duration](https://pytest.org/en/latest/reference/reference.html#confval-junit_duration_report) |
| Browser / UI | Playwright JSON or JUnit alongside its existing reporter; preserve retries and project identity | JSON is useful when attempts and richer result details matter. Keep browser, project, worker count, retries, services, and shard composition comparable; merge shards before treating them as a complete run. [Playwright reporters](https://playwright.dev/docs/test-reporters) |

These are collection choices, not test-selection policies. Duration history can reveal expensive tests; it does not prove that a change can safely skip them. Dependency-aware selection, required checks, coverage, and periodic broad validation remain separate decisions. In particular, do not enable gotestsum's test-rewriting skip option merely to obtain its slow-test report.

## Allure pilot: useful features and hard edges

Agent Mode, available from version 3.12.0, can wrap a command with `allure agent -- <command>` or inspect existing results. It emits Markdown and machine-readable files covering results and execution context. Discover the installed interface with `allure agent capabilities --json`; avoid assuming internal output filenames remain stable. The pilot must verify that each chosen runner's artifacts are discovered and represented correctly. [Agent Mode](https://allurereport.org/docs/agent-mode/)

Allure's reader includes JUnit XML support. Its current implementation converts seconds to rounded milliseconds and derives identity from test/class names; it does not import arbitrary XML properties or all runner-specific retry extensions. Preserve raw artifacts, and verify identity collisions, sub-millisecond tests, metadata, and retry fidelity. This assessment uses an immutable source revision, not a claim about every released package. [JUnit reader source](https://github.com/allure-framework/allure3/blob/bf9bed5475627ab97b912d88e991e57aa625dd50/packages/reader/src/junitxml/index.ts)

Avoid blanket adoption of the native Bun adapter: its documented constraints reject concurrent and randomized execution and some test layouts. Changing test semantics just to obtain timing data defeats the purpose. Go and Rust native integrations also require test-source integration; existing machine-readable output is the lower-disruption starting point. [Bun integration constraints](https://allurereport.org/docs/bun/), [Go integration](https://allurereport.org/docs/go/), [Rust integration](https://allurereport.org/docs/rust/)

`historyPath` stores local JSONL history. `appendHistory: false` permits reading without appending, and `historyLimit` bounds retained entries. Separate histories or explicit environment identity prevent unlike runs from sharing a baseline. Treat concurrent writes as an integration concern until tested. [Allure configuration](https://allurereport.org/docs/v3/configure/)

Quality gates include absolute test-duration limits and performance-metric deltas against the previous stored run. A missing previous metric passes; a missing current metric fails. Gates consider the latest retry, so they cannot alone account for all retry cost. **A configured gate determines the wrapped `allure run` exit status**, including allowing some failed tests if configured that way. Preserve the underlying command's failure independently; exercise setup failures, signals, timeouts, and missing reports before trusting a wrapper in CI. [Quality gate behavior](https://allurereport.org/docs/quality-gate/)

Relative performance gates require performance metric inputs; do not assume that ordinary test durations automatically become these metrics. Allure accepts numeric performance JSON and averages values sharing a metric key. Use separate stable keys for distinct commands or tests. Any conversion is a small, explicit integration task, not a supplied statistical timing detector. [Performance metric format](https://allurereport.org/docs/performance-metrics/)

## Comparable history and useful alerts

The following is a proposed integration contract, not a claim that one shortlisted tool implements it automatically.

Retain enough context to reproduce a comparison:

- Repository and task identity, actual command and working-directory scope, selected tests or selection digest, test count, and runner/report schema version.
- Revision, branch, dirty-worktree status, and baseline revision. A commit hash alone does not identify an edited working tree.
- Runner class, OS/architecture, runtime/compiler and browser versions, worker count, coverage/instrumentation, cache mode, and relevant service/fixture configuration. Prefer anonymous stable environment identifiers over personal machine names.
- Start time, command elapsed time, outcome, exit/signal/timeout, retries, cached/skipped/missing results, measurement units and precision, and raw artifact paths.

Store raw results outside source control by default, using an ignored local directory and existing CI artifacts. Check in small configuration and deliberately approved baseline metadata only where useful. Give retention and concurrent writes explicit ownership; separate per-run files avoid a shared append target becoming accidental infrastructure. Record failed and timed-out runs for diagnosis without silently admitting them to a passing-runtime baseline.

A warning needs both a meaningful change and evidence beyond noise. Calibrate an absolute slowdown floor, relative threshold, minimum comparable sample count, and environment-specific variation during the pilot. Use command-level alerts first; thousands of independent per-test comparisons create many opportunities for false alarms. Treat heavily parallel or externally dependent tests as noisier measurements.

Use a bounded, controlled comparison to investigate a warning: match scope and environment, distinguish warm and cold runs, and compare base and candidate revisions. Hyperfine supplies repeated command samples. pyperf adds stability checks and statistical comparison, but its comparison implementation treats a pair of single values as significant and has fallback behavior for statistical calculation errors. Do not turn that printed label into an unattended gate without validating the samples and result. [Hyperfine usage](https://github.com/sharkdp/hyperfine), [pyperf stability guidance](https://pyperf.readthedocs.io/en/latest/system.html), [pyperf comparison source](https://github.com/psf/pyperf/blob/main/pyperf/_compare.py)

Keep candidate observations separate from baseline promotion. Promote a successful, representative default-branch run only after an intentional change or confirmed stable environment is accepted. Retain the previous baseline and explain resets. A rolling baseline alone can normalize gradual degradation; a pinned accepted reference provides a second view. Changes in test selection, instrumentation, or runner class create a new comparison group rather than an apparent performance improvement.

Expose a concise Markdown summary plus native machine-readable data to the agent: observed and baseline duration, absolute/relative change, sample counts, comparison identity, failed/missing data, and links to raw evidence. Separate “suspected slowdown” from “confirmed regression.” Saving a report is insufficient if the task runner never surfaces its location or warning to the agent. Initial alerts should inform investigation without blocking unrelated work or automatically triggering broad test reruns.

## Bounded rollout experiment

1. Choose two or three representative repositories: a fast unit suite, a compiled-language suite, and a browser or integration suite. Reuse their current required commands and artifact facilities. Capture a small set of representative outputs before selecting any new dependency.
2. Collect command timing and native artifacts during approximately 20 naturally occurring comparable executions per selected task. Record environments and scopes separately. This is an initial calibration target, not a statistical guarantee and not an instruction to run 20 extra full suites.
3. Pilot a pinned Allure version on those artifacts. Verify counts, names, duration units, retries, skipped/cached results, shard handling, and metadata against raw files. If conversion loses essential evidence, retain the native report for that runner instead of changing test behavior.
4. Exercise known test failures, command startup failure, timeout/signal, malformed or missing reports, and history-write failure. Confirm that reporting never converts a failed invocation into success and never turns absent results into a normal timing sample.
5. Perform a small same-revision comparison to measure noise, then a controlled reversible slowdown in a disposable fixture or branch. Check that the proposed warning detects a meaningful change while the same-revision comparison does not generate routine noise. Use Hyperfine or pyperf only for this bounded diagnostic work.
6. Measure collection/reporting overhead separately from test duration; agree a budget appropriate to the suite. Confirm local operation without a paid account, CI retention, useful agent-visible output, and baseline promotion/reset. Decide whether Allure earns its ongoing dependency and maintenance cost.

Adopt only after artifact fidelity, failure preservation, low overhead, useful warning behavior, and storage ownership are demonstrated. If native reports plus command timing satisfy those criteria, stop there. Add a shared service only when cross-repository queries or managed access become concrete requirements.

## Remaining uncertainties

- Allure Agent Mode's discovery and fidelity across the exact installed runner versions need execution evidence. Source inspection does not prove compatibility with every released combination.
- Hyperfine 2's changed schema needs verification against the chosen downstream consumer. Bencher explicitly documents support for versions 1 and 2; other or older adapters need their own check. [Bencher Hyperfine adapter](https://bencher.dev/docs/explanation/adapters/#_-shell-hyperfine)
- Real runner variance, artifact size/retention, reporting overhead, and useful thresholds cannot be established from product documentation.
- None of the evaluated defaults supplies a fully verified, noise-aware, agent-integrated detector across all these ecosystems without integration work. Keep that work small and evidence-driven; do not present a previous-run percentage comparison as statistical regression detection.
