# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`skills/`**: Domain-specific AI skills. Skills are grouped into `skills/agent/` for agent-runnable skills and `skills/user/` for user-invokable skills. Each skill lives in its own folder with a `SKILL.md`. User skills in `skills/user/` do not contain `disable-model-invocation: true` in their source `SKILL.md`; the build/bootstrap process automatically injects it into generated harness outputs. In generated outputs, skills from `agent/` and `user/` are merged flat into `skills/`. This directory is also the repo's install surface for `npx skills`.
- **`commands/`**: Reusable slash commands, system prompts, and task blueprints.
- **`github-fix-issues`**: One harness-independent skill for filing issues, implementing tickets by priority then oldest first with prerequisite ordering, and explicitly requested historical issue-merge repair. One implementer keeps one issue active through merge and cleanup. A verified blocker suspends that issue and its dependents, preserves its artifacts and resume state, and allows the next independent issue in the authorized queue to proceed. Suspended issues are rechecked at selection boundaries. Pending CI or a running review keeps the current issue active. After pushing a PR, the implementer watches CI, fixes failures until green, requests bot review, and repeats CI/review for findings. CI supplies the check results; PR descriptions reference their issues without log transcripts or evidence packages. Reviewers report actionable findings and otherwise submit native approval without summaries. Green CI and native approval gate fast-forward integration. See the [workflow reference](docs/internal/references/github-issue-workflow.md).
  Missing acceptance headings do not block requirements recoverable from verified sources. Unresolved material requirements or priority ambiguity suspend only affected tickets and dependents; agents continue independent authorized work without inventing behavior or ranks.
  CI readiness is checked before implementation. Infrastructure recovery follows repository retry policy or a two-rerun fallback, with retry state preserved across restarts; ordinary pending checks or review remain active work.
  Setup also checks tools, repository identity, implementer and distinct reviewer authentication, access, and protection compatibility before implementation. The workflow uses `main` without silently substituting another branch. Missing prerequisites suspend dependent actions while prepared work and non-secret resume state are preserved.
  After publication, reconciliation follows repository polling policy or a 120-second window with 15-second polls. Persisted state survives restarts; closure and cleanup require the published commit in remote `main` and the expected PR head in native `MERGED` state. Missing native state suspends affected work without repeating publication. Current fetch/API results supply verification without a separate connectivity check.
  Its [reviewer helper](skills/agent/github-fix-issues/references/setup.md) verifies bot access, automatically invites and accepts when needed, and immediately lists open issues oldest first using saved local configuration.
  Queue ownership records identify the task, worker, owned paths, and any externally supplied lease. Checkpoints preserve resume state; they do not restart workers. Scheduler wakeups require an authorized, configured interface and verified acceptance; otherwise the worker preserves state and reports the exact redispatch requirement. Scheduler installation and worker restart dispatch remain a separate runtime integration requirement.
  Completion reports give concise verified check results and material limitations, with native CI links or existing local log paths where applicable. Raw logs remain in the execution system; local logs do not replace required CI.
  Task authorization includes the smallest same-repository baseline repair needed to unblock required checks, reproduced on the untouched base, with its own prerequisite ticket, change set, checks, review, and integration. Explicit exclusions and other owners' changes remain boundaries. Compatibility layers require explicit authorization; migration approval alone does not grant it, and authorized temporary layers include removal and verification.
- **`github-pr`**: Reusable PR skill with two modes. Creating covers concise descriptions in the account owner's first-person voice, related issue references from commit messages, change types, and test results and risks. Reviewing covers acknowledging every review comment with a reaction, verifying each against the code, and summarizing the verdicts before any reply.
- **`skills/AGENTS.md`**: Skill-authoring rules use concrete acceptance checks and bounded reviews for AI agent instructions, without numerical quality scores. Generic skills contain no harness-specific instructions; those belong under `harnesses/<target>/skills/`.
- **Writer skills**: `prompt-writer` applies whenever generating, writing, or revising AI agent instructions in any artifact. `skill-writer` adds skill-bundle routing, frontmatter, resources, and validation. `docs-writer` owns project documentation structure and maintenance; both relevant writers apply when documentation contains agent instructions.
- **Matt Pocock skills**: All skills authored by `mattpocock` live under `skills/user/` and require explicit user invocation. These workflows may depend on other bundled user skills.
  Preserve third-party-authored skill content; keep local policies in registry-owned guidance and record unresolved upstream findings.
