# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`skills/`**: Domain-specific AI skills. Each skill lives in its own folder with a `SKILL.md`. This directory is also the repo's install surface for `npx skills`.
- **`commands/`**: Reusable slash commands, system prompts, and task blueprints.
- **`system/`**: Shared repo-level instruction fragments and persistent-memory guidance that harness configs and profiles can reference via template includes.
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

### Standalone `simple-ptt` Installation

To download and extract the latest release of `simple-ptt` into `.tmp/simple-ptt`:

```bash
curl -fsSL https://raw.githubusercontent.com/alexgorbatchev/ai-registry/main/install-simple-ptt.sh | bash
```

See [`INSTALL_SIMPLE_PTT.md`](INSTALL_SIMPLE_PTT.md) for detailed usage and customization options.

## Building and Usage

This repository includes a custom local compiler (`packages/registry-cli/src/bin/build.ts`) that resolves the profiles and builds generated harness outputs directly from the checked-in source tree.

Generated harness outputs are compiled by plugins at `packages/registry-cli/src/harnesses/<target>/build.ts`. The root build statically imports those plugins and lets them stage per-profile artifacts plus finalize the generated harness output.

Generated output files may use a small set of build-time template tags. `bun run build` scans generated text outputs recursively and resolves them wherever they appear. Unsupported tags, unknown variables, missing include files, circular includes, and missing environment variables all fail the build. Supported forms:

- `{{repo_root}}`: Absolute path to the repository root during template expansion.
- `{{skills_dir}}`: Absolute path to the repository's `skills/` directory.
- `{{commands_dir}}`: Absolute path to the repository's `commands/` directory.
- `{{profiles_dir}}`: Absolute path to the repository's `profiles/` directory.
- `{{output_dir}}`: Absolute path to the generated output root at `.output/`.
- `{{file_path}}`: Absolute path to the original source file being rendered, even inside nested includes.
- `{{file_dir}}`: Absolute path to the directory containing the original source file being rendered, even inside nested includes.
- `{{include "path/from/repo/root.md"}}`: Inserts another file using a repository-root-relative path.
- `{{env "VAR_NAME"}}`: Inserts the value of the named environment variable and fails the build if it is missing.
- `{{env "VAR_NAME" default "fallback"}}`: Inserts the named environment variable, or the fallback value when the variable is unavailable.

When the build stages files from `skills/`, `commands/`, or `harnesses/<target>/`, it also honors nested `.registry-ignore` files using `.gitignore`-style matching. Use those files to keep repo-local scratch assets, harness build scripts, or other non-shipping files out of generated outputs.

When checked-in guidance or generated text refers to files inside this repository, use these variables instead of machine-specific absolute paths. Prefer `{{skills_dir}}/...`, `{{commands_dir}}/...`, `{{profiles_dir}}/...`, and `{{output_dir}}/...` for those canonical folders. Use `{{repo_root}}/...` for canonical folders that do not have a dedicated token, such as `{{repo_root}}/harnesses/...`, `{{repo_root}}/system/...`, `{{repo_root}}/vendor/...`, and `{{repo_root}}/packages/registry-cli/...`. Includes are always repository-root-relative, so `{{include "system/system.md"}}` resolves from the repo root no matter which source file contains it.

For the normal machine setup flow after cloning, run:

```bash
bun run bootstrap
```

Rerun `bun run bootstrap` after pulling changes when you want to refresh generated outputs, relink the OpenCode config, relink the generated `default` Codex profile into `~/.codex`, relink the generated `default` Pi profile into `~/.pi/agent`, relink the generated `default` Claude Code profile into `~/.claude`, and resync the repo-local `air-*`, `claude-*`, `codex-*`, `pi-*`, and `cll` wrappers into `~/.local/bin`. Add `-- --codex-profile <profile>`, `-- --pi-profile <profile>`, and/or `-- --claude-code-profile <profile>` when you want to override those linked non-native profile targets.

To smoke test that flow without touching your real XDG config paths, run:

```bash
bun run bootstrap:smoke
```

That command:

- runs `bun install`
- installs dependencies for all root workspaces declared in `package.json`, including `vendor/*` and `packages/*`
- installs the repo-local Git hooks from `.githooks`
- builds the generated outputs
- verifies the previous generated-output manifest before overwriting managed generated paths in `.output/`
- stops for confirmation when managed generated files drift from the last manifest, with `no` as the default; use `bun run build -- -y` or `bun run bootstrap -- -y` to auto-confirm
- links `.output/opencode` into `${XDG_CONFIG_HOME:-~/.config}/opencode`
- links `.output/codex/default` into `${CODEX_HOME:-~/.codex}` by default, or links `.output/codex/<profile>` when you pass `-- --codex-profile <profile>`
- links `.output/pi/default` into `${PI_CODING_AGENT_DIR:-~/.pi/agent}` by default, or links `.output/pi/<profile>` when you pass `-- --pi-profile <profile>`
- links `.output/claude-code/default` into `${CLAUDE_CONFIG_DIR:-~/.claude}` by default, or links `.output/claude-code/<profile>` when you pass `-- --claude-code-profile <profile>`
- symlinks every `air-*`, `claude-*`, `codex-*`, `pi-*`, and `cll` helper from `.output/bin` into `~/.local/bin`
- removes broken public-wrapper symlinks from `~/.local/bin` before recreating the current links
- backs up any existing conflicting target directories before replacing them

After bootstrap configures `core.hooksPath`, future `git pull` operations rerun `bun run bootstrap -- -y` automatically through checked-in `post-merge` and `post-rewrite` hooks, covering both merge-based pulls and `git pull --rebase`. That keeps generated outputs, the default Codex, Pi, and Claude Code links, and the repo-local wrapper symlinks refreshed. Add `-- --codex-profile <profile>`, `-- --pi-profile <profile>`, and/or `-- --claude-code-profile <profile>` when you need non-default linked targets.

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
- `.output/codex/<profile>`: Codex profile root for one ai-registry profile. Each generated profile renders its own `AGENTS.md` from `profiles/<name>/profile.yaml`; the generated `default` root provides the shared `prompts/` plus a symlinked mutable `config.toml`, while non-default roots symlink those shared entries from `default/` and keep their own generated `skills/` (copied from source with template tags resolved). The Codex-specific shaping lives in `packages/registry-cli/src/harnesses/codex/build.ts`, which reapplies `harnesses/codex/config.toml` as managed defaults into `{{repo_root}}/.tmp/codex/config.toml` on each build while preserving local Codex state. Runtime files such as `auth.json` stay Codex-owned under the active `CODEX_HOME` instead of being registry-managed.
- `.output/pi/<profile>`: Pi profile root for one ai-registry profile. Each generated profile renders its own `APPEND_SYSTEM.md` from `profiles/<name>/profile.yaml`; the generated `default` root provides the shared `settings.json`, `prompts/`, and static `sessions/` directory, while non-default roots symlink those shared entries from `default/` and keep their own generated `skills/` (copied from source with template tags resolved). The Pi-specific final shaping lives in `packages/registry-cli/src/harnesses/pi/build.ts`.
- `.output/claude-code/<profile>`: Claude Code config root for one ai-registry profile, matching the layout Claude Code expects at `CLAUDE_CONFIG_DIR`. Each generated profile renders its own `CLAUDE.md` from `profiles/<name>/profile.yaml`; the generated `default` root provides the shared `settings.json`, `commands/`, the `agents-md-vfs.js` preload symlinked from `vendor/claude-agents-md/`, and the static runtime directories Claude Code writes into, while non-default roots symlink those shared entries from `default/` and keep their own generated `skills/` (copied from source with template tags resolved). The Claude Code-specific shaping lives in `packages/registry-cli/src/harnesses/claude-code/build.ts`.
- `.output/manifest.json`: SHA-256 manifest for the generated files, directories, and symlinks that the registry manages under `.output/`. The next `bun run build` checks those managed entries before overwriting them so externally edited generated files are not overwritten silently. Runtime directories that the harness tools own (Claude Code `sessions/`, `todos/`, and its other state directories; Codex `sessions/`, `log/`, `.tmp/`; Pi `sessions/`) are created by the build so profiles can share them but are deliberately left out of the manifest: they never count as drift, are never removed by the build, and are recreated when a tool prunes them.

The build writes only final generated outputs into `.output/` and updates only the managed paths recorded in the manifest.

For local file-based OpenCode plugins that need runtime dependencies from this repo, keep the OpenCode config entry in `harnesses/opencode/opencode.jsonc` and vendor the plugin package itself under `vendor/`. The generated config can then point at `file://{{repo_root}}/vendor/<name>/...` while `bun install` satisfies its imports from the repo workspace install.

### Using with Codex

The Codex harness compiles the generated `default` profile into the shared Codex root under `.output/codex/default/`. Every generated Codex profile root renders its own `AGENTS.md` from that profile manifest's `system_prompt`, while non-default roots symlink the remaining shared entries from `default/` and keep only their own `skills/` directory.

