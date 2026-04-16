# @alexgorbatchev/ai

This repository serves as a canonical registry for your AI tooling. It keeps reusable skills, commands, profiles, harness overrides, and bootstrap guidance in one repo, then generates the harness-specific outputs from that source of truth.

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

### 3. Bootstrap (`/bootstrap`)
Bootstrap guidance for applying this repo across machines. `chezmoi` is the recommended outer layer, with `stow` and `home-manager` examples documented as alternatives.

### 4. Generated Outputs (`/.output`)
The final generated harness artifacts. This directory is rebuilt from source and should only contain consumable outputs.

## Building and Usage

This repository includes a custom local compiler (`scripts/build.ts`) that resolves the profiles and builds configurations for various agent harnesses using `rulesync` under the hood.

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

### Bootstrap Guidance

See `bootstrap/` for recommended cross-machine setup patterns:

- `bootstrap/chezmoi/`: recommended bootstrap flow
- `bootstrap/stow/`: simple symlink-based setup
- `bootstrap/home-manager/`: declarative Nix/Home Manager example

To activate it permanently:
```bash
ln -sfn ~/.dotfiles/ai-registry/.output/opencode ~/.dotfiles/tools/opencode/config
```

Once activated, you can open OpenCode and use the `Tab` key to seamlessly switch between your `designer`, `developer`, and `default` personas on the fly.

### Using with Pi, Cursor, and Claude Code

For tools that require isolated configurations, the build script generates the required files (e.g. `.agents/`, `.cursor/`) directly inside the respective profile folder. 

To activate one of these profiles, symlink the target output:
```bash
ln -sfn ~/.dotfiles/ai-registry/profiles/designer/.agents ~/.dotfiles/tools/pi/config/skills
```
