---
description: Comprehensive code review — full on first run, incremental on subsequent runs, writes REVIEW.md
targets: ['*']
---

Perform a comprehensive code review of this codebase. The output is always a holistic review of the entire project — but the exploration scope depends on whether a previous review exists.

## Step 1: Determine review mode

Use `REVIEW.md` frontmatter as the baseline source of truth.

Expected `REVIEW.md` frontmatter:

```yaml
---
review_sha: <commit-sha>
reviewed_at: <ISO-8601-utc-timestamp>
---
```

Determine mode:

```sh
# Extract review_sha from YAML frontmatter (if present)
BASELINE_SHA=$(awk '
  NR==1 && $0=="---" { in_frontmatter=1; next }
  in_frontmatter && $0=="---" { exit }
  in_frontmatter && $1=="review_sha:" { print $2; exit }
' REVIEW.md 2>/dev/null)
```

- **If `REVIEW.md` does not exist**: this is a **full review**. Proceed to Step 2a.
- **If `REVIEW.md` exists and `review_sha` is present and valid**: this is an **incremental review**. Use `review_sha` as your baseline and proceed to Step 2b.
- **If `REVIEW.md` exists but `review_sha` is missing/invalid**: treat this as a **full review** and regenerate `REVIEW.md` with valid frontmatter in Step 5.

## Step 2a: Full review — explore the entire codebase

This is the first review. Read `README.md` and the project's manifest file (e.g., `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, etc.) to understand the project, its dependencies, and its goals.

Use available repository exploration tools to thoroughly map every module, file, type, and interface. Map the architecture as it actually is — don't assume a particular shape. Understand:

- **All modules/packages** and their roles
- **The core architecture** and how components interact
- **Public API surface** (if it's a library): exported types, functions, interfaces
- **Internal patterns**: error handling, concurrency, state management

Also discover and validate project execution details that future reviews can reuse:
- Setup/install commands
- Test commands
- Coverage commands
- Build/typecheck/lint commands (if present)
- Required environment variables, services, fixtures, or working-directory assumptions

Record these in the `# Project Review Runbook` section in `REVIEW.md` (Step 5).

Then skip to Step 3.

## Step 2b: Incremental review — explore only what changed

Read the existing `REVIEW.md` — this is your accumulated knowledge of the full codebase.

First, read and reuse the `# Project Review Runbook` section (commands, setup, env, services). Do not rediscover commands from scratch unless:
- a stored command fails,
- the project layout/toolchain changed, or
- the runbook is missing required details.

Get the diff since the last reviewed SHA from frontmatter:

```sh
git diff <baseline-sha>..HEAD --stat
git diff <baseline-sha>..HEAD
```

Read and understand every changed file in full context (not just the diff hunks — read the whole file so you understand how changes interact with surrounding code). If changed files touch new modules you haven't seen before, explore those modules fully.

Then proceed to Step 3, but scope your scan (Step 3b) to the changed files and anything they interact with.

## Step 3: Find issues

### 3a. Verify previous issues (incremental only)

If `REVIEW.md` existed, check every issue listed against the current code:
- Read the specific file and function mentioned
- Determine if the issue is **FIXED**, **STILL OPEN**, or **PARTIALLY FIXED**
- If a change touched a file with an existing issue, re-examine that issue carefully
- Preserve existing issue IDs for any still-open or partially-fixed findings

### 3b. Find new issues

Scan for these categories. On incremental reviews, focus on changed files and their immediate dependencies — but don't ignore issues in unchanged code that become apparent from the changes.

Explicitly look for **implementation gaps** and **cross-component misalignment**: places where one part of the system declares behavior, data contracts, options, or capabilities that another part invokes differently, incompletely, or not at all.

Assign each finding a severity: **critical**, **moderate**, or **minor**, using this rubric:

- **critical**: correctness/security/data-loss issue with immediate user or system impact; release-blocking.
- **moderate**: meaningful functional gap, reliability risk, or performance issue that should be fixed soon but is not immediately catastrophic.
- **minor**: low-risk maintainability/polish issue with limited near-term impact.

Special rule:
- **Project-specific policy violations are always `critical`.** If code or workflow behavior violates an explicit project rule (for example AGENTS.md instructions, repository-required command workflows, mandatory attribution rules, or tool-specific policy docs), classify it as `critical` regardless of immediate runtime impact.

#### Correctness bugs
- Logic errors, off-by-one mistakes, wrong comparisons
- Race conditions or unsafe concurrent access
- Null/undefined/nil dereferences that can occur at runtime
- Error conditions that are silently swallowed or incorrectly handled
- Mismatches between documented behavior and actual behavior

#### Security issues
- Hardcoded secrets, API keys, or credentials
- Unsanitized user input used in commands, queries, or output
- Overly permissive file/network/resource permissions
- Unsafe deserialization or eval-like patterns
- Missing authentication or authorization checks

#### Project-specific policy violations (always critical)
- Violations of explicit repository/project rules documented in files such as `AGENTS.md`, `CLAUDE.md`, `.rulesync` command/skill docs, or tool-specific policy files
- Required workflow steps skipped (for example mandatory generation/sync commands after config edits)
- Required attribution/identity rules not followed in ticket/task systems
- Required architectural, testing, or quality gates explicitly mandated by project docs but not satisfied

When reporting these findings:
- Always set severity to `critical`
- Cite the policy source file and the violated rule text/section
- Explain concrete impact (correctness, reliability, compliance, or operational risk)

#### Cross-component contract misalignment
- Callers pass values/options that providers do not accept, parse, or honor
- Producers and consumers disagree on schemas, field names, enums, units, defaults, or version assumptions
- Registries/routing tables reference handlers/events/commands that do not exist (or the inverse)
- Integration boundaries drift in semantics (API/client, queue producer/worker, config declaration/consumption, frontend/backend)
- One layer advertises a capability that downstream layers stub, ignore, or implement differently

Severity guidance for misalignment findings:
- **critical**: mismatch causes runtime failure, data corruption/loss, privilege bypass, or user-visible incorrect behavior.
- **moderate**: mismatch silently disables/degrades behavior, drops data, or creates unreliable outcomes.
- **minor**: mismatch is currently latent but likely to cause future regressions/confusion.

When reporting misalignment, cite both sides of the contract (declaration site and usage site) and explain the concrete runtime impact.

#### Stub implementations
- Functions with `TODO`, `FIXME`, `HACK`, `XXX`, `STUB` comments
- Empty function bodies or functions that return zero/default values without real logic
- Algorithm steps that are commented out or skipped
- Switch/match cases that fall through to default without handling
- Features declared in types/interfaces but never wired into the system

#### Unfinished features
- Types or config options that exist but are ignored during execution
- Modes or variants that are declared but dispatch to wrong/generic handlers
- Public API surface that is incomplete (e.g., setters without getters, or vice versa)
- Fields on types that are never read or written outside of initialization

#### Dead code
- Unreachable branches or impossible conditions
- Unused exports, functions, or types (not just unexported — truly unreferenced)
- Orphaned files that nothing imports or references
- Commented-out code blocks with no explanation

#### Code duplication (DRY)
- Repeated logic blocks across files/functions that should share a single implementation
- Copy-pasted validation, parsing, error mapping, or authorization checks
- Duplicated constants/defaults/config transforms that can drift over time
- Similar test bodies that should be table-driven/parameterized
- Near-identical helper functions with only minor naming or branching differences

Severity guidance for duplication findings:
- **critical**: duplicated correctness/security-sensitive logic has already diverged or can cause inconsistent behavior.
- **moderate**: duplicated business logic is likely to drift and cause future bugs.
- **minor**: cleanup-level duplication where extraction would improve maintainability but current behavior is still consistent.

When reporting duplication, include the specific duplicate locations and a concrete consolidation direction.
Do not flag intentional small repetition that improves readability or is performance-motivated and documented.

#### File size and modularity
- Flag files that are too large and should be split into smaller modules.
- Heuristic thresholds (guidance, not absolute rules):
  - Source files over ~500 lines
  - Test files over ~700 lines
  - Single files mixing multiple unrelated responsibilities
- Watch for signs the file has become a bottleneck:
  - frequent merge conflicts
  - many unrelated edits in one PR
  - difficult navigation/review due to mixed concerns

Severity guidance for file size findings:
- **moderate**: file size/structure is materially hurting maintainability, reviewability, or change safety.
- **minor**: file is trending large and should be split soon, but current risk is still manageable.

When reporting, include a concrete split plan (proposed module boundaries, filenames, and ownership of moved symbols).
Do not flag intentionally centralized files (e.g., generated registries, schema bundles) when the structure is justified.

#### Optimization opportunities
- Allocations inside hot loops
- Redundant computations (same value calculated multiple times)
- Full copies where incremental/partial updates would suffice
- Linear scans where indexed lookups would help
- Expensive operations in tight loops that could be hoisted or precomputed

#### API and design gaps (libraries only)
Skip this section for applications. For libraries, evaluate:
- Inconsistencies in naming, parameter ordering, or return types
- Missing convenience methods that would reduce boilerplate for consumers
- API surface that exposes internals instead of clean abstractions
- Missing error context or unhelpful error messages
- Patterns that force consumers to do manual work the library should handle

## Step 4: Run tests and coverage

Use commands from `# Project Review Runbook` in `REVIEW.md` first.

- On a full review: discover commands, run them, and persist them in the runbook.
- On an incremental review: reuse runbook commands; only re-discover when commands are outdated or failing.

Run the project's test suite to verify the codebase compiles and tests pass. Note any failures.

Then run coverage (or the closest equivalent command for the language/toolchain) and report:
- Overall line/statement coverage percentage
- Package/module-level coverage where available

Coverage target for this workflow: **90% overall coverage**.

If coverage tooling is unavailable, state that explicitly and explain why coverage could not be measured.

If you had to change any runbook command, update `# Project Review Runbook` with:
- the new command,
- why it changed,
- and when it was last verified.

## Step 5: Write REVIEW.md

Write `REVIEW.md` as a complete, holistic review of the entire project — not just the changes. Merge new findings with carried-forward issues from the previous review (if any). Remove issues that are fixed. The result should be a single coherent document that stands on its own.

At the top of `REVIEW.md`, include YAML frontmatter with the current review metadata:

```yaml
---
review_sha: <current-head-sha>
reviewed_at: <ISO-8601-utc-timestamp>
---
```

Use:

```sh
git rev-parse HEAD
# and a UTC timestamp, e.g. 2026-03-18T12:34:56Z
```

Use this document structure:

```md
---
review_sha: <sha>
reviewed_at: <timestamp>
---

# Review Summary
- Findings: critical=<n>, moderate=<n>, minor=<n>
- Coverage: <overall %> (target: 90%)
- Test status: <pass/fail + key notes>

# Project Review Runbook
- Last verified at: <timestamp> (<sha>)
- Setup/install commands:
  - `<command>`
- Test commands:
  - `<command>`
- Coverage commands:
  - `<command>`
- Build/typecheck/lint commands (if applicable):
  - `<command>`
- Required env/services/fixtures:
  - `<details>`
- Monorepo/package working-directory notes:
  - `<details>`
- Known caveats:
  - `<details>`

# Findings by Category
## Correctness Bugs
### [REV-001] [critical] <title>
- Location: `<file>:<line>` (`<symbol>`)
- Current behavior: ...
- Expected behavior: ...
- Why it matters: ...

## Security Issues
...

## Project-Specific Policy Violations (always critical)
...

## Cross-Component Contract Misalignment
...

## Stub Implementations
...

## Unfinished Features
...

## Dead Code
...

## Optimization Opportunities
...

## File Size and Modularity
...

## API and Design Gaps (libraries only)
...

# Test Results
- Commands run: ...
- Result: ...
- Failures: ...

# Test Coverage
- Overall: <percent>
- Target: 90%
- Below-target areas: ...
- If unavailable: "Coverage unavailable: <reason>"

# Issue Lifecycle (incremental reviews)
- Fixed this round: [REV-00x], [REV-00y]
- Still open: [REV-00z], ...
- Partially fixed: [REV-0ab], ...
```

Issue ID rules:
- Every finding must have a stable ID in the form `REV-###`.
- Preserve IDs for carried-forward issues.
- Assign new IDs sequentially after the highest existing ID.
- Never reuse or renumber old IDs.

Project runbook rules:
- Keep `# Project Review Runbook` concise and command-focused.
- Prefer copy-pastable commands over prose.
- Update it whenever commands, paths, env vars, or required services change.
- Keep stale commands out of the runbook.

Each issue must include:
- A stable issue ID (`REV-###`)
- A severity tag: **critical**, **moderate**, or **minor**
- A descriptive title
- The function/symbol name and file path (line numbers as supplementary reference)
- What the code currently does vs. what it should do
- For contract/misalignment findings: both sides of the contract (declaration and usage)
- For project-specific policy violations: policy source file + violated rule/section, and severity must be `critical`
- Why it matters (correctness, security, performance, developer experience)

## Important notes

- Be thorough. Read actual source code — do not guess from file names.
- Every claim must be backed by a specific file path and function/symbol reference.
- Do not report issues that have already been fixed.
- Do not list intentional design decisions as issues.
- Focus on actionable findings, not style preferences.
