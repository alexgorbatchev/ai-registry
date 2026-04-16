# Home Manager

Use Home Manager when this repository is part of a broader declarative Nix setup.

Typical pattern:

1. Fetch or pin the repository as a Home Manager input.
2. Build the generated outputs before activation.
3. Expose the generated outputs with `home.file` entries.

Example shape:

```nix
home.file.".config/opencode".source = /path/to/ai-registry/.output/opencode;
```

This is the most reproducible option, but it has more setup cost than `chezmoi` or Stow.
