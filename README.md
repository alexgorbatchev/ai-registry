# @alexgorbatchev/ai

This repository serves as a unified registry for your AI tooling. It contains both a global library of knowledge (the Catalog) and specific, composable agent personas (the Profiles).

It is designed to be consumed by [rulesync](https://github.com/alexgorbatchev/rulesync) to dynamically construct highly-specialized AI agent environments without overloading context windows.

## Structure

### 1. The Catalog (`/catalog`)
The raw materials. These are self-contained modules of knowledge and functionality.
- **`/catalog/skills`**: Domain-specific AI skills (e.g., `frontend-design`, `golang`). Each skill must have a `SKILL.md`.
- **`/catalog/commands`**: Reusable AI slash commands, system prompts, and task blueprints.

### 2. The Profiles (`/profiles`)
The assembled agents. These folders contain `profile.yaml` manifests that cherry-pick from the Catalog using globs to create specific AI personas. You can also define custom tool toggles and granular tool permissions in these files.
- **`designer/`**: UI/UX focused agent.
- **`developer/`**: Backend/Fullstack focused agent.
- **`default/`**: General-purpose baseline agent.

## Building and Usage

This repository includes a custom local compiler (`scripts/build.ts`) that resolves the profiles and builds configurations for various agent harnesses using `rulesync` under the hood.

To compile the configurations, simply run:

```bash
bun install
bun run build
```

*(You can limit the output targets by creating a `.env` file with `RULESYNC_TARGETS="opencode,cursor"`).*

### Using with OpenCode

The build script generates a single unified OpenCode configuration at `.output/opencode`. This folder contains all skills and dynamically generated Markdown agent files enforcing strict profile permissions.

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