- **`system/`**: Shared repo-level instruction fragments and persistent-memory guidance that harness configs and profiles can reference via template includes.
  Models choose search and code-navigation tools according to the task and available capabilities; the registry does not mandate a search tool or tool ordering.
  Dependency investigation and library integration stay within the authorized task's required capabilities, using supported interfaces and intended usage patterns.
  Red/green and isolated test-sensitivity checks apply to changes in executable behavior; non-executable changes use applicable validators.
  Behavior-changing implementation work requires meaningful behavioral tests and at least 90% line and function coverage per affected first-party package, including unexecuted non-test source and excluding `scripts/` directories. Coverage commands and scope must be documented and configured. Instruction-maintenance tasks use applicable validators and existing checks; newly specified but unimplemented enforcement stays recorded as follow-up work and does not block committing or merging the maintenance task. Existing failing checks remain subject to prerequisite repair. User-deferred generation or application does not prohibit independent verification or authorized source integration; unrun verification remains explicit.
  Concurrent-work guidance preserves other actors' changes, index state, locks, and refs. Only conflicting operations suspend; independent authorized work may continue in an owned, isolated worktree when safe. Staged-file age does not authorize takeover or a whole-worker halt.
  Routine branch and path-scoped index work uses existing task authorization after ownership checks. Codex and OpenCode guard explicit force/file-restoration checkout forms and reset modes; the shared instructions cover ownership, authorization, and equivalent syntax beyond those command-text matches.
- **`harnesses/`**: Harness-specific config overrides, unified-output build plugins, and repo-local harness maintenance guidance. Shipping files live under `harnesses/<target>/`, and repo-only build logic lives under `packages/registry-cli/src/harnesses/<target>/` when excluded via `.registry-ignore`.
- **`vendor/`**: Third-party code packages vendored into this repo as Bun workspaces when a harness needs a repo-local file path with installed runtime dependencies.
- **`packages/`**: Publishable repo-local packages distributed independently from the generated harness outputs.
- **`packages/opencode-session-analysis/`**: Bun CLI package for OpenCode session and skill-usage reporting.

### 2. The Profiles (`profiles/`)
The assembled agents. These folders contain `profile.yaml` manifests that cherry-pick from the reusable assets using globs to create specific AI personas. You can also define custom tool toggles and granular tool permissions in these files.
- Profiles may also define top-level local assets:
  - `profiles/<name>/commands/*.md` for profile-owned commands
  - `profiles/<name>/skills/<skill-name>/SKILL.md` for profile-owned skills
- Profile-local commands are emitted into OpenCode as namespaced shared commands named `--<profile>-<filename>.md`.
- Profile-local skills keep their normal skill names and therefore must not collide with global skills or another profile's local skills.
- For skills, `['*']` expands to the global skill set only. A profile also receives its own `profiles/<name>/skills/*` skills, and OpenCode additionally auto-allows harness-local skills that match `<harness-name>-*`, but it does not gain access to another profile's local skills.
- **`personal-assistant/`**: General-purpose personal assistant with stronger defaults for practical consumer tasks such as showtime searches.
- **`designer/`**: UI/UX focused agent.
- **`developer/`**: Backend/Fullstack focused agent.

### 3. Setup (`bun run bootstrap`)
`bun run bootstrap` is the repo-local clone-and-run entrypoint for this repository.

Root script entrypoints live directly under `packages/registry-cli/src/bin/` and use dash-based filenames. Helper modules that are imported by those entrypoints and are not intended to be executed directly belong under `packages/registry-cli/src/lib/`.

### 4. Generated Outputs (`.output/`)
The final generated harness artifacts. The registry updates only the files and paths it manages there, writes a manifest for those managed entries, and leaves unrelated harness-owned files in place.

### Standalone Claude Skills Installation

