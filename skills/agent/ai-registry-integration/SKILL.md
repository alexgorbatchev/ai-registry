---
name: ai-registry-integration
description: Add or update content in the AI registry. Use when a user needs to create or modify skills, commands, profiles, harness overrides, vendored skills, or related registry documentation in this repository.
author: alexgorbatchev
metadata:
  created_on: 2026-04-17 21:08
  last_modified: 2026-10-24 10:52
  status: current
---

# AI Registry Integration

Treat this repository as the source of truth. Add things to the reusable source directories first, then rebuild generated outputs. Do not hand-edit the generated output directory under the repo_root token.

Maintain the registry interactively with agent assistance. Reusable guidance may support unattended workflows in other repositories without requiring an unattended workflow for registry maintenance.

## EJS Templates

- Use template tokens when checked-in guidance or generated text needs canonical repository paths that would otherwise be machine-specific.
- Keep existing filenames and use native EJS raw output tags for path variables. Available path tokens are `repo_root`, `overlay_dir`, `skills_dir`, `commands_dir`, `profiles_dir`, `output_dir`, `file_path`, and `file_dir`.
- Use native EJS include calls with a leading slash for repository-root-relative file inclusion; relative paths resolve against the source filename.
- Use the env(name, fallback?) helper to read environment variables, with an optional fallback when the variable may be absent.
- Use EJS literal opening delimiters when documenting EJS syntax. Foreign curly-brace syntax, including justfile and Go templates, passes through unchanged without backslash escaping. Render each file once.
- Treat EJS templates as trusted JavaScript. Edit includes, expressions, and control flow at their source; sync-back reconstructs only canonical raw path-variable tags.
- Prefer the most specific path token available. Use `skills_dir`, `commands_dir`, `profiles_dir`, and `output_dir` for those canonical folders. Use `repo_root` for canonical folders that do not have a dedicated token.

## Core Rules

