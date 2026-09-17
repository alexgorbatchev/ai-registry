# claude-agents-md

Vendored copy of the `agents-md-vfs.js` Bun preload from [alexgorbatchev/claude-agents-md](https://github.com/alexgorbatchev/claude-agents-md), a fork of [hexsprite/claude-agents-md](https://github.com/hexsprite/claude-agents-md). It makes Claude Code read `AGENTS.md` files without adding a `CLAUDE.md` to every project.

The fork carries one change on top of upstream: debug mode logs every content read with the branch it took (`read kind=<passthrough|path-swap|dedup|union-merge> api=<...> path=<...> twin=<...>`) and records rejected gate decisions (`gate off: ...`), where upstream logged only union-merge reads. Upstream's gate logic is unchanged.

## What It Does

Claude Code natively reads `CLAUDE.md` only. When Bun loads this script into the `claude` process through `BUN_OPTIONS="--require <path>"`, it patches the `node:fs` read and stat functions so that, for any path whose basename is `CLAUDE.md`:

- **Passthrough:** no sibling `AGENTS.md` exists, so real `fs` behavior applies.
- **Path swap:** only `AGENTS.md` exists, so Claude is told `CLAUDE.md` exists and receives the `AGENTS.md` bytes.
- **Dedup:** `CLAUDE.md` is a symlink to `AGENTS.md`, so the file is served once.
- **Union merge:** both exist as distinct files, so Claude receives `AGENTS.md` + blank line + `CLAUDE.md`, letting `CLAUDE.md` act as a Claude-only overlay.

The script self-gates: it patches `fs` only when `process.argv[1]` starts with `/$bunfs/` (a compiled Bun executable) and `process.execPath` matches `/claude/i`. Any other Bun process that inherits `BUN_OPTIONS` passes through untouched. Nothing is written to disk.

## How This Repository Uses It

- The Claude Code harness build symlinks `agents-md-vfs.js` into the generated `default` profile root, so after `bun run bootstrap` it resolves at `${CLAUDE_CONFIG_DIR:-~/.claude}/agents-md-vfs.js`. Non-default generated profile roots inherit that entry from `default/`.
- Generated `claude-<profile>` launchers under `.output/bin/` export `BUN_OPTIONS` with `--require <profile root>/agents-md-vfs.js` before launching the real `claude` binary.
- The bare `claude` command is covered by a shell function that performs the same `BUN_OPTIONS` merge against `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/agents-md-vfs.js`. That function is owned by the shell configuration that defines `claude`, not by this repository, because the registry does not shadow the real `claude` binary.

## Debugging

Set `AGENTS_MD_VFS_DEBUG=1` before starting `claude` to log to `/tmp/agents-md-vfs-<pid>.log`, with `/tmp/agents-md-vfs-latest.log` symlinked to the newest session's log. `AGENTS_MD_VFS_LOG_PATH` overrides the log location. The log answers three questions:

- `vfs loaded ...` versus `gate off: ... execPath=... argv1=...` tells you whether the preload accepted the process; a `gate off` line after a Claude Code upgrade means the `/$bunfs/` or `claude` gate inputs changed.
- `read kind=path-swap ...` lines prove a lone `AGENTS.md` was served for a `CLAUDE.md` read; `kind=union-merge` shows both files were combined.
- `canary: zero CLAUDE.md reads observed` at exit means Claude Code moved its memory-file reads off `node:fs` and the preload no longer intercepts them.

## Upstream Pin

| Field | Value |
| :--- | :--- |
| Repository | `https://github.com/alexgorbatchev/claude-agents-md` (fork) |
| Upstream | `https://github.com/hexsprite/claude-agents-md` at `452330830a0e9fb1e8d1338e623520f3ef318ee7` |
| Commit | `ad570c296c1775dc95dcc08b123922d72178ec56` |
| File | `agents-md-vfs.js` |
| SHA-256 | `3006e5971d568257c95e9f1117cdd72f52cb6bb0daff512b5de8a671ccc9cbe2` |
| License | MIT, see [`LICENSE`](LICENSE) |

Only `agents-md-vfs.js` and `LICENSE` are vendored. The fork's `install.sh`, `uninstall.sh`, hook-based v1 plugin, and test suite are not, because the harness build and the shell configuration replace the installer and several tests spawn billable Claude sessions. `tests/vfs.test.ts` in the fork exercises the preload through a compiled fixture without Claude and is the suite to run when changing the file.

## Refreshing The Vendored Copy

1. Make the change in the fork (`git clone git@github.com:alexgorbatchev/claude-agents-md.git`, `upstream` remote at `hexsprite/claude-agents-md`), run `bun test tests/vfs.test.ts`, commit, and push. To pick up upstream changes, merge `upstream/main` into the fork first.
2. Download the file at the exact fork commit:

   ```bash
   curl -fsSL "https://raw.githubusercontent.com/alexgorbatchev/claude-agents-md/<commit>/agents-md-vfs.js" \
     -o vendor/claude-agents-md/agents-md-vfs.js
   curl -fsSL "https://raw.githubusercontent.com/alexgorbatchev/claude-agents-md/<commit>/LICENSE" \
     -o vendor/claude-agents-md/LICENSE
   ```

3. Record the new commit, the upstream commit it is based on, and `shasum -a 256 vendor/claude-agents-md/agents-md-vfs.js` in the Upstream Pin table.
4. Confirm the gate still matches the installed binary: `AGENTS_MD_VFS_DEBUG=1 AGENTS_MD_VFS_LOG_PATH=.tmp/vfs.log BUN_OPTIONS="--require $PWD/vendor/claude-agents-md/agents-md-vfs.js" claude --version` must log `vfs loaded`, not `gate off`.
5. Run `bun run build`, then start a session in a directory that contains only an `AGENTS.md` and confirm the log shows `read kind=path-swap` and Claude reports those instructions.