To install all skills into your current directory's `.claude/skills/` folder without `bun`, `git clone`, or repository bootstrapping:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-claude-skills.sh | bash
```

See [`INSTALL_CLAUDE_SKILLS.md`](INSTALL_CLAUDE_SKILLS.md) for detailed usage and customization options.

## Building and Usage

This repository includes a custom local compiler (`packages/registry-cli/src/bin/build.ts`) that resolves the profiles and builds generated harness outputs directly from the checked-in source tree.

Generated harness outputs are compiled by plugins at `packages/registry-cli/src/harnesses/<target>/build.ts`. The root build statically imports those plugins and lets them stage per-profile artifacts plus finalize the generated harness output.

Source files keep their filenames and use [EJS](https://ejs.co/docs/) syntax. `bun run build` renders generated text outputs exactly once. Templates support native JavaScript expressions and control flow; only trusted templates should be built. Unknown variables, invalid JavaScript, failed includes, and missing environment values without defaults fail the build. Use raw output tags for paths and plain text; `<%= value %>` performs HTML escaping. Use `<%%` to emit a literal opening delimiter. Foreign `{{...}}` syntax passes through unchanged. Available locals:

- `<%- repo_root %>`: Absolute path to the repository root during template expansion.
- `<%- overlay_dir %>`: Absolute path to the active private overlay directory, or empty string if none is configured.
- `<%- skills_dir %>`: Absolute path to the repository's `skills/` directory.
- `<%- commands_dir %>`: Absolute path to the repository's `commands/` directory.
- `<%- profiles_dir %>`: Absolute path to the repository's `profiles/` directory.
- `<%- output_dir %>`: Absolute path to the generated output root at `.output/`.
- `<%- file_path %>`: Absolute path to the original source file being rendered, even inside nested includes.
- `<%- file_dir %>`: Absolute path to the directory containing the original source file being rendered, even inside nested includes.
- `<%- include("/path/from/repo/root.md") %>`: Inserts another file using a repository-root-relative path.
- `<%- env("VAR_NAME") %>`: Inserts the value of the named environment variable and fails the build if it is missing.
- `<%- env("VAR_NAME", "fallback") %>`: Inserts the named environment variable, or the fallback value when the variable is unavailable.

When the build stages files from `skills/`, `commands/`, or `harnesses/<target>/`, it also honors nested `.registry-ignore` files using `.gitignore`-style matching. Use those files to keep repo-local scratch assets, harness build scripts, or other non-shipping files out of generated outputs.

When checked-in guidance or generated text refers to files inside this repository, use these variables instead of machine-specific absolute paths. Prefer `<%- skills_dir %>/...`, `<%- commands_dir %>/...`, `<%- profiles_dir %>/...`, and `<%- output_dir %>/...` for those canonical folders. Use `<%- repo_root %>/...` for canonical folders that do not have a dedicated token, such as `<%- repo_root %>/harnesses/...`, `<%- repo_root %>/system/...`, `<%- repo_root %>/vendor/...`, and `<%- repo_root %>/packages/registry-cli/...`. Relative includes resolve against the source file; a leading slash selects the repository root, so `<%- include("/system/system.md") %>` resolves from the repo root no matter which source file contains it. Resolved include paths outside the repository fail. Sync-back reconstructs canonical raw path-variable tags; edit expressions, includes, and control flow at their source.

For Vim, the project-local `.exrc` assigns `filetype=ejs` to Markdown files in this repository. Enable local configuration with `set exrc` in your vimrc and load the repository's `.exrc` when prompted by your editor. EJS syntax highlighting requires an EJS syntax plugin; filetype detection alone does not install one. EditorConfig does not provide a standard filetype property.

For the normal machine setup flow after cloning, run:

```bash
bun run bootstrap
```

### Private Overlay Registries

For proprietary or work-specific skills, commands, and profiles that cannot be committed to a public repository, use the overlay registry feature:

1. Create a separate, private git repository for your work assets (e.g. `~/work/ai-registry`).
2. Mirror the standard directory structure:
   ```text
   my-work-registry/
   ├── skills/
   │   └── internal-tool/SKILL.md
   ├── commands/
   │   └── jira-ticket.md
   └── profiles/
       └── work/
           └── profile.yaml
   ```
3. Set the overlay path in `.env` (automatically loaded by Bun and git-ignored):
   ```bash
   AI_REGISTRY_OVERLAY=~/work/ai-registry
   ```
4. Run `bun run build` or `bun run bootstrap`. The build will automatically merge assets from the overlay. On name collision, overlay assets take precedence.

### Hostname Skill Variants

Keep a default `SKILL.md` in each skill bundle and place machine-specific versions under `variants/<hostname>/SKILL.md`:

```text
skills/agent/example/
├── SKILL.md
├── references/shared.md
└── variants/
    └── workstation-a/
        └── SKILL.md