- Automatically record explicit standing user instructions in the narrowest applicable `AGENTS.md` or existing policy file without requiring a separate request to save them. Update superseded wording in place; keep one-task directions and session history out of policy files. Ask only when the intended scope or resolution of a material conflict is unclear.
- Let models choose search and code-navigation tools according to the task and available capabilities. Do not add mandatory search-tool ordering or tool-specific stop rules.
- Keep dependency investigation and library integration within the authorized task's required capabilities. Follow the shared library guidance in `system/system.md` beneath the repo_root token.
- Apply red/green and isolated test-sensitivity checks to changes in executable behavior; use applicable validators for non-executable changes. Preserve other actors' changes, following the shared testing guidance in `system/system.md` beneath the repo_root token.
- Keep instruction-maintenance tasks, including their commits and merges, within their authorized scope. Record newly specified but unimplemented enforcement as follow-up work rather than making its implementation a prerequisite. Run existing checks applicable to the actual changes, preserve existing gates and behavior-change testing requirements, and report missing enforcement without claiming compliance. A user-deferred generation or application step suspends only that step and its actual dependents; continue independent validation and authorized source integration.
- For executable behavior changes, add or update meaningful behavioral tests and follow the root `AGENTS.md` testing and coverage policy beneath the repo_root token: at least 90% line and 90% function coverage across each affected first-party package's non-test source, including unexecuted files and excluding `scripts/` directories. Document and configure the command, source scope, metrics, and exclusions; reproduce blocking baseline failures on the untouched base and use the existing prerequisite-repair policy. Do not weaken gates or make token test edits.
- Preserve other actors' changes, index state, locks, and refs. Suspend only conflicting operations; continue independent authorized work in an owned, isolated worktree when safe. Staged-file age does not authorize takeover or a whole-worker halt. Record and recheck ownership blockers under the shared guidance in `system/system.md` beneath the repo_root token.
- Permit routine branch and path-scoped index operations needed for authorized tasks in owned worktrees after ownership and state checks. Keep destructive Git operations subject to explicit authorization and executable guards. Command permissions do not establish ownership; apply the shared requirements to equivalent syntax without bypassing restrictions.
- Keep new content anonymized and reusable. Do not introduce private company names, internal URLs, secrets, or personal details.
- Use `prompt-writer` whenever generating, writing, or revising AI agent instructions in any artifact. `skill-writer` adds skill-bundle conventions and validation; `docs-writer` owns project documentation structure and maintenance.
- When checked-in guidance or generated text refers to repository paths, use template tokens instead of machine-specific absolute paths.
- Put reusable assets under the directories referenced by the repo_root token: `skills/`, `commands/`, `profiles/`, or `harnesses/`.
- Keep executable repo entrypoints under `packages/registry-cli/src/bin/` beneath the repo_root token and use dash-based filenames. Put imported TypeScript helper modules that are not direct entrypoints under `packages/registry-cli/src/lib/`.
- Public CLI helpers meant to be symlinked to `~/.local/bin/` (like `air-*`, `claude-*`, `codex-*`, `pi-*`, or `cll` wrappers) MUST NOT be checked into `packages/registry-cli/src/bin/` beneath the repo_root token. Generate them through `packages/registry-cli/src/commands/buildCommand.ts` and its harness plugins into `.output/bin/` beneath the repo_root token so the bootstrap script can link them from there.
- Put publishable standalone packages under `packages/<package-name>/` beneath the repo_root token.
- Put vendored third-party code packages that need Bun workspace installs under `vendor/` beneath the repo_root token.
- Register bundled skill packages needed by repository-wide typechecking as root Bun workspaces so normal installs include their dependencies. Exclude installed dependencies, local lockfiles, and scratch directories from generated copies through the skill's `.registry-ignore`.
- When a source tree needs repo-local files that must not ship into generated outputs, add `.registry-ignore` files with `.gitignore`-style rules inside that tree. The build honors nested `.registry-ignore` files while staging `skills/`, `commands/`, and `harnesses/<target>/` content.
- Make intentional registry edits in source; treat subsequent harness-written changes in `.output/` beneath the repo_root token as expected. Automatically recover supported generated edits into their mapped source only when the generated baseline, source fingerprint, and exact reversal establish that source changes will not be overwritten, then regenerate all affected outputs. Preserve both versions and suspend dependent output application on source conflicts, unsupported recovery, or save failures. Reconcile existing drift without source fingerprints into source before establishing a fresh baseline. Do not request confirmation or investigate ownership merely because a harness changed a generated file; `-y` does not bypass reconciliation. Preserve all session/runtime data and unmanaged harness-owned files.
- After modifying any file under `skills/`, `commands/`, `profiles/`, `harnesses/`, or `skills-lock.json` beneath the repo_root token, run `bun run build` from the repo_root token.
- If a change alters repo structure, build architecture, or workflow contracts, update `AGENTS.md` and `README.md` beneath the repo_root token in the same change.
- **USE SOURCE REFERENCE FIRST:** When diagnosing harness issues, analyzing behavioral contracts, or updating configurations, ALWAYS consult the local checked-out harness source code under the respective `harnesses/<target>/.tmp/<target>-source/` folder first. Never guess, assume, or rely on memory. If the source is not yet checked out on disk, run that harness's `./harnesses/<target>/fetch-source.sh` script first to pull it down.

## Workflow

1. Identify what kind of thing is being added.
2. Create or edit the source-of-truth file in the matching section below.
3. Update any dependent manifest or lock file.
4. Run the narrowest relevant validation.
5. Run `bun run build` from the repo_root token.
6. Inspect the generated output under the output_dir token if the change affects shipped harness content.

## Private Overlay Registries

- Work-specific, proprietary skills, commands, and profiles that cannot be committed to this public repository live in a separate private repository.
- Configure the overlay path in `.env` (which is git-ignored): `AI_REGISTRY_OVERLAY=/path/to/private-ai-registry`.
- The overlay repository should mirror standard registry folders: `skills/`, `commands/`, and `profiles/`.
- During `bun run build`, assets from the overlay are merged with public assets. On collision, overlay assets take precedence over public base assets.
- Apply the same safe recovery checks to overlay-backed generated files. Recover supported edits to the mapped overlay source; preserve both versions and suspend application on conflicts or unsupported recovery.

## Add A Skill

