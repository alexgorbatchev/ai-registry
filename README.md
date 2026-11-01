# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`skills/`**: Domain-specific AI skills. Skills are grouped into `skills/agent/` for agent-runnable skills and `skills/user/` for user-invokable skills. Each skill lives in its own folder with a `SKILL.md`. User skills in `skills/user/` do not contain `disable-model-invocation: true` in their source `SKILL.md`; the build/bootstrap process automatically injects it into generated harness outputs. In generated outputs, skills from `agent/` and `user/` are merged flat into `skills/`. This directory is also the repo's install surface for `npx skills`.
- **`commands/`**: Reusable slash commands, system prompts, and task blueprints.
- **`github-issues`**: The GitHub issue workflow, which lives in the private overlay.
- **`github-pr`**: Reusable PR skill with two modes. Creating covers concise descriptions in the account owner's first-person voice, related issue references from commit messages, change types, and test results and risks. Reviewing covers acknowledging every review comment with a reaction, verifying each against the code, and summarizing the verdicts before any reply.
- **`skills/AGENTS.md`**: Skill-authoring rules use concrete acceptance checks and bounded reviews for AI agent instructions, without numerical quality scores. Generic skills contain no harness-specific instructions; those belong under `harnesses/<target>/skills/`.
- **Writer skills**: `prompt-writer` applies whenever generating, writing, or revising AI agent instructions in any artifact. `skill-writer` adds skill-bundle routing, frontmatter, resources, and validation. `docs-writer` owns project documentation structure and maintenance; both relevant writers apply when documentation contains agent instructions.
- **Matt Pocock skills**: All skills authored by `mattpocock` live under `skills/user/` and require explicit user invocation. These workflows may depend on other bundled user skills.
  Preserve third-party-authored skill content; keep local policies in registry-owned guidance and record unresolved upstream findings.
- **`system/`**: Shared repo-level instruction fragments and persistent-memory guidance that harness configs can reference via template includes.
  Models choose search and code-navigation tools according to the task and available capabilities; the registry does not mandate a search tool or tool ordering.
  Dependency investigation and library integration stay within the authorized task's required capabilities, using supported interfaces and intended usage patterns.
  Red/green and isolated test-sensitivity checks apply to changes in executable behavior; non-executable changes use applicable validators.
  Behavior-changing implementation work requires meaningful behavioral tests and at least 90% line and function coverage per affected first-party package, including unexecuted non-test source and excluding `scripts/` directories. Coverage commands and scope must be documented and configured; `bun run coverage` runs the `packages/registry-cli` gate, which counts files no test loads as uncovered. Instruction-maintenance tasks use applicable validators and existing checks; newly specified but unimplemented enforcement stays recorded as follow-up work and does not block committing or merging the maintenance task. Existing failing checks remain subject to prerequisite repair. User-deferred generation or application does not prohibit independent verification or authorized source integration; unrun verification remains explicit.
  Concurrent-work guidance preserves other actors' changes, index state, locks, and refs. Only conflicting operations suspend; independent authorized work may continue in an owned, isolated worktree when safe. Staged-file age does not authorize takeover or a whole-worker halt.
  Routine branch and path-scoped index work uses existing task authorization after ownership checks. Codex and OpenCode guard explicit force/file-restoration checkout forms and reset modes; the shared instructions cover ownership, authorization, and equivalent syntax beyond those command-text matches.
- **`harnesses/`**: Harness-specific config overrides, unified-output build plugins, and repo-local harness maintenance guidance. Shipping files live under `harnesses/<target>/`, and repo-only build logic lives under `packages/registry-cli/src/harnesses/<target>/` when excluded via `.registry-ignore`.
- **`vendor/`**: Third-party code packages vendored into this repo as Bun workspaces when a harness needs a repo-local file path with installed runtime dependencies.
- **`packages/`**: Publishable repo-local packages distributed independently from the generated harness outputs.
- **`packages/opencode-session-analysis/`**: Bun CLI package for OpenCode session and skill-usage reporting.

### 2. Setup (`bun run bootstrap`)
`bun run bootstrap` is the repo-local clone-and-run entrypoint for this repository.

Root script entrypoints live directly under `packages/registry-cli/src/bin/` and use dash-based filenames. Helper modules that are imported by those entrypoints and are not intended to be executed directly belong under `packages/registry-cli/src/lib/`.

### 3. Generated Outputs (`.output/`)
The final generated harness artifacts. The registry updates only the files and paths it manages there, writes a manifest for those managed entries, and leaves unrelated harness-owned files in place.

## Building and Usage

This repository includes a custom local compiler (`packages/registry-cli/src/bin/build.ts`) that resolves reusable assets and builds generated harness outputs directly from the checked-in source tree.

