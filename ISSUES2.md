---
created_on: 2026-10-26 10:10
last_modified: 2026-10-26 10:10
status: current
---

# Review findings for commit e56e821

This register records the review of `e56e821` (`refactor(registry): apply autonomy interview decisions`, 2026-10-24) against `HEAD` at `0e138b9`. Entries record evidence, impact, and suggested remediation; they do not independently change operating policy. Finding IDs (`F1`–`F24`, `D2`–`D7`) match the review discussion.

Method: the registry-cli code changes were reviewed directly, including a reproduction of the template-reversal behavior and a comparison of test results at the commit, its parent, and `HEAD`. The instruction changes were reviewed by two independent read-only passes; their highest-severity findings (F1, F2, F6, F7, F10) were re-verified. Entries marked *plausible* describe a confirmed mechanism whose real-world trigger was not observed.

Test status: at `e56e821`, `bun test packages/registry-cli` reported 302 pass / 20 fail; its parent reported 7 failures, so the commit introduced 13. At `HEAD`, 387 pass / 0 fail. Nothing in this register has been remediated yet.

## High

### F1: Codex Git guard permits history rewrites and discarded changes

Status: open. Confidence: confirmed.

[default.rules](harnesses/codex/rules/default.rules) previously forbade every `git checkout` and `git reset`. The commit narrowed both rules to specific flags in the third token position. Codex `prefix_rule` matches tokens in order from the start of the command, so any other form is no longer forbidden:

- `git reset HEAD~3` (rewrites branch history; `git reset HEAD~1` was an explicit `match` example and was removed)
- `git checkout .`, `git checkout HEAD -- src/`, `git checkout main file.ts` (discard file changes)
- `git checkout -q -f main`, `git reset -q --hard` (forbidden flag not in the third position)

[config.toml](harnesses/codex/config.toml) sets `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`, so these run without a prompt. This contradicts the rule that history resets and discarded changes require explicit authorization.

Remediation: restore a blanket `forbidden` (or `prompt`) rule for `git checkout` and `git reset`, then add narrow allow rules for the routine forms (`git checkout <branch>`, `git checkout -b`, path-scoped `git reset -- <path>`). Verify with `codex execpolicy check` against both the allowed and the dangerous forms above.

### F2: OpenCode Git guard changed from ask to allow for unlisted forms

Status: open. Confidence: confirmed.

[opencode.jsonc](harnesses/opencode/opencode.jsonc) replaced `"git checkout *": "ask"` and `"git reset *": "ask"` with a list of `deny` patterns and no fallback. OpenCode permission rules are last-match-wins with a default of allow ([permissions](harnesses/opencode/docs/permissions.mdx)), so `git reset HEAD~1`, `git checkout .`, `git checkout HEAD path`, and `git checkout main path` now run silently where they previously prompted.

Remediation: put `"git checkout *": "ask"` and `"git reset *": "ask"` first, keep the specific `deny` patterns after them, and add explicit `allow` entries only for the routine forms.

### F3: Commit landed with failing tests and a crashing build; root cause remains

Status: symptom fixed in `fc2cf82`; root cause open. Confidence: confirmed.

The commit introduced 13 test failures (hostname variant, overlay, and Codex provenance suites). Each failed with `ENOENT` at `buildCommand.ts:513`: `copyFileWithTemplateVariables` fingerprinted files copied out of the staging directory (for example `.tmp/generated-output-staging/.opencode-agents/work.md`) as sources, and the pre-application fingerprint check then tried to re-read them after staging cleanup. A real `bun run build` failed the same way. The commit message records that the rebuild was deferred, which is how it was committed.

`fc2cf82` fixed the symptom by making the OpenCode and Pi plugins copy those files directly. [copyFileWithTemplateVariables](packages/registry-cli/src/lib/harnessBuild.ts) still fingerprints any path it receives, so the next plugin that copies a staged temporary file through it will reintroduce the crash.

Remediation: fingerprint and map only paths inside registered source roots (repository and overlay, excluding `.tmp/` and the staging directory), and add a regression test that copies a staged file through the shared helper.

### F4: Edits to unmapped generated files block every build