- Follow `<%- skills_dir %>/AGENTS.md`: keep generic skills free of harness-specific instructions, including bundled files and conditional harness sections. Place harness-specific content under `harnesses/<target>/skills/agent/<skill-name>/` or `harnesses/<target>/skills/user/<skill-name>/` instead.
- Create a folder under the skills_dir token for the new skill.
- Put the main instructions in `SKILL.md` within that skill folder.
- Start `SKILL.md` with YAML frontmatter containing `name`, `description`, `author: alexgorbatchev`, and a `metadata` block with `created_on`, `last_modified`, and `status`.
- Write `description` using positive trigger conditions only. Keep negative triggers and exclusions in the skill body, never in the description.
- Keep base skills self-contained. Project-local `<base-skill>-addendum` skills may depend on the matching base skill. Matt Pocock's explicitly user-invoked workflows may depend on other bundled user skills; keep those dependencies available.
- For project-specific overrides to an existing skill, use a project-local addendum skill named `<base-skill>-addendum` instead of copying the full global skill into the project.
- Write the addendum description so routing can discover the dependency through `name` and `description` alone: `If <base-skill> skill is used, this skill must be used as well.`
- Put only the project-specific delta in the addendum body. When project-specific guidance conflicts with the base skill, the addendum supersedes the base skill for that project.
- Do not make a global skill refer to project-local addenda, and do not create multiple addenda for the same base skill in one project.
- Add bundled resources only when needed, inside the same skill folder:
  - `scripts/` beneath the skill folder
  - `references/` beneath the skill folder
  - `assets/` beneath the skill folder
- Keep the body procedural and specific for another AI agent.
- Review agent instructions with concrete acceptance checks and at most two review-and-fix rounds, following `<%- skills_dir %>/AGENTS.md`; do not require numerical quality scores or waive unresolved blockers.
- Validate every changed skill folder with `bun <%- skills_dir %>/agent/skill-writer/scripts/quick-validate.ts <skill-dir>` and fix every reported error before building.
- Run `bun run build` from the repo_root token after the skill change.

## Add Hostname Skill Variants

- Keep the skill bundle's default `SKILL.md`. Add each machine-specific version at `variants/<hostname>/SKILL.md`, with normal skill frontmatter and the same `name` and `author` as the default.
- Match the hostname exactly, including case and domain suffixes. Hostnames start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens.
- Use `AI_REGISTRY_HOSTNAME=workstation-a bun run build` to validate and generate a specific variant. The build otherwise detects the OS hostname once; an absent matching directory uses the default, and an invalid matching variant fails.
- Keep shared references, scripts, and assets at the bundle root. Only the root `SKILL.md` changes by hostname; the entire root `variants/` directory stays out of generated outputs. Link bundled resources by their generated locations.
- Use existing repository-root-relative includes for shared text. Template expansion runs once, with `file_path` and `file_dir` identifying the selected variant's original source path.
- Place actual private hostnames and environment instructions in the private overlay. Include all required resources there: overlays replace entire bundles, and a private default does not inherit public variants.
- Preserve existing harness boundaries and override precedence. Put harness-specific variants inside harness-specific skill bundles; profile-local variants belong in that profile's skill bundle.
- Recover generated edits with the original hostname and overlay selection. Sync-back targets the selected variant and rejects a source mismatch recorded in the manifest. Edit include-based variants at their source because recovery does not reconstruct include directives.

## Add A Command

