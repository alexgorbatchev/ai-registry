# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, the shared system prompt, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`skills/`**: Domain-specific AI skills. Skills are grouped into `skills/agent/` for agent-runnable skills and `skills/user/` for user-invokable skills. Each skill lives in its own folder with a `SKILL.md`. User skills in `skills/user/` do not contain `disable-model-invocation: true` in their source `SKILL.md`; the build/bootstrap process automatically injects it into generated harness outputs. In generated outputs, skills from `agent/` and `user/` are merged flat into `skills/`. This directory is also the repo's install surface for `npx skills`.
- **`commands/`**: Reusable slash commands, system prompts, and task blueprints.
- **`github-issues`**: The GitHub issue workflow, which lives in the private overlay.
- **`github-pr`**: Reusable PR skill with two modes. Creating covers concise descriptions in the account owner's first-person voice, related issue references from commit messages, change types, and test results and risks. Reviewing covers acknowledging every review comment with a reaction, verifying each against the code, and summarizing the verdicts before any reply. Both modes thank external authors when their PRs are merged, closed, or superseded.
- **`skills/AGENTS.md`**: Skill-authoring rules use concrete acceptance checks and bounded reviews for AI agent instructions, without numerical quality scores. Generic skills contain no harness-specific instructions; those belong under `harnesses/<target>/skills/`.
- **Writer skills**: `prompt-writer` applies whenever generating, writing, or revising AI agent instructions in any artifact. `skill-writer` adds skill-bundle routing, frontmatter, resources, and validation. `docs-writer` owns project documentation structure and maintenance; both relevant writers apply when documentation contains agent instructions.
- **Matt Pocock skills**: All skills authored by `mattpocock` live under `skills/user/` and require explicit user invocation. These workflows may depend on other bundled user skills.
  Preserve third-party-authored skill content; keep local policies in registry-owned guidance and record unresolved upstream findings.
- **`system/`**: Shared repo-level instruction fragments and persistent-memory guidance. `system/system.md` is the system prompt every generated harness ships: Codex `AGENTS.md`, Pi `APPEND_SYSTEM.md`, Claude Code `CLAUDE.md`, and OpenCode `instructions`.
  Models choose search and code-navigation tools according to the task and available capabilities; the registry does not mandate a search tool or tool ordering.
  Dependency investigation and library integration stay within the authorized task's required capabilities, using supported interfaces and intended usage patterns.
  Red/green and isolated test-sensitivity checks apply to changes in executable behavior; non-executable changes use applicable validators.
  Behavior-changing implementation work requires meaningful behavioral tests and at least 90% line and function coverage per affected first-party package, including unexecuted non-test source and excluding `scripts/` directories. Coverage commands and scope must be documented and configured; `just coverage` runs the `packages/registry-cli` and `harnesses/claude-code/hooks` gates, which count files no test loads as uncovered. Instruction-maintenance tasks use applicable validators and existing checks; newly specified but unimplemented enforcement stays recorded as follow-up work and does not block committing or merging the maintenance task. Existing failing checks remain subject to prerequisite repair. User-deferred generation or application does not prohibit independent verification or authorized source integration; unrun verification remains explicit.
  Concurrent-work guidance preserves other actors' changes, index state, locks, and refs. Only conflicting operations suspend; independent authorized work may continue in an owned, isolated worktree when safe. Staged-file age does not authorize takeover or a whole-worker halt.
  Routine branch and path-scoped index work uses existing task authorization after ownership checks. Codex and OpenCode guard explicit force/file-restoration checkout forms and reset modes; the shared instructions cover ownership, authorization, and equivalent syntax beyond those command-text matches.
- **`harnesses/`**: Harness-specific config overrides, unified-output build plugins, and repo-local harness maintenance guidance. Shipping files live under `harnesses/<target>/`, and repo-only build logic lives under `packages/registry-cli/src/harnesses/<target>/` when excluded via `.registry-ignore`.
- **`vendor/`**: Third-party code packages vendored into this repo as Bun workspaces when a harness needs a repo-local file path with installed runtime dependencies.
- **`packages/`**: Publishable repo-local packages distributed independently from the generated harness outputs.
- **`packages/opencode-session-analysis/`**: Bun CLI package for OpenCode session and skill-usage reporting.