```

The build detects the operating system hostname once and selects an exact match, preserving case and domain suffixes. Set `AI_REGISTRY_HOSTNAME` in your local environment or `.env` to select a different hostname:

```bash
AI_REGISTRY_HOSTNAME=workstation-a bun run build
```

Hostnames must start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens. An empty or invalid override fails the build. If no matching variant directory exists, the build uses the default `SKILL.md`. A matching directory must contain a regular `SKILL.md` file with valid YAML frontmatter, a non-empty description and body, and the same name and author as the default; an invalid matching variant fails the build.

Selection happens within each resolved skill bundle, after private overlay and harness override precedence. This applies to reusable, profile-local, and harness-local skills across all four harnesses. The selected file is emitted as the normal `SKILL.md`; existing author prefixes and user-skill invocation rules still apply. References, scripts, and assets come from the bundle root. The entire root `variants/` directory is excluded from generated output, and selected variant source paths appear in build output.

Use the existing repository-root-relative `include` directive to share instructions between variants. Template expansion runs once, and `file_path` and `file_dir` refer to the selected variant's original source file and directory. Markdown links to bundled references should use their generated locations, such as `references/shared.md`.

Keep actual private hostnames and environment instructions in the private overlay. An overlay replaces the entire same-named skill bundle, so include every resource the private skill needs. An overlay skill without a matching variant uses its own default; it does not inherit a public variant.

The generated-output manifest records skill source paths. Generated-edit recovery writes changes to the selected variant and rejects recovery when the recorded source differs from the current selection, such as after switching hostnames. Rebuild with the original hostname and overlay before recovering those edits. Recovery reverses path tokens but does not reconstruct include directives; edit include-based skills in their source files to preserve those directives.

Rerun `bun run bootstrap` after pulling changes when you want to refresh generated outputs, relink the OpenCode config, relink the generated `default` Codex profile into `~/.codex`, relink the generated `default` Pi profile into `~/.pi/agent`, relink the generated `default` Claude Code profile into `~/.claude`, and resync the repo-local `air-*`, `claude-*`, `codex-*`, `pi-*`, and `cll` wrappers into `~/.local/bin`. Add `-- --codex-profile <profile>`, `-- --pi-profile <profile>`, and/or `-- --claude-code-profile <profile>` when you want to override those linked non-native profile targets.

To smoke test that flow without touching your real XDG config paths, run:

```bash
bun run bootstrap:smoke
```

That command:

- runs `bun install`
- installs dependencies for all root workspaces declared in `package.json`, including `vendor/*`, `packages/*`, the bundled GitHub reviewer helper, and the disk-cleanup skill
- installs the repo-local Git hooks from `.githooks`
- builds the generated outputs
- verifies the previous generated-output manifest before overwriting managed generated paths in `.output/`
- automatically recovers supported harness-written generated-file edits into their mapped source and regenerates outputs when the manifest baseline confirms that source changes will not be overwritten; conflicts, unsupported recovery, or save failures preserve both versions and suspend output application, including with `-y`
- syncs harness settings files (Claude Code and Pi `settings.json`, OpenCode `opencode.jsonc`, Codex `config.toml`) both ways instead of treating them as drift: changes the harness made are written back to `harnesses/<name>/` and committed when the file had no other uncommitted edits, and registry changes are applied to the live file
- links `.output/opencode` into `${XDG_CONFIG_HOME:-~/.config}/opencode`
- links `.output/codex/default` into `${CODEX_HOME:-~/.codex}` by default, or links `.output/codex/<profile>` when you pass `-- --codex-profile <profile>`
- links `.output/pi/default` into `${PI_CODING_AGENT_DIR:-~/.pi/agent}` by default, or links `.output/pi/<profile>` when you pass `-- --pi-profile <profile>`
- links `.output/claude-code/default` into `${CLAUDE_CONFIG_DIR:-~/.claude}` by default, or links `.output/claude-code/<profile>` when you pass `-- --claude-code-profile <profile>`
- symlinks every `air-*`, `claude-*`, `codex-*`, `pi-*`, and `cll` helper from `.output/bin` into `~/.local/bin`
- removes broken public-wrapper symlinks from `~/.local/bin` before recreating the current links
- backs up any existing conflicting target directories before replacing them

After bootstrap configures `core.hooksPath`, future `git pull` operations rerun `bun run bootstrap -- -y` automatically through checked-in `post-merge` and `post-rewrite` hooks, covering both merge-based pulls and `git pull --rebase`. That keeps generated outputs, the default Codex, Pi, and Claude Code links, and the repo-local wrapper symlinks refreshed. Add `-- --codex-profile <profile>`, `-- --pi-profile <profile>`, and/or `-- --claude-code-profile <profile>` when you need non-default linked targets. The checked-in `pre-push` hook scans every commit a push would publish with [gitleaks](https://github.com/gitleaks/gitleaks) and blocks the push on findings, so `gitleaks` must be installed and on `PATH`; record a reviewed false positive in `.gitleaksignore`.

### Scheduled updates

The repository's `.cronrc` schedules updates every five minutes through `cron-person`. Run `just cron-enable` to validate, authorize, and install it; rerun this after editing `.cronrc`. The update script creates `.tmp`, appends output to `.tmp/scheduled-update.log`, and skips overlapping runs using native `lockf` on macOS or [`flock`](https://man7.org/linux/man-pages/man1/flock.1.html) on Linux. Every new log line starts with a timestamp in the process's local timezone formatted as `[YYYY-MM-DD HH:MM]`, for example `[2026-10-16 13:09]`. Each run prunes entries older than 48 hours at minute precision before appending output. Entries without this timestamp format are discarded. Manual runs use the same lock. The checkout must remain on `main` tracking `origin/main` to update from GitHub's main branch.

- `just cron-check`: validate this repository's `.cronrc`.
- `just cron-status`: inspect this repository's authorization and tasks.
- `just cron-show`: preview the managed crontab for all authorized directories.
- `just cron-sync`: refresh the managed crontab without changing authorization.
- `just cron-disable`: revoke this repository's authorization and remove its scheduled tasks.
- `just cron-logs`: print the last 100 lines of scheduled-update output.

Run `bun run scheduled:update` to pull the current branch's configured upstream and run `bun run bootstrap -- -y` when the pull changes the checked-out commit. The pull rebases local commits onto the upstream branch and suppresses Git hooks so bootstrap runs once. Tracked local edits are temporarily stashed and restored with their staged and unstaged state after the pull. Non-overlapping edits within an incoming file can be combined. If the rebase or stash restoration conflicts, the script restores the original HEAD and local edits and skips bootstrap. Untracked files stay in place; incoming files that would overwrite them block the update. A failed bootstrap leaves `.tmp/scheduled-update-pending`, which makes the next successful pull retry bootstrap even without new commits. Failures return a nonzero exit status, while an overlapping run exits successfully without doing work.

After a successful pull and any required bootstrap, the updater pushes outgoing commits to the current branch's configured upstream, even when the pull brought in no new commits. It pushes only that branch, keeps push hooks enabled, and never force-pushes or publishes tags. Uncommitted edits remain local. A rejected push leaves commits intact for the next run to pull/rebase and retry; a successful bootstrap is not repeated just because pushing failed. GitHub pushes are blocked when outgoing commit messages or patches contain restricted private domains; unknown push destinations also block the push. The `pre-push` gitleaks scan applies to these pushes too.

An interrupted update or failed rollback leaves `.tmp/scheduled-update-recovery.json` and stops further updates. Inspect the recorded original HEAD, stash label, and saved stash (when recorded), then finish recovery before removing that file. Existing user stashes are preserved. Finish any existing Git merge, rebase, or cherry-pick before running the updater. Rebasing changes local commit IDs.

The entrypoint at `packages/registry-cli/src/bin/scheduled-update.ts` resolves the repository from its own location, so it can also be invoked by absolute path from another working directory. The lock covers log pruning, pull, bootstrap, push, and all log writes, including when the launcher is terminated while its worker continues running. It uses the running Bun executable for bootstrap and puts that executable's directory on the child processes' `PATH`.

For Linux cron without `cron-person`, replace `/path/to/ai-registry` with the checkout location and `/path/to/bun` with the absolute executable path reported by `command -v bun`. Locking and logging stay inside the script:

```cron
*/5 * * * * /path/to/bun /path/to/ai-registry/packages/registry-cli/src/bin/scheduled-update.ts
```

Use the account whose harness configuration should be refreshed. Git must be on the scheduler's `PATH`, and upstream authentication must work without interactive prompts. Linux also requires `flock`. The lock coordinates invocations of this script; it does not lock out editors or other Git commands. This script updates the registry checkout; it does not pull a private overlay repository.

To compile the configurations, simply run:

```bash
bun install
bun run build
```

### Repo-local PATH commands

The repo-local OpenCode session tools are:

- `air-opencode-session-analysis`
- `air-opencode-session-export`
- `air-opencode-conversation-extract`

`air-opencode-session-analysis` exposes `skills` and `sessions` subcommands. Run `air-opencode-session-analysis --help` to see the current command interface.

Use `air-opencode-session-analysis skills --sync --pick` from a project directory to choose used skills and copy them into that project's `.opencode/skills/` directory. The command writes `.opencode/skills-manifest.json` so later runs can refresh the same selection automatically, warn about newly used skills that are not in the saved selection, and detect drift in the managed copied files before overwriting them. When the command cannot auto-detect this repository as the skill source, pass `--registry-dir <path>`.

Run `bun run bootstrap` to symlink these wrappers into `~/.local/bin`. If you prefer to manage `PATH` directly, add `.output/bin/` to your `PATH` instead.

These wrappers execute the checked-in Bun source from this repository, so the clone and its installed dependencies must remain available on disk.

*Generated outputs are compiled by the harness build plugins under `packages/registry-cli/src/harnesses/<target>/build.ts`. Today that produces `.output/opencode`, `.output/codex`, and `.output/pi`.*

### Installing a Skill with `npx skills`

The repo now exposes its skills in the standard top-level `skills/` location, so you can install any individual skill with the Skills CLI.

```bash
npx skills add /path/to/ai-registry --list
npx skills add /path/to/ai-registry --skill typescript
npx skills add owner/repo --skill typescript
```

Use `--agent` to target specific harnesses and `-g` to install globally.

### Project-specific skill addenda

When a project needs to modify the behavior of a reusable base skill, use a project-local addendum skill instead of copying the full base skill into the project.

- Name the project-local skill `<base-skill>-addendum`.
- Write its description with this exact pattern so harnesses can route it from `name` and `description` alone: `If <base-skill> skill is used, this skill must be used as well.`
- Put only the project-specific delta in the addendum body.
- If the addendum conflicts with the base skill, the addendum wins for that project.
- Do not make the base global skill track project-local addenda.
- Do not create multiple addenda for the same base skill in one project.

Example:

- Base skill: `example-skill`
- Project-local addendum: `example-skill-addendum`
- Addendum description: `If example-skill skill is used, this skill must be used as well.`

### Vendoring External Skills with `npx skills`

This repo can also vendor third-party skills into its canonical top-level `skills/` directory.

Use the repo wrapper as the normal interface:

```bash
bun run skills:add 'npx skills add https://github.com/shadcn/ui --skill shadcn'
```

```bash
npx skills add https://github.com/shadcn/ui --skill shadcn -a openclaw --copy -y
```

`bun run skills:add` parses the raw `npx skills add ...` command, forces the repo-safe vendoring flags behind the scenes, and rebuilds the generated outputs afterward.

Why `-a openclaw` under the hood? The Skills CLI uses `skills/` as OpenClaw's project-local skill directory, so this is the cleanest way to copy an external skill straight into this repo's canonical `skills/` surface.

When you vendor or update external skills:

- commit both `skills/<name>/` and `skills-lock.json`
- use `bun run skills:update` to refresh all vendored external skills safely
- use `bun run packages/registry-cli/src/bin/update-vendored-skills.ts <name>` to refresh only one vendored skill
- run `bun run build` afterward so generated outputs stay current

Avoid plain `npx skills update` in this repo. The upstream project-update flow does not preserve the `openclaw --copy` target and may create extra agent directories such as `.claude/` or `.pi/`.

### Using with OpenCode

The build script generates unified final outputs in `.output/` for the targets that belong there:

- `.output/opencode`: OpenCode config with skills (copied from source with template tags resolved), commands, plugin specs, and generated persona files. The OpenCode-specific final shaping now lives in `packages/registry-cli/src/harnesses/opencode/build.ts`.
- `.output/codex/<profile>`: Codex profile root for one ai-registry profile. Each profile has its own `AGENTS.md` and generated `skills/`, including the default profile's commands packaged as native skills that require explicit invocation. Non-default roots symlink shared entries such as `config.toml` from `default/`. Runtime files such as `auth.json` stay Codex-owned under the active `CODEX_HOME` instead of being registry-managed.
- `.output/pi/<profile>`: Pi profile root for one ai-registry profile. Each generated profile renders its own `APPEND_SYSTEM.md` from `profiles/<name>/profile.yaml`; the generated `default` root provides the shared `settings.json`, `prompts/`, and static `sessions/` directory, while non-default roots symlink those shared entries from `default/` and keep their own generated `skills/` (copied from source with template tags resolved). The Pi-specific final shaping lives in `packages/registry-cli/src/harnesses/pi/build.ts`.
- `.output/claude-code/<profile>`: Claude Code config root for one ai-registry profile, matching the layout Claude Code expects at `CLAUDE_CONFIG_DIR`. Each generated profile renders its own `CLAUDE.md` from `profiles/<name>/profile.yaml`; the generated `default` root provides the shared `settings.json`, `commands/`, and the static runtime directories Claude Code writes into, while non-default roots symlink those shared entries from `default/` and keep their own generated `skills/` (copied from source with template tags resolved). The Claude Code-specific shaping lives in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- `.output/manifest.json`: SHA-256 manifest for managed generated files, directories, symlinks, mapped source paths, and source fingerprints under `.output/`. Builds automatically recover supported harness edits when source fingerprints and fresh generated output match their recorded baselines and supported transformations reverse exactly. Recovery supports plain text, canonical raw path tags, and generated skill name/invocation metadata; EJS includes, expressions, control flow, and other transformations require source edits. Conflicts, missing baselines/mappings, or save failures preserve the edits and stop output application without an overwrite prompt. Existing drift in older manifests without source fingerprints must be reconciled into source before a clean generation can establish a fresh baseline; `-y` does not discard it. After recovery, a fresh generation pass updates all copies; further drift suspends application for reconciliation. Runtime directories remain outside the manifest, never count as drift, are never removed by sync, and are recreated when missing. Unmanaged session and runtime files are preserved. Synced harness settings files are excluded too and reconciled key by key with source, using previous merged values under `.tmp/settings-sync/`.

The build writes only final generated outputs into `.output/` and updates only the managed paths recorded in the manifest.

For local file-based OpenCode plugins that need runtime dependencies from this repo, keep the OpenCode config entry in `harnesses/opencode/opencode.jsonc` and vendor the plugin package itself under `vendor/`. The generated config can then point at `file://<%- repo_root %>/vendor/<name>/...` while `bun install` satisfies its imports from the repo workspace install.