Status: open. Confidence: mechanism confirmed; trigger plausible.

Several managed generated files have no entry in `sourcePaths` in `.output/manifest.json`: `claude-code/default/CLAUDE.md`, `codex/default/AGENTS.md`, `pi/default/APPEND_SYSTEM.md`, and, since `fc2cf82`, OpenCode agents and Pi prompts. When any of them drifts, `syncBackModifiedFiles` throws `Cannot recover <path>: no mapped source` on every build. A plausible trigger is Claude Code writing user memory to `~/.claude/CLAUDE.md` through `/memory`. Scheduled updates then fail on every run and stop pushing.

Before this commit, `-y` overwrote drift. It is now ignored (F19), and the error text ("resolve its source mapping") gives no actionable step, so the only recovery is manually reverting the generated file.

Remediation: decide the intended behavior for unrecoverable drift. Options: a documented explicit discard command that backs up the generated edit before overwriting it, or mapping rendered prompts to their profile `system_prompt` source and reporting the include-based case with exact instructions. Update the error text and `AGENTS.md` to match.

### F5: `programming` bundle is a stale duplicate that contradicts current Bun policy

Status: open. Confidence: confirmed.

The bundle under [skills/agent/programming](skills/agent/programming/SKILL.md) was authored before `6eda682` (justfile and shared React policy) and committed with its other content preserved.

- `programming/references/bun/runtime.md:44-58` puts tasks in `package.json` scripts, including a `check` script, and omits the justfile and `ts-unused` requirements. [bun/SKILL.md](skills/agent/bun/SKILL.md) line 23 forbids a `check` script because it overrides `bun check`.
- `programming/references/bun/react-compiler.md:114-150` uses `.oxlintrc.json` and a `check` script; the standalone copy requires the shared policy factories and `just verify`.

Every profile except `personal-assistant` selects `skills: ['*']`, so `programming` ships alongside `bun`, `bun-tailwind`, `golang`, `rust`, `typescript`, `python-skill`, and `modular-justfiles`, and both are described as mandatory. Eighteen reference files are byte-identical duplicates. Drift has started: `a7c7d60` fixed whitespace only in the bundle copies of `archive.md` and `bundling.md`; `typescript/SKILL.md:269` still has the `n## TypeScript 7 Updates` typo the bundle fixed; `typescript/references/storybook.md:3` still links the nonexistent `storybook-review`.

Remediation: keep one source of truth. Either remove the standalone language skills and port their newer policy into the bundle, or remove the bundle. Resolve the Bun policy conflict before choosing.

### F6: Guidance cites shared rules that no longer exist

Status: open. Confidence: confirmed.

`AGENTS.md:87-91`, [README.md](README.md), and [ai-registry-integration](skills/agent/ai-registry-integration/SKILL.md) lines 30-35 refer agents to [system.md](system/system.md) for library-scope, red/green, test-sensitivity, ownership-blocker, and destructive-Git rules. `f5a079b` reduced `system.md` to 86 lines, and none of those rules remain. Parts of it now contradict the root guidance: `system.md:39` mandates codegraph while `AGENTS.md:86` says the registry does not mandate a search tool.

The undefined "blocker protocol" is relied on by [gitea](skills/agent/gitea/SKILL.md) line 54, [termctrl](skills/agent/termctrl/SKILL.md) line 11, [continue-session](skills/user/continue-session/SKILL.md) line 14, and `github-fix-issues/references/{checks-and-ci.md:51, integration.md:74, setup.md:37}`; `scheduling.md:26` calls it "blocker procedure". Even at `e56e821`, depending on it violated the self-contained-skill rule, and the `personal-assistant` profile does not include `system.md`.

Related: [agents-templates.md](skills/agent/docs-writer/assets/agents-templates.md) lines 60, 72, 84 and `docs-writer/references/agents.md:104,125` write "under the existing policy" into other repositories' `AGENTS.md`, where no such policy exists.

Remediation: decide whether the removed rules return to `system.md`. Then either restore them or remove the citations, and inline a minimal blocker procedure in each skill that needs one. Record the reversal of the I007/I018 decisions in `ISSUES.md` if they are dropped.

### F7: `pi-debug` instructs redaction but prints credentials