- Maintain GitHub issue authoring, implementation/review/integration, and historical issue-merge repair together in `<%- skills_dir %>/agent/github-fix-issues/`. Keep it harness-independent; do not recreate separate issue commands, issue skills, or harness overrides. Its bundled references define one active issue at a time through merge and cleanup, persistent scheduling, and integration gates. For a verified blocker, record evidence, the unblock condition, and resume state; preserve artifacts, suspend affected dependents, and select the next independent issue within the authorized queue. Recheck suspended work at selection boundaries and refresh cleared tickets before restoring eligibility. Pending CI or a running review keeps the current issue active. Select by verified priority labels, highest first, then oldest within each group; without priority labels use oldest first. Resolve prerequisites before dependents.
  Recover acceptance criteria from verified issue discussion, specifications, tests, and documented behavior; a missing structured section alone does not block work, and tests or current behavior alone do not establish the desired change. Resolve priority ambiguity from verified guidance. Unresolved material requirements or label ranks suspend only affected issues and dependents; record the question and unblock condition and continue independent authorized work. Do not invent behavior or ranks, or alter labels to bypass ambiguity.
  Follow the issue skill's queue ownership and restart contract. Record task/worker identity, owned checkout/worktree paths, and any scheduler-provided lease reference; verify ownership before queue writes or resumed mutations. Timestamps and lease expiry alone never authorize takeover. Checkpointing does not dispatch workers: use only an authorized, configured scheduler interface, record verified acceptance, or preserve state and report the exact redispatch requirement. Never invent leases, dispatch, or unattended resumption; reconcile live ownership, Git, issue/PR, CI, review, and publication state on restart.
  Keep issue references and concise testing summaries in PR descriptions. CI is the completion record: push, watch until green, then request bot review; fix failures or findings and repeat CI/review before merging. Do not publish log transcripts, evidence packages, or round manifests. Reviewer operating instructions stay in the installed skill; PR comments carry findings, replies, and short status notices.
  Keep clean reviews to native approval without a body, comments, or summary; reviewer prose reports only actionable findings.
  Check CI readiness before implementation and follow the issue skill's checks reference for failure classification and infrastructure retries. Persist the revision, attempt count, evidence locators, and next retry time across restarts; pending CI or review does not consume the retry budget. Missing configuration follows the bounded prerequisite policy; exhausted retries with continuing infrastructure-failure evidence suspend only dependent work without waiving checks.
  Follow the issue skill's setup readiness checks before implementation: tools, repository/remote identity, implementer authentication, configured distinct reviewer and token availability, access, and protection compatibility. Keep the workflow main-only; never silently substitute another integration branch. Persist non-secret findings and exact missing requirements; suspend only dependent actions, preserve prepared work, and recheck prerequisites before resuming and at review/integration gates. Do not dump credentials, change default authentication, bypass protections, or escalate existing permissions.
  Completion reports give concise verified check results and material limitations, with native CI links or existing local log paths where applicable. Retain raw logs in the execution system; local logs do not replace required CI.
  After publication, follow the issue skill's integration reference for a persisted reconciliation window: repository policy or 15-second polls for up to 120 seconds. Save publication state, first observation, deadline, and next poll across restarts. Closure and cleanup require remote main to contain the published commit and the PR to have its expected head and native MERGED state. Missing native state after the window suspends affected work without marking completion or repeating publication solely to force the merged flag. Reuse current fetch/API results without a separate connectivity check; this window does not limit ordinary pending CI or running review.
  Existing task authorization covers the smallest same-repository baseline repair needed to unblock required checks after reproducing the failure on the untouched base. Keep it in its own prerequisite ticket and change set through the same checks, review, and integration gates; honor explicit exclusions and other owners' changes. Compatibility layers require explicit authorization, including removal and verification for temporary layers; migration approval alone does not grant it.
  Keep reviewer access automation bundled under that skill's `scripts/`, with its pinned dependency manifest registered as a root workspace and its interface documented in the skill. Link its development justfile from the root justfile. Exclude installed dependencies, local lockfiles, tests, and the development justfile through `.registry-ignore`; preserve configured identities outside reusable source.
- Keep PR-writing and PR review-feedback guidance in the `github-pr` skill under `<%- skills_dir %>/agent/github-pr/`, with one bundled reference per mode; do not recreate a duplicate PR command. PR descriptions, comments, and replies posted from the user's account use the account owner's first-person voice (`I`, `me`, `my`), with actions and approvals grounded in actual work and authorization. Do not refer to that account owner as `the user` or narrate an assistant intermediary. Separate bot reviews speak for the bot's identity.
- Create the command under the commands_dir token.
- Use commands for slash-command prompts, reusable task blueprints, and prompt templates.
- Keep the command self-contained rather than relying on unstated repo context.
- If the command is meant to be available in a profile, make sure the profile manifest under the profiles_dir token includes it directly or via an existing glob.
- For Codex, include YAML frontmatter with a non-empty `description`. The default profile's selected reusable and profile-local commands become native skill bundles in every Codex profile, with `policy.allow_implicit_invocation: false` in `agents/openai.yaml`; do not emit deprecated `prompts/` files. Invoke with `$<skill-name>` or `/skills`. An explicit `name` is honored; otherwise the build derives `command-<filename>` with leading hyphens removed and repeated hyphens collapsed, including the `default` namespace for profile-local commands. Use lowercase kebab-case names of at most 64 characters and avoid collisions with selected skills. Non-default Codex command selections are not emitted.
- Run `bun run build` from the repo_root token after the command change.