### 2. Setup (`just bootstrap`)
`just bootstrap` is the repo-local clone-and-run entrypoint for this repository.

Root script entrypoints live directly under `packages/registry-cli/src/bin/` and use dash-based filenames. Helper modules that are imported by those entrypoints and are not intended to be executed directly belong under `packages/registry-cli/src/lib/`.

### 3. Generated Outputs (`.output/`)
The final generated harness artifacts. The registry updates only the files and paths it manages there, writes a manifest for those managed entries, and leaves unrelated harness-owned files in place.

## Building and Usage

This repository includes a custom local compiler (`packages/registry-cli/src/bin/build.ts`) that collects every skill and command and builds generated harness outputs directly from the checked-in source tree. Every harness ships every registry skill and command.

Generated harness outputs are compiled by plugins at `packages/registry-cli/src/harnesses/<target>/build.ts`. The root build statically imports those plugins and calls each one's `buildOutput` hook to write that harness's output root.

Source files keep their filenames and use [EJS](https://ejs.co/docs/) syntax. `just build` renders generated text outputs exactly once. Templates support native JavaScript expressions and control flow; only trusted templates should be built. Unknown variables, invalid JavaScript, failed includes, and missing environment values without defaults fail the build. Use raw output tags for paths and plain text; `<%= value %>` performs HTML escaping. Use `<%%` to emit a literal opening delimiter. Foreign `{{...}}` syntax passes through unchanged. Available locals:

- `<%- repo_root %>`: Absolute path to the repository root during template expansion.
- `<%- overlay_dir %>`: Absolute path to the last active private overlay directory, or empty string if none is configured. Use file_dir for resources relative to an asset in another overlay.
- `<%- skills_dir %>`: Absolute path to the repository's `skills/` directory.
- `<%- commands_dir %>`: Absolute path to the repository's `commands/` directory.
- `<%- output_dir %>`: Absolute path to the generated output root at `.output/`.
- `<%- file_path %>`: Absolute path to the original source file being rendered, even inside nested includes.
- `<%- file_dir %>`: Absolute path to the directory containing the original source file being rendered, even inside nested includes.
- `<%- include("/path/from/repo/root.md") %>`: Inserts another file using a repository-root-relative path.
- `<%- env("VAR_NAME") %>`: Inserts the value of the named environment variable and fails the build if it is missing. A variable the build process lacks, such as an API key that only your interactive shell startup files export, is read from your login shell, so cron-driven builds see it too.
- `<%- env("VAR_NAME", "fallback") %>`: Inserts the named environment variable, or the fallback value when the variable is unavailable.

When the build stages files from `skills/`, `commands/`, or `harnesses/<target>/`, it also honors nested `.registry-ignore` files using `.gitignore`-style matching. Use those files to keep repo-local scratch assets, harness build scripts, or other non-shipping files out of generated outputs.

When checked-in guidance or generated text refers to files inside this repository, use these variables instead of machine-specific absolute paths. Prefer `<%- skills_dir %>/...`, `<%- commands_dir %>/...`, and `<%- output_dir %>/...` for those canonical folders. Use `<%- repo_root %>/...` for canonical folders that do not have a dedicated token, such as `<%- repo_root %>/harnesses/...`, `<%- repo_root %>/system/...`, `<%- repo_root %>/vendor/...`, and `<%- repo_root %>/packages/registry-cli/...`. Relative includes resolve against the source file; a leading slash selects the repository root, so `<%- include("/system/system.md") %>` resolves from the repo root no matter which source file contains it. Resolved include paths outside the repository fail. Sync-back reconstructs canonical raw path-variable tags; edit expressions, includes, and control flow at their source.

For Vim, the project-local `.exrc` assigns `filetype=ejs` to Markdown files in this repository. Enable local configuration with `set exrc` in your vimrc and load the repository's `.exrc` when prompted by your editor. EJS syntax highlighting requires an EJS syntax plugin; filetype detection alone does not install one. EditorConfig does not provide a standard filetype property.

For the normal machine setup flow after cloning, run:

```bash
just bootstrap
```

### Private Overlay Registries

For proprietary or work-specific skills and commands that cannot be committed to a public repository, use the overlay registry feature:

1. Create a separate, private git repository for your work assets (e.g. `~/work/ai-registry`).
2. Mirror the standard directory structure:
   ```text
   my-work-registry/
   ├── skills/
   │   ├── agent/internal-tool/SKILL.md
   │   └── user/manual-task/SKILL.md
   └── commands/
       └── jira-ticket.md
   ```
3. Set the overlay paths in shell configuration or `.env` (automatically loaded by Bun and git-ignored):
   ```bash
   AI_REGISTRY_OVERLAY=~/work/ai-registry:~/personal/ai-registry
   ```
4. Run `just build` or `just bootstrap`. The build merges assets from left to right; the last matching skill or command wins. Both build and bootstrap print skill conflict notes with the selected and replaced source paths.

Separate paths with the platform PATH separator (`:` on Linux/macOS, `;` on Windows). Each entry supports `~`; relative paths resolve from the registry checkout. Empty entries are ignored. Repeated normalized paths keep their last occurrence, so `A:B:A` is processed as `B:A`. Missing paths produce warnings and are skipped.

Each overlay may contain `skills/`, `commands/`, and `harnesses/`. Skill bundles are replaced as a whole, not merged file by file. Harness-specific skill overrides retain their precedence over all overlays.

Overlay harness files carry private settings, such as MCP servers with private URLs. A file at `harnesses/<path>` in an overlay layers the public synced settings file at the same path, for example `harnesses/codex/config.toml` or `harnesses/opencode/opencode.jsonc`. The build renders it as a template and deep-merges it over the public source in overlay order: objects merge per key, and other values, lists included, replace earlier ones. When a harness edits a merged setting, the build writes the change back to the layer defining the longest part of its key path, with later overlays winning ties, and removes a deleted key from every layer that defines it. An overlay file under `harnesses/` that matches no synced settings file fails the build.

Claude Code reads user-scope MCP servers only from its global `.claude.json`. Declare them under `mcpServers` in `harnesses/claude-code/claude.json`, in the public registry or an overlay. `just build` only renders them into the generated output; `just bootstrap` writes the declared servers into `$CLAUDE_CONFIG_DIR/.claude.json` or `~/.claude.json`, removes servers the registry stopped declaring, and leaves every other key, including servers added with `claude mcp add`, alone.

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
AI_REGISTRY_HOSTNAME=workstation-a just build
```

Hostnames must start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens. An empty or invalid override fails the build. If no matching variant directory exists, the build uses the default `SKILL.md`. A matching directory must contain a regular `SKILL.md` file with valid YAML frontmatter, a non-empty description and body, and the same name and author as the default; an invalid matching variant fails the build.

Selection happens within each resolved skill bundle, after private overlay and harness override precedence. This applies to reusable and harness-local skills across all four harnesses. The selected file is emitted as the normal `SKILL.md`; existing author prefixes and user-skill invocation rules still apply. References, scripts, and assets come from the bundle root. The entire root `variants/` directory is excluded from generated output, and selected variant source paths appear in build output.

Use the existing repository-root-relative `include` directive to share instructions between variants. Template expansion runs once, and `file_path` and `file_dir` refer to the selected variant's original source file and directory. Markdown links to bundled references should use their generated locations, such as `references/shared.md`.

Keep actual private hostnames and environment instructions in the private overlay. An overlay replaces the entire same-named skill bundle, so include every resource the private skill needs. An overlay skill without a matching variant uses its own default; it does not inherit a public variant.

The generated-output manifest records skill source paths. Generated-edit recovery writes changes to the selected variant and rejects recovery when the recorded source differs from the current selection, such as after switching hostnames. Rebuild with the original hostname and overlay before recovering those edits. Recovery reverses path tokens but does not reconstruct include directives; edit include-based skills in their source files to preserve those directives.

Rerun `just bootstrap` after pulling changes when you want to refresh generated outputs, reapply the generated OpenCode, Codex, Pi, and Claude Code outputs to their homes (see [Harness Homes](#harness-homes)), and resync the repo-local `air-*`, `pi-*`, and `cll` wrappers into `~/.local/bin`.

To smoke test that flow without touching your real XDG config paths, run:

```bash
just bootstrap-smoke
```

That command:

- runs `just setup`, which runs `bun install` and installs the repo-local Git hooks from `.githooks`
- installs dependencies for all root workspaces declared in `package.json`, including `vendor/*`, `packages/*`, the bundled GitHub reviewer helper, the disk-cleanup skill, and the Claude Code hooks
- builds the generated outputs
- verifies the previous generated-output manifest before overwriting managed generated paths in `.output/`
- automatically recovers supported harness-written generated-file edits into their mapped source and regenerates outputs when the manifest baseline confirms that source changes will not be overwritten; conflicts, unsupported recovery, or save failures preserve both versions and suspend output application, including with `-y`
- syncs harness settings files (Claude Code and Pi `settings.json`, Claude Code `keybindings.json`, OpenCode `opencode.jsonc` and `tui.json`, Codex `config.toml` and `hooks.json`) both ways instead of treating them as drift: changes the harness made are written back to `harnesses/<name>/` and committed when the file had no other uncommitted edits, and registry changes are applied to the live file
- links the managed entries of `.output/opencode` into the real `${XDG_CONFIG_HOME:-~/.config}/opencode` directory
- links the managed entries of `.output/codex` into the real `${CODEX_HOME:-~/.codex}` directory
- links the managed entries of `.output/pi` into the real `${PI_CODING_AGENT_DIR:-~/.pi/agent}` directory
- links the managed entries of `.output/claude-code` into the real `${CLAUDE_CONFIG_DIR:-~/.claude}` directory
- symlinks every `air-*`, `pi-*`, and `cll` helper from `.output/bin` into `~/.local/bin`
- removes broken public-wrapper symlinks from `~/.local/bin` before recreating the current links
- backs up any existing conflicting target directories before replacing them

Run `just bootstrap` from the primary checkout after pulling to refresh the generated outputs, the harness home links, and the repo-local wrapper symlinks; the scheduled update also bootstraps on every run. Bootstrap refuses to run in a linked worktree, because it links the machine's harness homes to the checkout it runs in and a worktree's output disappears with the worktree; use `just build` to verify changes there. After bootstrap configures `core.hooksPath`, the checked-in `pre-push` hook scans every commit a push would publish with [gitleaks](https://github.com/gitleaks/gitleaks) and blocks the push on findings, so `gitleaks` must be installed and on `PATH`; record a reviewed false positive in `.gitleaksignore`.

### Scheduled updates

The repository's `.cronrc` schedules updates every five minutes through `cron-person`. Run `just cron-enable` to validate, authorize, and install it; rerun this after editing `.cronrc`. The update script creates `.state`, appends output to `.state/scheduled-update.log`, and skips overlapping runs by locking `.state/scheduled-update.lock` with native `lockf` on macOS or [`flock`](https://man7.org/linux/man-pages/man1/flock.1.html) on Linux. Every new log line starts with a timestamp in the process's local timezone formatted as `[YYYY-MM-DD HH:MM]`, for example `[2026-10-16 13:09]`. Each run prunes entries older than 48 hours at minute precision before appending output. Entries without this timestamp format are discarded. Manual runs use the same lock. The checkout must remain on `main` tracking `origin/main` to update from GitHub's main branch.

- `just cron-check`: validate this repository's `.cronrc`.
- `just cron-status`: inspect this repository's authorization and tasks.
- `just cron-show`: preview the managed crontab for all authorized directories.
- `just cron-sync`: refresh the managed crontab without changing authorization.
- `just cron-disable`: revoke this repository's authorization and remove its scheduled tasks.
- `just cron-logs`: print the last 100 lines of scheduled-update output.

Run `just scheduled-update` to pull the current branch's configured upstream and run `just bootstrap -y` on every run, so settings the harnesses changed on this machine are synced into the working tree without creating commits, even when the pull brings nothing new. Scheduled bootstrap sets `AI_REGISTRY_SETTINGS_AUTO_COMMIT=0`; manual build and bootstrap keep their settings auto-commit behavior. The pull rebases local commits onto the upstream branch and suppresses Git hooks so bootstrap runs once. A checkout with staged, unstaged, or untracked changes is left alone: the run skips the pull and push and still bootstraps, and it pulls again once the checkout is clean. If the rebase conflicts, the script restores the original HEAD and skips bootstrap. A failed bootstrap skips the push; the next run retries it. Failures return a nonzero exit status, while an overlapping run exits successfully without doing work.

After a successful pull and bootstrap, the updater pushes outgoing commits to the current branch's configured upstream, even when the pull brought in no new commits. It pushes only that branch, keeps push hooks enabled, and never force-pushes or publishes tags. Uncommitted edits remain local. A rejected push leaves commits intact for the next run to pull/rebase and retry. GitHub pushes are blocked when outgoing commit messages or patches contain restricted private domains; unknown push destinations also block the push. The `pre-push` gitleaks scan applies to these pushes too.

An interrupted update or failed rollback leaves `.state/scheduled-update-recovery.json` and stops further updates. Inspect the recorded original HEAD, then finish recovery before removing that file. Finish any existing Git merge, rebase, or cherry-pick before running the updater. Rebasing changes local commit IDs.

The entrypoint at `packages/registry-cli/src/bin/scheduled-update.ts` resolves the repository from its own location, so it can also be invoked by absolute path from another working directory. The lock covers log pruning, pull, bootstrap, push, and all log writes, including when the launcher is terminated while its worker continues running. It uses the running Bun executable for bootstrap and puts that executable's directory on the child processes' `PATH`.

For Linux cron without `cron-person`, replace `/path/to/ai-registry` with the checkout location and `/path/to/bun` with the absolute executable path reported by `command -v bun`. Locking and logging stay inside the script:

```cron
*/5 * * * * /path/to/bun /path/to/ai-registry/packages/registry-cli/src/bin/scheduled-update.ts
```

Use the account whose harness configuration should be refreshed. Git must be on the scheduler's `PATH`, and upstream authentication must work without interactive prompts. Linux also requires `flock`. The lock coordinates invocations of this script; it does not lock out editors or other Git commands. This script updates the registry checkout; it does not pull a private overlay repository.

To compile the configurations, simply run:

```bash
just setup
just build
```

Development tasks live in `justfile` recipes; `package.json` files have no `scripts`. The root `justfile` links each package's own `justfile` as a module (`registry-cli`, `template-resolver`, `session-analysis`, `disk-cleanup`, `claude-code-hooks`). Run `just check` to type check and validate every package (formatting, lint, type checks, unused code, and tests), `just fix` to apply formatting and lint fixes, `just test` to run every package's tests, and `just --list --list-submodules` to see all recipes. All first-party test commands isolate their fixtures in unique scratch directories and remove those directories after success, failure, timeout, or interruption; coverage reports are consumed before cleanup.

### Repo-local PATH commands

The repo-local OpenCode session tools are:

- `air-opencode-session-analysis`
- `air-opencode-session-export`
- `air-opencode-conversation-extract`

`air-opencode-session-analysis` exposes `skills` and `sessions` subcommands. Run `air-opencode-session-analysis --help` to see the current command interface.

Use `air-opencode-session-analysis skills --sync --pick` from a project directory to choose used skills and copy them into that project's `.opencode/skills/` directory. The command writes `.opencode/skills-manifest.json` so later runs can refresh the same selection automatically, warn about newly used skills that are not in the saved selection, and detect drift in the managed copied files before overwriting them. When the command cannot auto-detect this repository as the skill source, pass `--registry-dir <path>`.

Run `just bootstrap` to symlink these wrappers into `~/.local/bin`. If you prefer to manage `PATH` directly, add `.output/bin/` to your `PATH` instead.

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
just skills-add 'npx skills add https://github.com/shadcn/ui --skill shadcn'
```

```bash
npx skills add https://github.com/shadcn/ui --skill shadcn -a openclaw --copy -y
```

`just skills-add` parses the raw `npx skills add ...` command, forces the repo-safe vendoring flags behind the scenes, and rebuilds the generated outputs afterward.

Why `-a openclaw` under the hood? The Skills CLI uses `skills/` as OpenClaw's project-local skill directory, so this is the cleanest way to copy an external skill straight into this repo's canonical `skills/` surface.

When you vendor or update external skills:

- commit both `skills/<name>/` and `skills-lock.json`
- use `just skills-update` to refresh all vendored external skills safely
- use `bun run packages/registry-cli/src/bin/update-vendored-skills.ts <name>` to refresh only one vendored skill
- run `just build` afterward so generated outputs stay current

Avoid plain `npx skills update` in this repo. The upstream project-update flow does not preserve the `openclaw --copy` target and may create extra agent directories such as `.claude/` or `.pi/`.

### Using with OpenCode

The build script generates unified final outputs in `.output/` for the targets that belong there:

- `.output/opencode`: OpenCode config with skills (copied from source with template tags resolved), commands, `tui.json`, and plugin specs; it generates no agents, and `opencode.jsonc` loads `system/system.md` through `instructions`. The OpenCode-specific final shaping now lives in `packages/registry-cli/src/harnesses/opencode/build.ts`.
- `.output/codex`: Codex home root with `AGENTS.md` from `system/system.md`, `config.toml`, `hooks.json`, `rules/`, and generated `skills/`, including every command packaged as a native skill that requires explicit invocation. Runtime files such as `auth.json` stay Codex-owned under `CODEX_HOME` instead of being registry-managed.
- `.output/pi`: Pi agent root with `APPEND_SYSTEM.md` from `system/system.md`, `settings.json`, `prompts/`, and generated `skills/` (copied from source with template tags resolved). The Pi-specific shaping lives in `packages/registry-cli/src/harnesses/pi/build.ts`.
- `.output/claude-code`: Claude Code config root matching the layout Claude Code expects at `CLAUDE_CONFIG_DIR`, with `CLAUDE.md` from `system/system.md`, `settings.json`, `keybindings.json`, `commands/`, and generated `skills/` (copied from source with template tags resolved). The Claude Code-specific shaping lives in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- `.output/manifest.json`: SHA-256 manifest for managed generated files, directories, symlinks, mapped source paths, and source fingerprints under `.output/`. Builds automatically recover supported harness edits when source fingerprints and fresh generated output match their recorded baselines and supported transformations reverse exactly. Recovery supports plain text, canonical raw path tags, and generated skill name/invocation metadata; EJS includes, expressions, control flow, and other transformations require source edits. Conflicts, missing baselines/mappings, or save failures preserve the edits and stop output application without an overwrite prompt. Existing drift in older manifests without source fingerprints must be reconciled into source before a clean generation can establish a fresh baseline; `-y` does not discard it. After recovery, a fresh generation pass updates all copies; further drift suspends application for reconciliation. Unmanaged files are preserved. Synced harness settings files are listed under `syncedFilePaths` instead of the managed entries and reconciled key by key with source, using previous merged values under `.state/settings-sync/`.

Local files outside version control live in three git-ignored directories. `.tmp/` holds disposable development artifacts such as test fixtures, build staging, coverage, and the bootstrap smoke home; anything in it may be deleted between sessions. `.state/` holds long-lived state: the settings-sync merge bases and the scheduled update's log, lock, and recovery marker. `.cache/` holds rebuildable caches.

The build writes only final generated outputs into `.output/` and updates only the managed paths recorded in the manifest.

### Harness Homes

Harness runtime state never lives in `.output/`. Each harness home is a real directory outside the repository, and bootstrap links the harness output's managed entries into it:

| Harness | Home |
| --- | --- |
| Claude Code | `${CLAUDE_CONFIG_DIR:-~/.claude}` |
| Codex | `${CODEX_HOME:-~/.codex}` |
| Pi | `${PI_CODING_AGENT_DIR:-~/.pi/agent}` |
| OpenCode | `${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/opencode}` |

- bootstrap links only the top-level entries the manifest records for the harness output, such as `CLAUDE.md`, `skills/`, `commands/`, and the synced settings file
- sessions, transcripts, history, databases, logs, worktrees, installed plugins, and credentials stay where the harness writes them, in the home itself, so deleting `.output/` or moving the checkout never hides or splits them
- rerunning bootstrap from a relocated checkout repoints the managed links and leaves runtime state untouched
- a real file or directory that occupies a managed name is kept as `<name>.backup-<timestamp>` before the link replaces it
- links into the harness output whose target the build no longer generates are removed
- bootstrap refuses a home that is still a symlink; move the state it points at into a real directory first

For local file-based OpenCode plugins that need runtime dependencies from this repo, keep the OpenCode config entry in `harnesses/opencode/opencode.jsonc` and vendor the plugin package itself under `vendor/`. The generated config can then point at `file://<%- repo_root %>/vendor/<name>/...` while `bun install` satisfies its imports from the repo workspace install.

### Using with Codex

The Codex harness compiles `.output/codex/`, which bootstrap applies to `${CODEX_HOME:-~/.codex}`.

- `AGENTS.md` is a copy of `system/system.md`
- set `AI_REGISTRY_CODEX_TRUSTED_DIRS` to a PATH-style list of folders (for example `~/development`) to trust every git checkout beneath them, including declared submodules; Codex matches trust by exact checkout path, so trusting a parent folder alone covers nothing below it. The entries go into the generated `config.toml` only, and trust Codex records itself, including `untrusted`, takes precedence
- `config.toml` syncs both ways with `harnesses/codex/config.toml` on every build, keeping comments; trusted projects, hook trust, notices, and MCP credentials stay local to the machine
- `skills/` contains every registry skill, Codex-only harness skills, and every command as a native skill bundle, with template tags resolved
- command bundles preserve their Markdown instructions and description and disable implicit invocation through `agents/openai.yaml`; invoke `--commit-changed-files.md` as `$command-commit-changed-files` or select it through `/skills`
- commands with an explicit YAML `name` use that skill name; otherwise names use `command-<filename>` with leading hyphens removed and repeated hyphens collapsed
- commands require YAML frontmatter with a non-empty `description`; invalid skill names, duplicate command names, and collisions with skills stop the build
- Codex outputs have no managed `prompts/` directory, and no `codex` wrapper is generated, so the real `codex` binary stays on `PATH` untouched

### Using with Pi

The Pi harness compiles `.output/pi/`, which bootstrap applies to `${PI_CODING_AGENT_DIR:-~/.pi/agent}`.

- `APPEND_SYSTEM.md` is a copy of `system/system.md`
- `prompts/` holds every registry command plus `harnesses/pi/prompts/`; a name collision stops the build
- `skills/` holds every registry skill plus Pi-only harness skills under `harnesses/pi/skills/` (grouped into `agent/` and `user/`), copied with template tags resolved
- `settings.json` syncs both ways with `harnesses/pi/settings.json`; `models.json`, `web-search.json`, and `extensions/` are copied when the harness ships them

Bootstrap also links generated Pi helpers into `~/.local/bin`:

- `pi-install`, `pi-update`, and `pi-uninstall` manage Pi packages in `harnesses/pi/settings.json` and rebuild afterward
- no `pi` wrapper is generated, so the real `pi` binary stays on `PATH` untouched and reads `${PI_CODING_AGENT_DIR:-~/.pi/agent}`

### Using with Claude Code

The Claude Code harness compiles `.output/claude-code/`, which bootstrap applies to `${CLAUDE_CONFIG_DIR:-~/.claude}`.

- `CLAUDE.md` is a copy of `system/system.md`; `commands/` holds every registry command
- per-project memory files and transcripts (`projects/`), session history, todo lists, file history, and installed plugins live in the real Claude Code home, never in the generated output
- every file shipped under `harnesses/claude-code/` other than `skills/` is copied into the output root, so new native config surfaces such as `agents/` or `output-styles/` need no build changes
- `skills/` holds every registry skill plus Claude Code-only harness skills under `harnesses/claude-code/skills/` (grouped into `agent/` and `user/`), copied with template tags resolved

Bootstrap also links generated Claude Code helpers into `~/.local/bin`:

- `cll` launches Claude Code routed through LiteLLM (reading `ANTHROPIC_BASE_URL` or `LITELLM_BASE_URL`, and `ANTHROPIC_AUTH_TOKEN` or `LITELLM_API_KEY`), defaulting to `gemini-3.7-flash` (or a custom model name passed as the first argument)
- no `claude` wrapper is generated, so the real `claude` binary stays on `PATH` untouched and reads `~/.claude`

### Bootstrap Overrides

Override the default target locations with:

- `OPENCODE_CONFIG_DIR`
- `CODEX_HOME`
- `PI_CODING_AGENT_DIR`
- `CLAUDE_CONFIG_DIR`

The smoke test uses `.tmp/bootstrap-smoke/` inside this repository for that path.
Treat `.tmp/bootstrap-smoke/` as a fake `HOME`, with a fresh repo copy staged at `.tmp/bootstrap-smoke/development/ai-registry`.

### Other Harnesses

Add other generated harness outputs by putting the source of truth under `harnesses/<target>/` plus a build plugin at `packages/registry-cli/src/harnesses/<target>/build.ts`.