Status: open. Confidence: confirmed.

[pi-debug](harnesses/pi/skills/agent/pi-debug/SKILL.md) line 49 adds "Redact credential values before displaying diagnostics", but the required command block at line 30 still runs `cat ~/.pi/agent/auth.json`. API keys land in the transcript and session logs on every debug run.

Remediation: replace the `cat` with a key-presence check that prints provider names only, for example a `jq` expression that emits keys.

## Medium: generated-edit recovery

### F8: Recovery rewrites path tokens the edit did not touch

Status: open. Confidence: reproduced.

[reverseTemplateContent](packages/registry-cli/src/lib/reverseTemplateContent.ts) now also reverses `file_path` and `file_dir`, longest path first, with no path-segment boundary. Recovery applies it to the whole file:

> `/repo/skills/agent/bun/references/x.md` → `<%- file_dir %>/references/x.md`
>
> `/repo/skills/agent/bun-tailwind/SKILL.md` → `<%- file_dir %>-tailwind/SKILL.md`

The exact-reversal check in `syncBackModifiedFiles` reverses only the variables the original source already uses, so it does not catch the rewrite. Rendered output is identical; the effect is source churn and sibling references that break silently if the skill directory is renamed.

Remediation: require a path-segment boundary (`/`, quote, whitespace, or end) after a replaced path, and recover only the changed regions or verify that reversing the unmodified render with the full context reproduces the original source.

### F9: Non-round-tripping edits leave the source half-recovered with a misleading error

Status: open. Confidence: plausible.

Recovery writes the source, then rebuilds with `canRecoverEdits = false`. If the edit does not round-trip, the second pass fails after the source is already written. Examples: a harness removes `disable-model-invocation` from a user skill (the build re-injects it), or edits the frontmatter `name` (`updateSkillName` forces it back). The second pass fails with "source … and generated output both changed", attributing the conflict to a concurrent edit the tool made. Every later build hits the same fingerprint mismatch until the user intervenes manually.

Remediation: simulate the rebuild of the recovered content before saving the source, and reject edits that do not round-trip with an error naming the transformation.

## Medium: instruction correctness

### F10: Decision record claims a change to a nonexistent file

Status: open. Confidence: confirmed.

`ISSUES.md` I027 states that `skills/agent/syncthing-transfer/SKILL.md` was changed and that the changed skill validator passed. That skill was deleted in `3a1730a` (2026-10-20), an ancestor of `e56e821`; the path does not exist at the commit. [autonomy.md](docs/internal/audit/autonomy.md) still lists A19 as an approved source change, and lines 83, 161, 250, 255 link to `pi-codegraph` and `claude-code-codegraph`, which this commit deletes. Line 83 recommends fixing the `pi-codegraph` fallback; the skill was deleted instead.

Remediation: mark I027 as not applied (skill removed) and update the audit report's disposition and links.

### F11: Missing-CI repair depends on an impossible precondition

Status: open. Confidence: confirmed.

`checks-and-ci.md:17-20,75-77` routes missing CI configuration through the bounded prerequisite-repair policy, which applies only to a failure reproduced on untouched `main` (`AGENTS.md:19`, `github-fix-issues/SKILL.md:102-108`, `queue.md:107-112`). A repository with no CI has no failure to reproduce, and `checks-and-ci.md:20` says an absent check result never counts as success. An agent either authors CI workflows under existing authorization or blocks every issue.

Remediation: state explicitly how a repository without CI is handled (block and report, or a bounded authority to add CI).

### F12: Undefined queue state names

Status: open. Confidence: confirmed.

`scheduling.md:73` says to "Mark the row eligible", but `queue.md:14` does not define `eligible`. `scheduling.md:63` marks reconciliation suspension as `blocked`, while `queue.md:14` defines `reconciliation-pending`. Agents either write an undefined state or use `ready`, losing the resume stage.

Remediation: use only the states enumerated in `queue.md`, or add the missing state there.

### F13: Missing reviewer token accumulates open PRs

Status: open. Confidence: plausible.