## Add A Profile

- Create a profile folder under the profiles_dir token.
- Put the manifest in `profile.yaml` within that profile folder.
- Use the manifest to select skills and commands, plus any tool toggles, permissions, or `system_prompt` overrides.
- Optional profile-local commands live in the profile folder's `commands/` directory and are emitted as namespaced shared commands named `--<profile>-<filename>.md` in OpenCode outputs.
- Optional profile-local skills live in the profile folder's `skills/<skill-name>/SKILL.md` path and must not collide with global skills or another profile's local skills.
- Keep reusable knowledge in the skills_dir token and reusable prompts in the commands_dir token; profiles should assemble those pieces instead of duplicating them.
- Run `bun run build` from the repo_root token after the profile change.
- Check generated profile-local outputs when the selected targets write files inside that profile folder.

## Add Harness Overrides

- When a harness edits a JSON, JSONC, or TOML settings file at runtime, register the staged file with `context.buildSupport.syncSettingsFile(...)` in its build plugin, passing `liveOnlyKeyPaths` (`*` matches any key) for keys the tool stamps on its own, entries keyed by local paths, and fields that can hold credentials. The build syncs harness edits back into the source, commits them, and applies source edits to the live file instead of reporting drift. Do not treat source changes as first-install-only seeds. Consult `<%- repo_root %>/harnesses/AGENTS.md` for each harness's configuration contract.

- Put harness-specific shipped files under `harnesses/<target>/` beneath the repo_root token.
- Put unified harness-specific build logic in `packages/registry-cli/src/harnesses/<target>/build.ts` beneath the repo_root token for every generated harness target.
- Put repo-local vendored code packages that a harness references by file path under `vendor/` beneath the repo_root token.
- Put shared repo-level system guidance under `system/` beneath the repo_root token and harness-specific guidance in `harnesses/AGENTS.md` or the relevant `harnesses/<target>/` directory.
- Only files under a harness directory are copied into generated output for that harness, subject to `.registry-ignore`.
- Do not place repo-only notes inside a harness directory unless they are intentionally meant to ship.
- Prefer the harness's native configuration surface over local wrappers when the harness already supports the feature directly.
- Harness-specific skills under `harnesses/<target>/skills/` cleanly take precedence over global skills (`skills/` and overlay `skills/`) on name collision across all four harnesses.
- For Codex-only shipped skills, place them under `harnesses/codex/skills/`; the Codex build merges that directory into each generated `skills/` root inside `.output/codex/<profile>/`.
- For Claude Code-only shipped skills, place them under `harnesses/claude-code/skills/`; the Claude Code build merges that directory into each generated `skills/` root inside `.output/claude-code/<profile>/`. Everything else under `harnesses/claude-code/` is copied verbatim into the generated `default` profile root.
- If a local file-based harness dependency needs installed runtime imports, vendor it under `vendor/<name>/` beneath the repo_root token, add it to the root Bun workspaces, and reference it from the harness config using the repo_root token.
- When vendoring third-party code under `vendor/<name>/`, copy only the files the harness loads plus the upstream `LICENSE`, and record the upstream repository, pinned commit, and file checksum in that package's `README.md`. Fetch from the pinned commit URL, never from a moving branch.
- When a harness needs a single vendored file inside its generated root, symlink it from the harness build plugin and fail the build when the source file is missing.
- Run `bun run build` from the repo_root token and verify the corresponding files under the output_dir token.
- Existing harnesses:
  - OpenCode under `harnesses/opencode`.
  - Codex under `harnesses/codex`.
  - Pi under `harnesses/pi`.
  - Claude Code under `harnesses/claude-code`.

## Add A Standalone Package