### Using with Codex

The Codex harness compiles the generated `default` profile into the shared Codex root under `.output/codex/default/`. Every generated Codex profile root renders its own `AGENTS.md` from that profile manifest's `system_prompt`, while non-default roots symlink the remaining shared entries from `default/` and keep only their own `skills/` directory.

- each generated profile contributes its own home-level `AGENTS.md` from `profiles/<name>/profile.yaml`
- the generated `default` profile contributes the shared command set and `config.toml`
- `config.toml` syncs both ways with `harnesses/codex/config.toml` on every build, keeping comments; trusted projects, hook trust, notices, and MCP credentials stay local to the machine
- each profile's `skills/` contains its selected skills, Codex-only harness skills, and copies of the default profile's selected commands as native skill bundles, with template tags resolved
- command bundles preserve their Markdown instructions and description and disable implicit invocation through `agents/openai.yaml`; invoke `--commit-changed-files.md` as `$command-commit-changed-files` or select it through `/skills`
- commands with an explicit YAML `name` use that skill name; otherwise names use `command-<filename>` with leading hyphens removed and repeated hyphens collapsed; default profile-local commands use `command-default-<filename>`
- commands require YAML frontmatter with a non-empty `description`; invalid skill names, duplicate command names, and collisions with selected skills stop the build
- non-default profiles inherit the default command set; their own command selections are not emitted
- non-default roots symlink every shared top-level entry from `default/` except `AGENTS.md` and `skills/`, keeping their own instructions and skills; Codex outputs have no managed `prompts/` directory