- each generated profile contributes its own home-level `AGENTS.md` from `profiles/<name>/profile.yaml`
- the generated `default` profile contributes the shared `prompts/` and mutable `config.toml` symlink
- `harnesses/codex/config.toml` is continuously merged into `{{repo_root}}/.tmp/codex/config.toml` as the harness-managed defaults; Codex-owned local state such as trusted-project entries is preserved across rebuilds
- `skills/` plus any Codex-only harness skills under `harnesses/codex/skills/` are generated per profile as copies with template tags resolved and remain the only non-default profile-specific Codex payload
- non-default generated Codex profile roots symlink every shared top-level entry from `default/` except `AGENTS.md` and `skills/`, so they inherit the default commands and mutable state while keeping their own instructions and skills

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
- `skills/` plus any Pi-only harness skills under `harnesses/pi/skills/` are generated per profile as copies with template tags resolved and remain the only non-default profile-specific Pi payload
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
- `skills/` plus any Claude Code-only harness skills under `harnesses/claude-code/skills/` are generated per profile as copies with template tags resolved and remain the only non-default profile-specific Claude Code payload
- non-default generated Claude Code profile roots symlink every shared top-level entry from `default/` except `CLAUDE.md` and `skills/`, so they inherit the default commands, settings, and runtime state while keeping their own instructions and skills
- the Claude Code harness has no native equivalent for the manifest's `tools` and `permission` fields, so the build fails instead of silently dropping them

To link one generated Claude Code profile into your active Claude Code config directory, run:

```bash
bun run bootstrap -- --claude-code-profile developer
```

Claude Code uses one active config directory at a time. This repository links the generated `default` profile into `${CLAUDE_CONFIG_DIR:-~/.claude}` during plain bootstrap, and `-- --claude-code-profile <profile>` overrides that link to a different generated profile root.

Bootstrap also links generated Claude Code launchers into `~/.local/bin`:

- `claude-<profile>` launches any non-default generated Claude Code profile by setting `CLAUDE_CONFIG_DIR` and preloading that profile's `agents-md-vfs.js` through `BUN_OPTIONS`
- `cll` launches Claude Code routed through LiteLLM (reading `ANTHROPIC_BASE_URL` or `LITELLM_BASE_URL`, and `ANTHROPIC_AUTH_TOKEN` or `LITELLM_API_KEY`), defaulting to `gemini-3.7-flash` (or a custom model name passed as the first argument)
- no `claude` wrapper is generated, so the real `claude` binary stays on `PATH` untouched and reads the generated `default` profile through the `~/.claude` symlink

#### AGENTS.md Support

Claude Code natively reads `CLAUDE.md` only. Every generated Claude Code profile root exposes `agents-md-vfs.js`, the Bun preload vendored from the [alexgorbatchev/claude-agents-md](https://github.com/alexgorbatchev/claude-agents-md) fork of [hexsprite/claude-agents-md](https://github.com/hexsprite/claude-agents-md) and documented in [`vendor/claude-agents-md/README.md`](vendor/claude-agents-md/README.md). When Bun loads it into the `claude` process, `CLAUDE.md` lookups are served from the sibling `AGENTS.md`: a lone `AGENTS.md` is read as if it were `CLAUDE.md`, and a real `CLAUDE.md` next to it is appended as a Claude-only overlay. Nothing is written to disk, so repositories need no `CLAUDE.md` file or `@AGENTS.md` import.

The `claude-<profile>` launchers set `BUN_OPTIONS` themselves. For the bare `claude` command, define a shell function in the configuration that owns your shell startup so the preload is scoped to `claude` and never reaches other Bun processes:

```zsh
claude() {
  local vfs="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/agents-md-vfs.js"
  if [[ ! -f "$vfs" ]]; then
    command claude "$@"
    return $?
  fi
  local BUN_OPTIONS="${BUN_OPTIONS:-}"
  case " $BUN_OPTIONS " in
    *" --require $vfs "*) ;;
    *) BUN_OPTIONS="${BUN_OPTIONS:+$BUN_OPTIONS }--require $vfs" ;;
  esac
  BUN_OPTIONS="$BUN_OPTIONS" command claude "$@"
}
```

Set `AGENTS_MD_VFS_DEBUG=1` before starting `claude` to log every `CLAUDE.md` read with the branch it took (`read kind=path-swap ...` for a lone `AGENTS.md`) to `/tmp/agents-md-vfs-latest.log`; a `gate off: ...` line there means the preload rejected the binary.

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