`setup.md:34-37` and `SKILL.md:28-29` suspend only dependent actions and continue eligible work; `scheduling.md:48` treats unavailable reviewer capacity as a blocker. Without a bot token, each issue reaches green CI, is suspended at review, and the next is selected. `scheduling.md:68` ("all authorized work shares the blocker") is evaluated per issue, so N PRs accumulate.

Remediation: treat a missing reviewer identity as a queue-wide blocker detected during setup, before implementation starts.

### F14: "Scheduler" and "lease" have no defined source

Status: open. Confidence: plausible.

`queue.md:45-62`, `github-fix-issues/SKILL.md:88-90`, `AGENTS.md:27`, and `github-issue-workflow.md:34-47` refer to an "authorized, configured scheduler" and lease references without defining either. `ISSUES.md:231` acknowledges none exists. In Claude Code, an agent may treat the `schedule` or `loop` skills as the configured scheduler and create cloud routines; otherwise it reports a redispatch requirement at every checkpoint.

Remediation: define what qualifies as a configured scheduler (or state that none exists and checkpoints only persist state).

### F15: `gitea` removed credential capture but still uses its output

Status: open. Confidence: plausible.

[gitea](skills/agent/gitea/SKILL.md) lines 49-59 still say to derive `user` and `pass` from the captured fields, and the curl examples at lines 80, 87, 94, 113, 119 use `$user:$pass`, but the `git credential fill` capture was removed. Each shell call is independent, so the agent must improvise the capture, which is where full helper output tends to be echoed.

Remediation: restore a single capture-and-use example that never prints the credential helper output.

### F16: Pending CI has no overall wait limit

Status: open. Confidence: plausible.

`checks-and-ci.md:59-62,86-87` and `scheduling.md:15-17` say pending CI never justifies suspension and specify only bounded polling batches. CI that never starts (fork approval gating, no runners, an environment awaiting approval, a path filter that never matches) leads to an indefinite wait. Audit finding A06 named this case; its disposition counts it as resolved.

Remediation: define a not-started condition (no run registered within a stated window) that is classified as a blocker.

### F17: Contradictory review-stop rules

Status: open. Confidence: plausible.

`skills/AGENTS.md` and [prompt-writer](skills/agent/prompt-writer/SKILL.md) line 37 cap instruction review at two rounds. `docs-writer/references/tickets.md:42` and `docs-writer/references/eng-designs.md:40` require review until completely clean (retained by I035). `README.md:22` applies both writers to documents containing agent instructions, so tickets written for agents get two conflicting stop rules.

Remediation: state which rule wins for agent-facing tickets and designs.

### F18: TypeScript completion criteria contradict the justfile mandate

Status: open. Confidence: confirmed.

`skills/agent/typescript/references/testing.md:181-188` and `skills/agent/programming/references/typescript/testing.md:183-190` require `bun lint`, `bun typecheck`, and `bun fix` (package scripts) before completion. [bun/SKILL.md](skills/agent/bun/SKILL.md) forbids package scripts for tasks and requires `just verify`.

Remediation: replace the package-script commands with the justfile recipes.

## Low

### F19: Dead build confirmation code

Status: open. Confidence: confirmed.

`IBuildOptions.hasAutoConfirm` is still parsed in `packages/registry-cli/src/bin/build.ts` and passed to `buildCommand`, but nothing reads it, so `-y` is a no-op in the build. `packages/registry-cli/src/lib/promptForYesNo.ts` is used only by its own test. `AGENTS.md` still describes scheduled updates invoking bootstrap with `-y` as if the flag mattered.

Remediation: remove the option, the flag passthrough, and the prompt module and its test, or give `-y` a defined role tied to F4.

### F20: Missed policy updates

Status: open. Confidence: confirmed.

- [disk-cleanup AGENTS.md](skills/user/disk-cleanup/AGENTS.md) lines 26-27 still say "change a test file and maintain 90% coverage", although I020 states every package file now uses the per-package 90% line and function rule.
- `AGENTS.md:67` says generated edits are recovered "During bootstrap"; recovery runs in `bun run build`, as `README.md` states.

### F21: Convention violations in edited skills

Status: open. Confidence: confirmed.