To link one generated Codex profile into your active Codex directories, run:

```bash
bun run bootstrap -- --codex-profile developer
```

Codex uses one active home directory at a time. This repository links the generated `default` profile into `${CODEX_HOME:-~/.codex}` during plain bootstrap, and `-- --codex-profile <profile>` overrides that link to a different generated profile root.

Bootstrap also links generated Codex launchers into `~/.local/bin`:

- `codex-<profile>` launches any non-default generated Codex profile by setting `CODEX_HOME`
- no bare `codex` wrapper is generated, so the real `codex` binary stays on `PATH` untouched and reads the generated `default` profile through the `${CODEX_HOME:-~/.codex}` symlink

### Using with Pi

The Pi harness compiles the generated `default` profile into the shared Pi root under `.output/pi/default/`. Every generated Pi profile root renders its own `APPEND_SYSTEM.md` from that profile manifest's `system_prompt`, while non-default roots symlink the remaining shared entries from `default/` and keep only their own `skills/` directory.

- each generated profile contributes its own `APPEND_SYSTEM.md` from `profiles/<name>/profile.yaml`
- the generated `default` profile contributes the shared `settings.json`, `prompts/`, and static `sessions/` directory
- `skills/` plus any Pi-only harness skills under `harnesses/pi/skills/` (grouped into `agent/` and `user/`) are generated per profile as copies with template tags resolved and remain the only non-default profile-specific Pi payload
- non-default generated Pi profile roots symlink every shared top-level entry from `default/` except `APPEND_SYSTEM.md` and `skills/`, so they inherit the default commands, settings, and sessions while keeping their own instructions and skills

