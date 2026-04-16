# @alexgorbatchev/ai

This repository serves as a canonical registry for your AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and setup workflow in one repo, then generates the harness-specific outputs from that source of truth.

It is designed to be consumed by [rulesync](https://github.com/alexgorbatchev/rulesync) to dynamically construct highly-specialized AI agent environments without overloading context windows.

## Structure

### 1. Reusable Assets
The reusable source-of-truth layer.
- **`/skills`**: Domain-specific AI skills. Each skill lives in its own folder with a `SKILL.md`. This directory is also the repo's install surface for `npx skills`.
- **`/commands`**: Reusable slash commands, system prompts, and task blueprints.
- **`/harnesses`**: Harness-specific config overrides that are injected into generated outputs.

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

### Using with OpenCode

The build script generates unified final outputs in `.output/` for the targets that belong there:

- `.output/opencode`: OpenCode config with skills, commands, and generated persona files.
- `.output/agents`: `AGENTS.md` plus the generated `.agents/` directory for AGENTS.md-compatible tooling.

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
