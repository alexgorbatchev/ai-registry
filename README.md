# @alexgorbatchev/ai-registry

This repository serves as a canonical registry for my AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`/skills`**: Domain-specific AI skills. Each skill lives in its own folder with a `SKILL.md`. This directory is also the repo's install surface for `npx skills`.
- **`/commands`**: Reusable slash commands, system prompts, and task blueprints.
- **`/harnesses`**: Harness-specific config overrides plus repo-local harness maintenance guidance. Only files inside `harnesses/<target>/` are injected into generated outputs for that target.

### 2. The Profiles (`/profiles`)
The assembled agents. These folders contain `profile.yaml` manifests that cherry-pick from the reusable assets using globs to create specific AI personas. You can also define custom tool toggles and granular tool permissions in these files.
- **`designer/`**: UI/UX focused agent.
- **`developer/`**: Backend/Fullstack focused agent.
- **`default/`**: General-purpose baseline agent.

### 3. Setup (`bun run bootstrap`)
`bun run bootstrap` is the repo-local clone-and-run entrypoint for this repository.

### 4. Generated Outputs (`/.output`)
The final generated harness artifacts. This directory is rebuilt from source and should only contain consumable outputs.

## Building and Usage

This repository includes a custom local compiler (`scripts/build.ts`) that resolves the profiles and builds configurations for various agent harnesses using `rulesync` under the hood.

Generated output files may use a small set of build-time template variables. `bun run build` now scans generated text outputs recursively and replaces known variables wherever they appear. Unknown variables fail the build. Example: `&#123;&#123;repo_root&#125;&#125;`. Current variables:

- `{{repo_root}}`
- `{{skills_dir}}`
- `{{commands_dir}}`
- `{{profiles_dir}}`
- `{{output_dir}}`

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
- builds the generated outputs
- verifies the previous generated-output manifest before replacing `.output/`
- stops for confirmation when generated files drift from the last manifest, with `no` as the default
- preserves any extra `RULESYNC_TARGETS` targets while always generating `opencode` and `agentsmd`
- links `.output/opencode` into `${XDG_CONFIG_HOME:-~/.config}/opencode`
- backs up any existing conflicting target directories before replacing them

To compile the configurations, simply run:

```bash
bun install
bun run build
```

*Use `.env` `RULESYNC_TARGETS` to choose generated outputs. `opencode` is written to `.output/opencode`, `agentsmd` is written to `.output/agents`, and other targets are generated inside each profile folder.*

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
- use `bun run scripts/updateVendoredSkills.ts <name>` to refresh only one vendored skill
- run `bun run build` afterward so generated outputs stay current

Avoid plain `npx skills update` in this repo. The upstream project-update flow does not preserve the `openclaw --copy` target and may create extra agent directories such as `.claude/` or `.pi/`.

### Using with OpenCode

The build script generates unified final outputs in `.output/` for the targets that belong there:

- `.output/opencode`: OpenCode config with skills, commands, plugin specs, and generated persona files.
- `.output/agents`: `AGENTS.md` plus the generated `.agents/` directory for AGENTS.md-compatible tooling.
- `.output/manifest.json`: SHA-256 manifest for the generated files. The next `bun run build` checks it before deleting `.output/` so externally edited generated files are not overwritten silently.

Intermediate rulesync inputs are cleaned up after the build, so `.output` only contains final generated outputs.

### Bootstrap Overrides

Override the default target locations with:

- `OPENCODE_CONFIG_DIR`

The smoke test uses `.tmp/bootstrap-smoke/` inside this repository for that path.
Treat `.tmp/bootstrap-smoke/` as a fake `HOME`, with a fresh repo copy staged at `.tmp/bootstrap-smoke/development/ai-registry`.

Once activated, you can open OpenCode and use the `Tab` key to seamlessly switch between your `designer`, `developer`, and `default` personas on the fly.

### Using with Pi, Cursor, and Claude Code

For tools that require isolated configurations, the build script generates the required files (e.g. `.agents/`, `.cursor/`) directly inside the respective profile folder. 

To activate one of these profiles, symlink the target output:
```bash
ln -sfn ~/.dotfiles/ai-registry/profiles/designer/.agents ~/.dotfiles/tools/pi/config/skills
```