To link one generated Pi profile into your active Pi config directory, run:

```bash
bun run bootstrap -- --pi-profile developer
```

Pi uses one active config root at a time. This repository links the generated `default` profile into `${PI_CODING_AGENT_DIR:-~/.pi/agent}` during plain bootstrap, and `-- --pi-profile <profile>` overrides that link to a different generated profile root.

Bootstrap also links generated Pi launchers into `~/.local/bin`:

- `pi-<profile>` launches any non-default generated Pi profile by setting `PI_CODING_AGENT_DIR`
- `pi-install`, `pi-update`, and `pi-uninstall` manage Pi packages in `harnesses/pi/settings.json` and rebuild afterward
- no bare `pi` wrapper is generated, so the real `pi` binary stays on `PATH` untouched and reads the generated `default` profile through the `${PI_CODING_AGENT_DIR:-~/.pi/agent}` symlink

### Using with Claude Code

The Claude Code harness compiles the generated `default` profile into the shared Claude Code config root under `.output/claude-code/default/`. Every generated Claude Code profile root renders its own `CLAUDE.md` from that profile manifest's `system_prompt`, while non-default roots symlink the remaining shared entries from `default/` and keep only their own `skills/` directory.

- each generated profile contributes its own user-global `CLAUDE.md` from `profiles/<name>/profile.yaml`
- the generated `default` profile contributes the shared `settings.json`, `commands/`, and the disposable runtime directories Claude Code writes into (`file-history/`, `session-env/`, and `statsig/`)
- everything Claude Code would be painful to lose — per-project memory files and transcripts (`projects/`), resumable session history (`sessions/`), todo lists (`todos/`), shell snapshots (`shell-snapshots/`), and installed plugins (`plugins/`) — lives outside the generated output under `${XDG_DATA_HOME:-~/.local/share}/ai-registry/claude-code/` and is symlinked into the generated `default` profile, so deleting `.output/` and rebuilding never loses it
- every file shipped under `harnesses/claude-code/` other than `skills/` is copied into the generated `default` root, so new native config surfaces such as `agents/` or `output-styles/` need no build changes
- `skills/` plus any Claude Code-only harness skills under `harnesses/claude-code/skills/` (grouped into `agent/` and `user/`) are generated per profile as copies with template tags resolved and remain the only non-default profile-specific Claude Code payload
- non-default generated Claude Code profile roots symlink every shared top-level entry from `default/` except `CLAUDE.md` and `skills/`, so they inherit the default commands, settings, and runtime state while keeping their own instructions and skills
- the Claude Code harness has no native equivalent for the manifest's `tools` and `permission` fields, so the build fails instead of silently dropping them

