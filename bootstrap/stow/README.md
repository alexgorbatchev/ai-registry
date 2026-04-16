# Stow

Use GNU Stow when you want a simple symlink-based setup with minimal machinery.

Suggested flow:

1. Clone this repository.
2. Run `bun install` and `bun run build`.
3. Symlink the generated outputs into the target harness locations.

Example commands:

```bash
bun install
bun run build

ln -sfn "$(pwd)/.output/opencode" "$XDG_CONFIG_HOME/opencode"
```

This is the lowest-friction option, but it does not handle secrets or machine-specific variation as cleanly as `chezmoi`.