Generated harness outputs are compiled by plugins at `packages/registry-cli/src/harnesses/<target>/build.ts`. The root build statically imports those plugins and calls each plugin once to stage its native harness root.

Source files keep their filenames and use [EJS](https://ejs.co/docs/) syntax. `bun run build` renders generated text outputs exactly once. Templates support native JavaScript expressions and control flow; only trusted templates should be built. Unknown variables, invalid JavaScript, failed includes, and missing environment values without defaults fail the build. Use raw output tags for paths and plain text; `<%= value %>` performs HTML escaping. Use `<%%` to emit a literal opening delimiter. Foreign `{{...}}` syntax passes through unchanged. Available locals:

- `<%- repo_root %>`: Absolute path to the repository root during template expansion.
- `<%- overlay_dir %>`: Absolute path to the last active private overlay directory, or empty string if none is configured. Use file_dir for resources relative to an asset in another overlay.
- `<%- skills_dir %>`: Absolute path to the repository's `skills/` directory.
- `<%- commands_dir %>`: Absolute path to the repository's `commands/` directory.
- `<%- output_dir %>`: Absolute path to the generated output root at `.output/`.
- `<%- file_path %>`: Absolute path to the original source file being rendered, even inside nested includes.
- `<%- file_dir %>`: Absolute path to the directory containing the original source file being rendered, even inside nested includes.
- `<%- include("/path/from/repo/root.md") %>`: Inserts another file using a repository-root-relative path.
- `<%- env("VAR_NAME") %>`: Inserts the value of the named environment variable and fails the build if it is missing.
- `<%- env("VAR_NAME", "fallback") %>`: Inserts the named environment variable, or the fallback value when the variable is unavailable.

When the build stages files from `skills/`, `commands/`, or `harnesses/<target>/`, it also honors nested `.registry-ignore` files using `.gitignore`-style matching. Use those files to keep repo-local scratch assets, harness build scripts, or other non-shipping files out of generated outputs.

When checked-in guidance or generated text refers to files inside this repository, use these variables instead of machine-specific absolute paths. Prefer `<%- skills_dir %>/...`, `<%- commands_dir %>/...`, `<%- output_dir %>/...` for those canonical folders. Use `<%- repo_root %>/...` for canonical folders that do not have a dedicated token, such as `<%- repo_root %>/harnesses/...`, `<%- repo_root %>/system/...`, `<%- repo_root %>/vendor/...`, and `<%- repo_root %>/packages/registry-cli/...`. Relative includes resolve against the source file; a leading slash selects the repository root, so `<%- include("/system/system.md") %>` resolves from the repo root no matter which source file contains it. Resolved include paths outside the repository fail. Sync-back reconstructs canonical raw path-variable tags; edit expressions, includes, and control flow at their source.

For Vim, the project-local `.exrc` assigns `filetype=ejs` to Markdown files in this repository. Enable local configuration with `set exrc` in your vimrc and load the repository's `.exrc` when prompted by your editor. EJS syntax highlighting requires an EJS syntax plugin; filetype detection alone does not install one. EditorConfig does not provide a standard filetype property.

For the normal machine setup flow after cloning, run:

```bash
bun run bootstrap
```

### Private Overlay Registries

For proprietary or work-specific skills, commands, and harness configurations that cannot be committed to a public repository, use the overlay registry feature:

1. Create a separate, private git repository for your work assets (e.g. `~/work/ai-registry`).
2. Mirror the standard directory structure:
   ```text
   my-work-registry/
   ├── skills/
   │   ├── agent/internal-tool/SKILL.md
   │   └── user/manual-task/SKILL.md
   ├── commands/
   │   └── jira-ticket.md
   └── harnesses/
       └── codex/
           ├── config.toml
           └── skills/agent/internal-tool/SKILL.md
   ```
3. Set the overlay paths in shell configuration or `.env` (automatically loaded by Bun and git-ignored):
   ```bash
   AI_REGISTRY_OVERLAY=~/work/ai-registry:~/personal/ai-registry
   ```
4. Run `bun run build` or `bun run bootstrap`. The build layers public source and overlays from left to right; the last matching asset wins. Both build and bootstrap print skill conflict notes with the selected and replaced source paths.

Separate paths with the platform PATH separator (`:` on Linux/macOS, `;` on Windows). Each entry supports `~`; relative paths resolve from the registry checkout. Empty entries are ignored. Repeated normalized paths keep their last occurrence, so `A:B:A` is processed as `B:A`. Missing paths produce warnings and are skipped.

Merge reusable skills and commands from public source, then overlays left to right. Layer native files from `harnesses/<target>/` in the same order: directories combine, and the last matching file replaces the whole file. Settings files are not merged across layers; runtime settings sync targets the winning file in its owning repository. Resolve skills as complete bundles in this order: public reusable skills, overlay reusable skills, public harness skills, then overlay harness skills. Last match wins; never retain resources from a replaced bundle. Honor each layer’s `.registry-ignore`. Keep source mappings and fingerprints attached to the winning files for rendering and safe sync-back. All resolved skills and reusable commands ship to each harness; there is no asset-selection manifest. Native harness commands take precedence over reusable commands with the same filename.

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

Selection happens within each resolved skill bundle, after private overlay and harness override precedence. This applies to reusable and harness-local skills across all four harnesses. The selected file is emitted as the normal `SKILL.md`; existing author prefixes and user-skill invocation rules still apply. References, scripts, and assets come from the bundle root. The entire root `variants/` directory is excluded from generated output, and selected variant source paths appear in build output.

Use the existing repository-root-relative `include` directive to share instructions between variants. Template expansion runs once, and `file_path` and `file_dir` refer to the selected variant's original source file and directory. Markdown links to bundled references should use their generated locations, such as `references/shared.md`.

Keep actual private hostnames and environment instructions in the private overlay. An overlay replaces the entire same-named skill bundle, so include every resource the private skill needs. An overlay skill without a matching variant uses its own default; it does not inherit a public variant.

The generated-output manifest records skill source paths. Generated-edit recovery writes changes to the selected variant and rejects recovery when the recorded source differs from the current selection, such as after switching hostnames. Rebuild with the original hostname and overlay before recovering those edits. Recovery reverses path tokens but does not reconstruct include directives; edit include-based skills in their source files to preserve those directives.

Rerun `bun run bootstrap` after pulling changes to rebuild outputs, refresh the native harness homes, and resync the generated helpers in `~/.local/bin`.

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
- links the managed entries of `.output/opencode` into the real `${XDG_CONFIG_HOME:-~/.config}/opencode` directory
- links the managed entries of `.output/codex` into the configured native home
- links the managed entries of `.output/pi` into the configured native home
- links the managed entries of `.output/claude-code` into the configured native home
- symlinks every generated helper from `.output/bin` into `~/.local/bin`
- removes broken public-wrapper symlinks from `~/.local/bin` before recreating the current links
- backs up any existing conflicting target directories before replacing them

After bootstrap configures `core.hooksPath`, future `git pull` operations rerun `bun run bootstrap -- -y` automatically through checked-in `post-merge` and `post-rewrite` hooks, covering both merge-based pulls and `git pull --rebase`. That keeps generated outputs, native harness links, and helper symlinks refreshed. The checked-in `pre-push` hook scans every commit a push would publish with [gitleaks](https://github.com/gitleaks/gitleaks) and blocks the push on findings, so `gitleaks` must be installed and on `PATH`; record a reviewed false positive in `.gitleaksignore`.

### Scheduled updates

The repository's `.cronrc` schedules updates every five minutes through `cron-person`. Run `just cron-enable` to validate, authorize, and install it; rerun this after editing `.cronrc`. The update script creates `.tmp`, appends output to `.tmp/scheduled-update.log`, and skips overlapping runs using native `lockf` on macOS or [`flock`](https://man7.org/linux/man-pages/man1/flock.1.html) on Linux. Every new log line starts with a timestamp in the process's local timezone formatted as `[YYYY-MM-DD HH:MM]`, for example `[2026-10-16 13:09]`. Each run prunes entries older than 48 hours at minute precision before appending output. Entries without this timestamp format are discarded. Manual runs use the same lock. The checkout must remain on `main` tracking `origin/main` to update from GitHub's main branch.

- `just cron-check`: validate this repository's `.cronrc`.
- `just cron-status`: inspect this repository's authorization and tasks.
- `just cron-show`: preview the managed crontab for all authorized directories.
- `just cron-sync`: refresh the managed crontab without changing authorization.
- `just cron-disable`: revoke this repository's authorization and remove its scheduled tasks.
- `just cron-logs`: print the last 100 lines of scheduled-update output.

Run `bun run scheduled:update` to pull the current branch's configured upstream and run `bun run bootstrap -- -y` on every run, so settings the harnesses changed on this machine are synced into the working tree without creating commits, even when the pull brings nothing new. Scheduled bootstrap sets `AI_REGISTRY_SETTINGS_AUTO_COMMIT=0`; manual build and bootstrap keep their settings auto-commit behavior. The pull rebases local commits onto the upstream branch and suppresses Git hooks so bootstrap runs once. A checkout with staged, unstaged, or untracked changes is left alone: the run skips the pull and push and still bootstraps, and it pulls again once the checkout is clean. If the rebase conflicts, the script restores the original HEAD and skips bootstrap. A failed bootstrap skips the push; the next run retries it. Failures return a nonzero exit status, while an overlapping run exits successfully without doing work.

After a successful pull and bootstrap, the updater pushes outgoing commits to the current branch's configured upstream, even when the pull brought in no new commits. It pushes only that branch, keeps push hooks enabled, and never force-pushes or publishes tags. Uncommitted edits remain local. A rejected push leaves commits intact for the next run to pull/rebase and retry. GitHub pushes are blocked when outgoing commit messages or patches contain restricted private domains; unknown push destinations also block the push. The `pre-push` gitleaks scan applies to these pushes too.

An interrupted update or failed rollback leaves `.tmp/scheduled-update-recovery.json` and stops further updates. Inspect the recorded original HEAD, then finish recovery before removing that file. Finish any existing Git merge, rebase, or cherry-pick before running the updater. Rebasing changes local commit IDs.

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

*Generated outputs are compiled by the harness build plugins under `packages/registry-cli/src/harnesses/<target>/build.ts`. Today that produces `.output/opencode`, `.output/codex`, `.output/pi`, and `.output/claude-code`.*

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

### Native Harness Outputs

The build produces one root per harness, with all resolved reusable skills and commands. Native files come from layered public and overlay harness directories.

| Harness | Output | Instructions | Reusable commands | Home |
| --- | --- | --- | --- | --- |
| OpenCode | `.output/opencode` | Native config and agents | `commands/` | `${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/opencode}` |
| Codex | `.output/codex` | `AGENTS.md` | Explicit native skills | `${CODEX_HOME:-~/.codex}` |
| Pi | `.output/pi` | `APPEND_SYSTEM.md` | `prompts/` | `${PI_CODING_AGENT_DIR:-~/.pi/agent}` |
| Claude Code | `.output/claude-code` | `CLAUDE.md` | `commands/` | `${CLAUDE_CONFIG_DIR:-~/.claude}` |

The checked-in instruction files include shared guidance from `system/system.md`. Override native files under an overlay’s matching `harnesses/<target>/` tree. Configure native agents and permissions directly in that harness’s format.

Codex commands require YAML frontmatter with a non-empty `description`. Their Markdown becomes `SKILL.md`, with `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. An explicit `name` is honored; otherwise names use `command-<filename>` with leading hyphens removed and repeated hyphens collapsed. Names must be lowercase kebab-case and at most 64 characters. Duplicate names and collisions with resolved skills fail the build. Invoke with `$<skill-name>` or `/skills`.

- `.output/manifest.json`: SHA-256 manifest for managed generated files, directories, symlinks, mapped source paths, and source fingerprints under `.output/`. Builds automatically recover supported harness edits when source fingerprints and fresh generated output match their recorded baselines and supported transformations reverse exactly. Recovery supports plain text, canonical raw path tags, and generated skill name/invocation metadata; EJS includes, expressions, control flow, and other transformations require source edits. Conflicts, missing baselines/mappings, or save failures preserve the edits and stop output application without an overwrite prompt. Existing drift in older manifests without source fingerprints must be reconciled into source before a clean generation can establish a fresh baseline; `-y` does not discard it. After recovery, a fresh generation pass updates all copies; further drift suspends application for reconciliation. Unmanaged files are preserved. Synced harness settings files are listed under `syncedFilePaths` instead of the managed entries and reconciled key by key with source, using previous merged values under `.tmp/settings-sync/`.

### Harness Homes

Runtime state stays in real native homes outside the repository. Bootstrap links only the manifest’s top-level managed entries and synced settings into each home. Sessions, databases, credentials, history, and installed plugins remain harness-owned. Conflicting real managed entries are retained as `<name>.backup-<timestamp>`; relocated checkout links are repointed. A home that is itself a symlink is refused.

The Pi package helpers `pi-install`, `pi-update`, and `pi-uninstall` remain available. The `cll` helper routes Claude Code through LiteLLM. Native harness binaries run directly with their configured homes.

### Bootstrap Overrides

Set `OPENCODE_CONFIG_DIR`, `CODEX_HOME`, `PI_CODING_AGENT_DIR`, or `CLAUDE_CONFIG_DIR` before bootstrap to change a home. Bootstrap accepts `--yes`/`-y` for unattended operation.

The smoke test stages an isolated repository under `.tmp/bootstrap-smoke/development/ai-registry` and treats `.tmp/bootstrap-smoke/` as a fake home. It verifies initial setup, repeated setup, and runtime-state preservation without using caller overlays or home overrides.

### Other Harnesses

Add other generated harness outputs by putting the source of truth under `harnesses/<target>/` plus a build plugin at `packages/registry-cli/src/harnesses/<target>/build.ts`.
