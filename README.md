# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`/skills`**: Domain-specific AI skills. Each skill lives in its own folder with a `SKILL.md`. This directory is also the repo's install surface for `npx skills`.
- **`/commands`**: Reusable slash commands, system prompts, and task blueprints.
- **`/system`**: Shared repo-level instruction fragments and persistent-memory guidance that harness configs and profiles can reference via template includes.
- **`/harnesses`**: Harness-specific config overrides, optional unified-output build plugins, and repo-local harness maintenance guidance. Shipping files live under `harnesses/<target>/`, and repo-only build logic can live under `harnesses/<target>/scripts/` when excluded via `.registry-ignore`.
- **`/vendor`**: Third-party code packages vendored into this repo as Bun workspaces when a harness needs a repo-local file path with installed runtime dependencies.
- **`/packages`**: Publishable repo-local packages distributed independently from the generated harness outputs.
- **`/packages/opencode-session-analysis`**: Bun CLI package for OpenCode session and skill-usage reporting.

### 2. The Profiles (`/profiles`)
The assembled agents. These folders contain `profile.yaml` manifests that cherry-pick from the reusable assets using globs to create specific AI personas. You can also define custom tool toggles and granular tool permissions in these files.
- Profiles may also define top-level local assets:
  - `profiles/<name>/commands/*.md` for profile-owned commands
  - `profiles/<name>/skills/<skill-name>/SKILL.md` for profile-owned skills
- Profile-local commands are emitted into OpenCode as namespaced shared commands named `--<profile>-<filename>.md`.
- Profile-local skills keep their normal skill names and therefore must not collide with global skills or another profile's local skills.
- Set `profile_skills_only: true` in a profile manifest when that profile should be allowed to use only its own `profiles/<name>/skills/*` skills. Global skills can still be packaged for other profiles, but that profile's generated skill permission map will deny them.
- **`personal-assistant/`**: General-purpose personal assistant with stronger defaults for practical consumer tasks such as showtime searches.
- **`designer/`**: UI/UX focused agent.
- **`developer/`**: Backend/Fullstack focused agent.
- **`default/`**: General-purpose baseline agent.

### 3. Setup (`bun run bootstrap`)
`bun run bootstrap` is the repo-local clone-and-run entrypoint for this repository.

Root script entrypoints live directly under `scripts/` and use dash-based filenames. Helper modules that are imported by those entrypoints and are not intended to be executed directly belong under `scripts/lib/`.

### 4. Generated Outputs (`/.output`)
The final generated harness artifacts. This directory is rebuilt from source and should only contain consumable outputs.

## Building and Usage

This repository includes a custom local compiler (`scripts/build.ts`) that resolves the profiles and builds generated harness outputs directly from the checked-in source tree.

Profile manifests support an optional `profile_skills_only: true` flag for OpenCode builds when a persona should use only its profile-local skills while still sharing the rest of the generated output with other profiles.

Harnesses that need extra output shaping can expose a plugin entrypoint at `harnesses/<target>/scripts/build.ts`. The root build discovers those plugins dynamically and lets them stage per-profile artifacts plus finalize the generated harness output.

Generated output files may use a small set of build-time template tags. `bun run build` scans generated text outputs recursively and resolves them wherever they appear. Unsupported tags, unknown variables, missing include files, circular includes, and missing environment variables all fail the build. Supported forms:

- `{{repo_root}}`
- `{{skills_dir}}`
- `{{commands_dir}}`
- `{{profiles_dir}}`
- `{{output_dir}}`
- `&#123;&#123; include "path/from/repo/root.md" &#125;&#125;`
- `&#123;&#123; env "VAR_NAME" &#125;&#125;`
- `&#123;&#123; env "VAR_NAME" default "fallback" &#125;&#125;`

Current built-in string variables:

- `{{repo_root}}`
- `{{skills_dir}}`
- `{{commands_dir}}`
- `{{profiles_dir}}`
- `{{output_dir}}`

When the build stages files from `skills/`, `commands/`, or `harnesses/<target>/`, it also honors nested `.registry-ignore` files using `.gitignore`-style matching. Use those files to keep repo-local scratch assets, harness build scripts, or other non-shipping files out of generated outputs.