- Create the package under `packages/<package-name>/` beneath the repo_root token.
- Use this for publishable tools that are distributed independently from generated harness outputs.
- Add the package folder to the root `package.json` workspaces beneath the repo_root token.
- Keep publishable package docs inside the package folder, such as `README.md`.
- Run the package's narrowest validation plus any affected repo-level validation.

## Vendor An External Skill

- Vendored skills live under the skills_dir token.
- Preserve third-party-authored skill content. Keep local policies in registry-owned guidance and record unresolved upstream findings instead of rewriting those bundles.
- Place every skill authored by `mattpocock` under `skills/user/`, including newly added skills. After vendoring, move an incorrectly classified bundle there before rebuilding. Existing user bundles retain their classification during updates.
- Track the vendored source in `skills-lock.json` beneath the repo_root token.
- Add a third-party skill with `bun run skills:add 'npx skills add <source> --skill <skill-name>'` from the repo_root token.
- Do not use plain `npx skills add ...` for vendoring into this repo; the wrapper enforces the repo's canonical destination and flags.
- Vendored skills must have `author` set (derived from the source owner or upstream author) and kept up to date across additions and updates.
- Update vendored skills with `bun run skills:update` from the repo_root token.
- Commit both the vendored skill directory under the skills_dir token and `skills-lock.json` beneath the repo_root token when vendoring or updating an external skill.
- Run `bun run build` from the repo_root token afterward.

## Build And Generated Output

- The local build entrypoint is `packages/registry-cli/src/bin/build.ts` beneath the repo_root token.
- Unified harness plugins are located at `packages/registry-cli/src/harnesses/<target>/build.ts` beneath the repo_root token.
- Generated outputs are written under the output_dir token.
- Generated harness skills (`skills/` entries across OpenCode, Codex, Pi, and Claude Code outputs) are copies of the source files with template tags resolved, not symbolic links, so tags inside `SKILL.md` and bundled skill files reach the agent resolved.
- The generated-output manifest tracks only registry-managed entries under the output_dir token, and `bun run build` overwrites only those managed paths instead of replacing the entire output tree.
- Never create harness runtime state (session stores, logs, todo lists, databases) in generated output. Bootstrap links each generated profile's managed entries into a real harness home outside the repository, and the harness writes its runtime state there. A harness plugin returns home targets from `getBootstrapTargets()`, giving non-default profiles a `getProfileHomeDir(...)` home that shares the default home's runtime entries.
- Verify generated files that match the change, especially:
  - `opencode/` beneath the output_dir token
  - `codex/` beneath the output_dir token
  - `pi/` beneath the output_dir token
  - `claude-code/` beneath the output_dir token
  - `manifest.json` beneath the output_dir token
- Never move source-of-truth edits into the output_dir token; rebuild instead.

## Repo Docs And Maintenance

- Update `README.md` beneath the repo_root token when public usage, repository structure, build behavior, or setup flow changes.
- Update `AGENTS.md` beneath the repo_root token when repository operating rules or architecture change.
- If a new skill or command overlaps existing instructions, resolve the duplication instead of leaving conflicting guidance in multiple places.

## Quick Routing

- Add reusable agent behavior under the skills_dir token.
- Add reusable slash command or prompt under the commands_dir token.
- Add or adjust an assembled persona under the profiles_dir token.
- Add harness-specific shipped config under `harnesses/<target>/` beneath the repo_root token.
- Add a publishable standalone package under `packages/<package-name>/` beneath the repo_root token.
- Add a vendored third-party code package for a harness under `vendor/<name>/` beneath the repo_root token.
- Add shared system guidance under `system/` beneath the repo_root token.
- Add shared harness guidance under `harnesses/AGENTS.md` beneath the repo_root token.
- Add or update a vendored third-party skill under the skills_dir token plus `skills-lock.json` beneath the repo_root token.
- OpenCode configuration lives in `harnesses/opencode/opencode.jsonc` beneath the repo_root token.
- Codex docs snapshots, build logic, and Codex-only shipped skills live under `harnesses/codex/` beneath the repo_root token.
- Pi shared settings seed plus harness-local prompts, extensions, and skills live under `harnesses/pi/` beneath the repo_root token.
- Claude Code shared `settings.json` plus harness-local config surfaces and skills live under `harnesses/claude-code/` beneath the repo_root token.