To link one generated Claude Code profile into your active Claude Code config directory, run:

```bash
bun run bootstrap -- --claude-code-profile developer
```

Claude Code uses one active config directory at a time. This repository links the generated `default` profile into `${CLAUDE_CONFIG_DIR:-~/.claude}` during plain bootstrap, and `-- --claude-code-profile <profile>` overrides that link to a different generated profile root.

Bootstrap also links generated Claude Code launchers into `~/.local/bin`:

- `claude-<profile>` launches any non-default generated Claude Code profile by setting `CLAUDE_CONFIG_DIR`
- `cll` launches Claude Code routed through LiteLLM (reading `ANTHROPIC_BASE_URL` or `LITELLM_BASE_URL`, and `ANTHROPIC_AUTH_TOKEN` or `LITELLM_API_KEY`), defaulting to `gemini-3.7-flash` (or a custom model name passed as the first argument)
- no `claude` wrapper is generated, so the real `claude` binary stays on `PATH` untouched and reads the generated `default` profile through the `~/.claude` symlink

### Bootstrap Overrides

Override the default target locations with:

- `OPENCODE_CONFIG_DIR`
- `CODEX_HOME`
- `PI_CODING_AGENT_DIR`
- `CLAUDE_CONFIG_DIR`

The smoke test uses `.tmp/bootstrap-smoke/` inside this repository for that path.
Treat `.tmp/bootstrap-smoke/` as a fake `HOME`, with a fresh repo copy staged at `.tmp/bootstrap-smoke/development/ai-registry`.

Once activated, you can open OpenCode and use the `Tab` key to seamlessly switch between generated personas on the fly. Codex, Pi, and Claude Code use one linked profile at a time, selected during bootstrap.

### Other Harnesses

Add other generated harness outputs by putting the source of truth under `harnesses/<target>/` plus a build plugin at `packages/registry-cli/src/harnesses/<target>/build.ts`.
