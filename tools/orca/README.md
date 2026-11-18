# Orca

Tool overlay for the [Orca](https://github.com/stablyai/orca) agent IDE.

- `harnesses/`: the agent status hooks Orca's setup adds to Claude Code and Codex, plus its Claude Code agent-view keybinding. The hooks run scripts Orca installs under `~/.orca/agent-hooks/`; machines without them skip this overlay.
- `harnesses/{claude-code,codex,pi}/skills/agent/`: Orca's bundled skills for the harnesses Orca drives, copied unmodified from `skills/` at tag `v1.4.263` (commit `131f209f7703e21c9b4d933920abe766d0d12820`) under the upstream MIT license. Every file matches the SHA-256 digests in the app's `Contents/Resources/skills/current-manifest.json`.

Orca installs these skills into `~/.agents/skills/` and links them into each harness's skills directory, including the registry's generated output. The registry build provides them instead, so keep `~/.agents/skills/` an empty read-only directory (`chmod 555`); Orca's skill installs then fail without writing anything. Refresh all three copies from the matching upstream tag when Orca updates its skills.