- [github-release](skills/agent/github-release/SKILL.md) line 3 and [continue-session](skills/user/continue-session/SKILL.md) line 4 keep "do not use" clauses in their descriptions, which `skills/AGENTS.md` prohibits; the commit updated both files' `last_modified`.
- `continue-session` (lines 4, 14, 63-71, 81) contains Pi and Claude Code session paths and harness-specific behavior in a generic skill.
- [merge-to-main-baseline](skills/agent/merge-to-main-baseline/SKILL.md) line 13 adds an "instruction-maintenance task" carve-out, a concept defined only in this registry's `AGENTS.md`, to a skill that ships to every repository.

### F22: Issue-workflow policy duplicated across about seven files

Status: open. Confidence: confirmed.

The issue-workflow rules are restated in `AGENTS.md:16-27` (which also says the bundled references own them), `README.md:10-19`, [ai-registry-integration](skills/agent/ai-registry-integration/SKILL.md) lines 101-113 (under "Add A Command"), `docs/internal/references/github-issue-workflow.md:34-165`, the skill, and each reference. For example, prerequisite-repair authority appears in `AGENTS.md:19`, `README.md:19`, `ai-registry-integration:112`, `github-issue-workflow.md:128`, `SKILL.md:102`, `queue.md:105`, and `checks-and-ci.md:22`. The audit flags this as "Shared policy duplication" (`autonomy.md:224`); the commit increased it. F6 shows the resulting drift.

Remediation: keep the rules in the skill references and replace the other copies with a one-line pointer.

### F23: Vendored setup skill references workflows that are not installed

Status: open (upstream). Confidence: confirmed.

`skills/user/setup-matt-pocock-skills/domain.md:11` references `/grill-with-docs` (removed) and `/improve-codebase-architecture` (never installed); `SKILL.md:40` names `to-spec` (not installed). The content matches upstream, and `ISSUES.md` I001 records only the `grill-with-docs` reference.

Remediation: record the additional references under I001; do not edit the vendored content.

### F24: Source checksums passed through a property attached to a Map

Status: open. Confidence: confirmed.

`buildCommand.ts` passes checksums via `Object.assign(new Map(), { sourceChecksums })`, and `harnessBuild.ts` widens `ISourcePathByOutputPath` into a `Map` subtype with an optional `sourceChecksums` field. This hidden side channel let staging-directory files be fingerprinted unnoticed (F3).

Remediation: pass an explicit source-registry object with methods for registering mappings and checksums.

## Due diligence

- **D2:** `ISSUES.md` had uncommitted changes in the working tree at the start of the review.
- **D3:** `harnesses/opencode/skills/agent/opencode-conversation-analysis/scripts/extract.ts` lines 44 and 86 default to `.opencode-analysis`, while the skill now documents `.tmp/opencode-analysis`. The script default, `.gitignore:31`, and the `airOpencodeCommands.test.ts:160` fixture still use the old location.
- **D4:** [rapid-demo](skills/user/rapid-demo/SKILL.md) spawns a `reviewer` subagent type, a harness-specific agent name in a generic skill with no generic definition.
- **D5:** `programming/SKILL.md:22` routes all Tailwind work, including non-Bun projects, to the Bun-only `bun-tailwind` references.
- **D6:** `pi-debug` hardcodes `~/.pi/agent`, ignoring `PI_CODING_AGENT_DIR`, and refers to the repository-relative `.output/pi/default/sessions/`, which only resolves when run inside this registry.
- **D7:** `ISSUES.md:137` cites `learn.chatgpt.com/docs/agent-configuration/rules` as the official Codex rules documentation, and the I-entry's conclusion depends on it. Replace it with the upstream `codex-rs/execpolicy` README, which confirms the prefix-matching semantics used in F1.

## Suggested remediation order

1. F1 and F2: restore ask/forbid fallbacks for `git checkout` and `git reset` in both harnesses.
2. F7: stop printing `auth.json`.
3. F4 with F19: define a supported path for unrecoverable generated edits.
4. F3 and F24: restrict fingerprinting to registered source roots.
5. F5: choose one source of truth for language guidance.
6. F6, F10, F22: reconcile the instructions with the current `system.md` and correct the decision record.
7. Remaining medium findings, then low findings.
