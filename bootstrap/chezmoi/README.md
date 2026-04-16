# Chezmoi

`chezmoi` is the recommended outer bootstrap layer for this repository.

Suggested flow:

1. Let `chezmoi` clone or update this repository into a stable local path.
2. Run `bun install` and `bun run bootstrap` from a `run_onchange_` or `run_after_` script.
3. Symlink or copy the generated outputs into the final harness-specific locations.

Example shell snippet:

```bash
repo_dir="$HOME/.local/share/ai-registry"

bun install --cwd "$repo_dir"
OPENCODE_CONFIG_DIR="$XDG_CONFIG_HOME/opencode" \
AGENTS_BUNDLE_DIR="$HOME/.local/share/agents-bundle" \
  bun run --cwd "$repo_dir" bootstrap
```

Use this approach when you need machine-specific templates, secret injection, or one-command new-machine setup.
