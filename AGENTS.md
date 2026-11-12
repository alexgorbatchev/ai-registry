# ai-registry

Source of truth for reusable agent skills, commands, the shared system prompt, harness configuration, and generated outputs. Registry maintenance is interactive; the workflows it distributes may support unattended execution elsewhere.

## Requirements for the instruction system

These are acceptance requirements for guidance maintained here. The system prompt, skills, and repository guides implement them; their current wording is not evidence that a requirement has been satisfied.

### Audience and economy

- Write prompts and skills for executing agents. Every passage must change a decision, supply necessary context, or prevent a concrete failure. Remove lectures, familiar CLI tutorials, redundant examples, and table columns that add no information.
- Prefer fewer, cohesive skills. Existing tool help, scripts, and workflow templates should supply mechanics they already cover; retain the decisions and exceptions an agent needs to use them correctly.
- Preserve explicit permissions, exceptions, completion conditions, and technical contracts when compressing. Brevity must not become permission to omit required work.

### Ownership and composition

- Give each reusable policy one maintained owner: cross-task behavior in the shared system prompt, domain workflows in skills, repository facts and exceptions in `AGENTS.md`, and task scope and progress in durable task records. Harness-specific guidance belongs in the harness layer; private environment details belong in overlays.
- Repository guides must not repeat inherited policy or generic skill-selection instructions already supplied by the system and skill descriptions. In particular, do not add boilerplate telling every project to load `programming`, `docs-writer`, or `prompt-writer`.
- Skill dependencies are a separate contract: a skill must identify required skills and when they are needed. `skill-writer` requires `prompt-writer`; that does not justify copying their loading instructions into project guides.
- Engineering delivery, validation, UI evidence, and engineering cleanup belong to `programming`. The externally maintained `issue-tracker` owns task state, claims, lifecycle reconciliation, and handoffs. Do not recreate ticket workflows in this registry or consuming repositories.
- Review changes against the instructions that actually load together, including local skills, references, private overlays, and harness overrides. Reconcile affected duplicates, conflicts, triggers, and callers at their maintained sources. A file passing its own validator does not establish coherent behavior.
- Preserve user requirements independently of their implementation. Distinguish explicit requests, approvals, corrections, and rejected proposals in task evidence; do not turn an agent's proposed interpretation into standing policy without authorization.

### Required behavior of distributed guidance

- Support autonomous completion of authorized work through validation, integration, and cleanup with minimal supervision. Preserve the distinction between individual-task authorization and queue execution, resumable progress, ownership, and stopping conditions.
- Make due diligence produce verified repairs when authorized. Reporting, ticket creation, pre-existing status, or unrelatedness must not become escape hatches for fixable defects. Preserve escalation for product or architectural decisions, destructive changes, altered intended behavior, or substantially larger work.
- Require before-and-after screenshots for UI changes across CLI, TUI, desktop, web, and mobile. Require the agent to review that evidence for acceptance before presenting it to the user.
- Minimize test latency through selection by affected inputs and consumers, not filename extensions. Instruction-only edits need no application tests; a documentation file used as a fixture may. Avoid unrelated suites, preserve applicable gates, and measure and report test-command durations, including failures and retries. Prefer native test results plus command timing before introducing additional tracking infrastructure.
- Preserve native-environment acceptance requirements. Use suitable available environments directly; do not invent a PR or CI wait as a prerequisite to checking platform-specific behavior.
- Treat repositories collected in a workspace as independent projects with their own CI and contracts. Cross-repository maintenance does not authorize workspace dependencies or a shared execution platform.
- Preserve the requested conversational personality and concise, conclusion-first responses without reducing them to sterile status reports. Keep conversational personality out of authored artifacts unless requested.
- Investigate instruction failures through the received instructions, loading path, and observed interpretation. Distinguish verified causes from hypotheses; neither self-blame nor another unexamined rule is a repair, and wording changes do not guarantee compliance.

## Repository contracts

### Source locations and references

Before changing the corresponding area, read:

- Asset placement, bundle dependencies, vendoring provenance, or PR guidance: [source layout](docs/internal/references/registry-source-layout.md).
- Skill bundles: [skills/AGENTS.md](skills/AGENTS.md). This registry's authoring locations are `skills/agent/`, `skills/user/`, and `harnesses/<target>/skills/`; installed or generated directories are not authoring locations. This is the registry-specific exception to creating new project skills in `<project>/.agents/skills`.
- Shared system instructions: [system/AGENTS.md](system/AGENTS.md). `system/system.md` ships to every harness.
- Harness behavior or configuration: [harnesses/AGENTS.md](harnesses/AGENTS.md). Consult `harnesses/<target>/.tmp/<target>-source/` first, running that harness's `fetch-source.sh` if absent. Edit checked-in configuration rather than installed machine-local copies.
- Package implementation: the affected `packages/<package-name>/AGENTS.md`, where present.
- Source selection, hostname variants, overlays, EJS, output assembly, ignores, entrypoints, or public wrappers: [generation contracts](docs/internal/references/registry-generation.md).
- Generated edits, settings sync, recovery, storage, harness homes, bootstrap, scheduled updates, secret scanning, or publication: [state and bootstrap contracts](docs/internal/references/registry-state-and-bootstrap.md). Keep runtime data outside `.output/`; never clear `.state/` as cleanup.
- Harness output files, command invocation, wrappers, system distribution, or Codex trust: [harness mappings](docs/internal/references/registry-harness-mapping.md).

