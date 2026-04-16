# Bootstrap

This directory documents the recommended ways to apply `ai-registry` across machines.

Recommended order of preference:

1. `chezmoi/`
2. `stow/`
3. `home-manager/`

Common flow for all approaches:

1. Clone or sync this repository.
2. Run `bun install`.
3. Run `bun run build` or `bun run bootstrap`.
4. Apply the generated outputs you want:
   - `.output/opencode` for OpenCode
   - `.output/agents` for AGENTS.md-compatible bundles
   - `profiles/*/.agents`, `profiles/*/.cursor`, and similar per-profile outputs for isolated harnesses

`bun run bootstrap` rebuilds the outputs and will apply symlinks when these environment variables are set:

- `OPENCODE_CONFIG_DIR`
- `AGENTS_BUNDLE_DIR`

These files are intentionally documentation-first. They give you a stable place to keep bootstrap conventions in the same repo as the canonical source of truth.