When checked-in guidance or generated text refers to files inside this repository, use these variables instead of machine-specific absolute paths. Prefer `{{skills_dir}}/...`, `{{commands_dir}}/...`, `{{profiles_dir}}/...`, and `{{output_dir}}/...` for those canonical folders. Use `{{repo_root}}/...` for canonical folders that do not have a dedicated token, such as `{{repo_root}}/harnesses/...`, `{{repo_root}}/system/...`, `{{repo_root}}/vendor/...`, and `{{repo_root}}/scripts/...`. Includes are always repository-root-relative, so `&#123;&#123; include "system/system.md" &#125;&#125;` resolves from the repo root no matter which source file contains it.

For the normal machine setup flow after cloning, run:

```bash
bun run bootstrap
```

To smoke test that flow without touching your real XDG config paths, run:

```bash
bun run bootstrap:smoke
```

That command:

- runs `bun install`
- installs dependencies for all root workspaces declared in `package.json`, including `vendor/*` and `packages/*`
- installs the repo-local Git hooks from `.githooks`
- builds the generated outputs
- verifies the previous generated-output manifest before replacing `.output/`
- stops for confirmation when generated files drift from the last manifest, with `no` as the default; use `bun run build -- -y` or `bun run bootstrap -- -y` to auto-confirm
- links `.output/opencode` into `${XDG_CONFIG_HOME:-~/.config}/opencode`
- backs up any existing conflicting target directories before replacing them

After bootstrap configures `core.hooksPath`, future `git pull` operations rerun `bun run bootstrap -- -y` automatically through checked-in `post-merge` and `post-rewrite` hooks, covering both merge-based pulls and `git pull --rebase`.

To compile the configurations, simply run:

```bash
bun install
bun run build
```

*Generated outputs are discovered from the checked-in harness build plugins under `harnesses/<target>/scripts/build.ts`. Today that produces `.output/opencode`.*

### Installing a Skill with `npx skills`

The repo now exposes its skills in the standard top-level `skills/` location, so you can install any individual skill with the Skills CLI.

```bash
npx skills add /path/to/ai-registry --list
npx skills add /path/to/ai-registry --skill react-development
npx skills add owner/repo --skill react-development
```

Use `--agent` to target specific harnesses and `-g` to install globally.

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
- use `bun run scripts/update-vendored-skills.ts <name>` to refresh only one vendored skill
- run `bun run build` afterward so generated outputs stay current

Avoid plain `npx skills update` in this repo. The upstream project-update flow does not preserve the `openclaw --copy` target and may create extra agent directories such as `.claude/` or `.pi/`.

### Using with OpenCode

The build script generates unified final outputs in `.output/` for the targets that belong there:

- `.output/opencode`: OpenCode config with skills, commands, plugin specs, and generated persona files. The OpenCode-specific final shaping now lives in `harnesses/opencode/scripts/build.ts`.
- `.output/manifest.json`: SHA-256 manifest for the generated files. The next `bun run build` checks it before deleting `.output/` so externally edited generated files are not overwritten silently.

The build writes only final generated outputs into `.output/`.

For local file-based OpenCode plugins that need runtime dependencies from this repo, keep the OpenCode config entry in `harnesses/opencode/opencode.jsonc` and vendor the plugin package itself under `vendor/`. The generated config can then point at `file://{{repo_root}}/vendor/<name>/...` while `bun install` satisfies its imports from the repo workspace install.

### Bootstrap Overrides

Override the default target locations with:

- `OPENCODE_CONFIG_DIR`

The smoke test uses `.tmp/bootstrap-smoke/` inside this repository for that path.
Treat `.tmp/bootstrap-smoke/` as a fake `HOME`, with a fresh repo copy staged at `.tmp/bootstrap-smoke/development/ai-registry`.

Once activated, you can open OpenCode and use the `Tab` key to seamlessly switch between your `designer`, `developer`, and `default` personas on the fly.

### Other Harnesses

Add other generated harness outputs by putting the source of truth under `harnesses/<target>/` and, when needed, a build plugin at `harnesses/<target>/scripts/build.ts`.