`just build` invokes `packages/registry-cli/src/commands/buildCommand.ts` to compile checked-in sources into `.output/`. Harness-specific generation belongs in `packages/registry-cli/src/harnesses/<target>/build.ts`, not top-level build or bootstrap code. Build operates on registry sources and overlays; bootstrap applies outputs to harness homes.

### Commands and validation

- `just setup` installs dependencies and Git hooks.
- After changing skills, commands, the shared system prompt, harness files, or `skills-lock.json`, run `just build` to typecheck and regenerate outputs. It is safe to use for linked-worktree verification. For changed skills, first run `bun skills/agent/skill-writer/scripts/quick-validate.ts <changed-skill-dir> [...more]`.
- For bootstrap changes, run `just bootstrap-smoke` against its isolated fake home. `just bootstrap` applies machine-wide configuration and refuses linked worktrees.
- Select affected package recipes by input impact; root `just check` is for repository-wide impact. Root `AGENTS.md` prose changes require instruction and reference checks, not application tests or output regeneration.
- Define development tasks in `justfile` recipes, not `package.json` scripts. First-party packages, disk-cleanup, and Claude Code hooks each have a modular `justfile`; root recipes reach them through `just <module> <recipe>`. Each package's `check` includes Oxfmt, Oxlint, typechecking, ts-unused, and tests; `just fmt` and `just fix` apply formatting and lint fixes. Third-party bundles under `skills/agent/archify` and `vendor/` retain upstream package files.
- For executable behavior changes, add or update meaningful behavioral tests. Require at least 90% line and function coverage across each affected first-party package's non-test source, including unexecuted files and excluding `scripts/`. Document and configure the command, source scope, metrics, and exclusions. `just coverage` gates registry-cli and Claude Code hooks; detailed counting rules are in [packages/registry-cli/AGENTS.md](packages/registry-cli/AGENTS.md). Reproduce blocking baseline failures on the untouched base and repair the smallest necessary prerequisite; do not weaken gates or add token tests.
- First-party package tests, disk-cleanup tests, and Claude Code hook tests use unique owned scratch roots and the registry-cli process supervisor. Import fixture factories through each test area's `./fixtures` entrypoint and register cleanup at creation. Keep repository-only preloads and tests out of generated bundles. Test commands remove consumed coverage reports before returning.

### External assets

Add external skills with `just skills-add 'npx skills add <source> --skill <name>'`; the wrapper supplies `-a openclaw --copy -y` for the canonical destination. Update them with `just skills-update`, not plain upstream commands. Preserve upstream content and author metadata, and commit the affected bundles with `skills-lock.json`. Keep local policy outside third-party bundles and record unresolved upstream findings separately.

### Privacy and task records

This registry is public and reusable. Generalize private or proprietary identifiers, personal details, internal URLs, hostnames, and examples; never introduce credentials. Existing public ownership, package identity, and canonical author attribution are permitted where required.

Registry work belongs to the `ai-registry` tracker project. Registry tickets are approved for execution without another approval. Keep private ticket text, attachments, numbers, and tracker identity out of public commits, pull requests, and branch names; this repository's branch privacy restriction takes precedence over generic ticket-number naming.

Ticket bodies start with `## Request`, quoting each user message that shaped the task verbatim as `> **<whoami>:** <request>` using the local account name. Follow with `## Context` containing the problem, evidence, decisions, scope, and exclusions needed to act without the conversation. Expand referenced finding IDs; omit credentials and private hostnames.

### Maintenance boundaries

Persist explicit standing user instructions in their narrowest existing owner; update superseded rules in place. Keep task directions, progress, and handoffs in task records. Let agents choose search and navigation tools; do not add mandatory tool ordering or tool-specific stop rules.

Instruction maintenance does not authorize implementing every newly documented enforcement mechanism or remediating every consuming repository. Record enforcement gaps as follow-up work, preserve existing checks, and report unverified enforcement accurately. A deferred generation or application step suspends only itself and actual dependents.

Preserve other actors' changes, index state, locks, and refs. Continue independent work in an owned worktree when safe; staged-file age does not establish ownership. Routine task-owned branch and index operations are authorized; destructive Git operations require explicit authorization and remain subject to executable guards.

Keep this guide and `README.md` current when repository structure or architecture changes. When structure, workflows, or locations change how assets are added, update `skills/agent/ai-registry-integration/SKILL.md` in the same change. Requirements recorded here describe intended behavior; they do not certify that every existing instruction or consuming project already conforms.
