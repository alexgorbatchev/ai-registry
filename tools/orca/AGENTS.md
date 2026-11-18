# Orca tool overlay

- `skills/agent/` holds Orca's bundled skills. They ship to the shared `~/.agents/skills` (Codex, Pi, OpenCode, and the other agents Orca drives through that folder) and to Claude Code, so Orca's setup screens find them for every agent.
- Copy skills unmodified from the `skills/` directory of the upstream `stablyai/orca` tag matching the installed app (`CFBundleShortVersionString` in `/Applications/Orca.app/Contents/Info.plist`). Verify every file against the SHA-256 digests in `/Applications/Orca.app/Contents/Resources/skills/current-manifest.json` before committing, and record the tag and commit in `README.md`.
- Do not add `author` frontmatter or extra files. Orca recognizes a skill only under its upstream name, as a real folder holding just `SKILL.md` with a digest it knows.
- When Orca updates its skills, it writes the new versions through `~/.agents/skills` and `~/.claude/skills` into the generated output; the next build recovers them into `skills/agent/`. Verify the recovered files against the new app's manifest and update `README.md` before committing them.
- `tool.json` owns settings values containing `.orca/agent-hooks` or `orca-agent-view`, so Orca's hook and keybinding edits sync into `harnesses/` here. The hook scripts in `~/.orca/agent-hooks/` belong to Orca's installer; machines without them skip this overlay.
