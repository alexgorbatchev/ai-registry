---
created_on: 2026-10-26 11:31
last_modified: 2026-10-26 11:47
status: current
---

# Handoff: migrate the Mac's harness homes to real directories

For the agent working on the Mac checkout of ai-registry. The Linux machine has finished this migration; this file contains everything the Mac needs.

## Why

`origin/main` (from `692eb15` onward) requires every harness home to be a real directory outside the repository. Read **Harness Homes** in the root `AGENTS.md`. On the Mac, `~/.claude`, `~/.codex`, `~/.pi/agent`, and `~/.config/opencode` are still symlinks into `<checkout>/.output/...`, so their sessions, histories, and databases live inside `.output/`.

Until this migration runs:

- `bun run bootstrap` stops with `<home> is a symlink to <target>. Harness homes are real directories ...`, on purpose, and changes nothing in that home.
- The scheduled update pulls and builds, then fails at bootstrap and skips its push. Settings commits pile up locally.
- After the first build with the new code, `.output/claude-code/default/{plugins,projects,sessions,shell-snapshots,todos}` are no longer links into the old Claude Code store at `${XDG_DATA_HOME:-~/.local/share}/ai-registry/claude-code/`. **The data is still in the store**, but Claude Code on the Mac stops seeing project memory and resumable sessions until step 5 moves the store into `~/.claude`.

Nothing is deleted by pulling. The build only prunes paths the previous manifest recorded, and runtime directories never were.

## What the migration does

`migrate_harness_homes.py` (below) handles one checkout whose homes all point into its `.output/`:

1. For each home, it builds `<home>.migrating`. Managed entries (from `.output/manifest.json`, including `syncedFilePaths`) become links into the generated profile. Every other real entry of the generated directory is **moved** into it. That is a same-filesystem rename, so it is instant and inode-preserving. Then it swaps the symlink for the directory.
2. It moves the old Claude Code store directories into `~/.claude`. If Claude Code already recreated one of them (for example `projects/`) after the store links disappeared, it `rsync --ignore-existing`s the store into it and keeps the store copy for you to delete after verifying.
3. It rewrites `<checkout>/.output/codex/default/` to `~/.codex/` in every TEXT column of `~/.codex/*.sqlite` (rollout paths, worktree cwds).
4. It runs `git worktree repair` for every Codex worktree under `~/.codex/worktrees/*/*`.
5. It reports real files left in generated **non-default** profile directories (`.output/<harness>/<profile>`). The old `claude-<profile>`/`codex-<profile>`/`pi-<profile>` launchers pointed there, so these may hold profile-only runtime state. The script does not move them; decide per file.

It aborts if `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `PI_CODING_AGENT_DIR`, or `OPENCODE_CONFIG_DIR` are set, if a home points at a different checkout, if a `.migrating` directory is left from an earlier run, if the manifest is not version 2, or if the homes and checkout are on different filesystems. Without `--apply` it only prints the plan. A second `--apply` run is a no-op.

It was exercised against a fake home on Linux. Covered: symlinked homes, a store link, a store directory colliding with a recreated `projects/`, a Codex DB with old paths, and a real Codex worktree. It has not run on macOS.

## Steps

1. **Stop writers.**
   - Quit every Claude Code, Codex (CLI, IDE, and the ChatGPT desktop app, which runs a Codex app-server), Pi, and OpenCode session on the Mac. Include remote-control sessions and anything started over SSH.
   - Confirm nothing has the checkout's `.output/` open: `lsof +D <checkout>/.output | head`.
   - Disable the scheduled update. Find it with `launchctl list | grep -i registry` and `crontab -l`, then unload or comment it out.
2. **Check the repository state.**
   - If `<checkout>/.tmp/scheduled-update-recovery.json` exists, finish that recovery first, following **Scheduled Updates** in `AGENTS.md`.
   - Read the tail of `.tmp/scheduled-update.log`.
   - `git status`; `git log --oneline @{u}..` and `..@{u}`.
3. **Integrate `origin/main` without running hooks.** The hooks would only run the failing bootstrap.
   - `git -c core.hooksPath=/dev/null pull --rebase`
   - Settings commits (`chore(settings): sync harness settings`) conflict when both machines changed the same key. Linux resolved its conflicts in upstream's favour.
   - Then run `bun install` and `bun run build`. The build must succeed and `.output/manifest.json` must have `"version": 2`.
4. **Back up.** APFS clones are instant. Use a dated directory outside the checkout:
   ```sh
   B=~/backups/harness-state-$(date +%Y-%m-%d); mkdir -p "$B"
   for h in claude-code codex pi opencode; do cp -cR "<checkout>/.output/$h" "$B/output-$h"; done
   cp -cR "${XDG_DATA_HOME:-$HOME/.local/share}/ai-registry" "$B/xdg-ai-registry" 2>/dev/null
   for h in .claude .codex .pi/agent .config/opencode; do ls -l ~/$h; done > "$B/home-links.txt"
   ```
   Do not use plain `cp -R` without `-c` on a large `.output/`. It works, but it is slow and doubles disk use.
5. **Migrate.** Save the script below outside the checkout, then:
   ```sh
   python3 migrate_harness_homes.py --checkout <checkout>            # read the plan
   python3 migrate_harness_homes.py --checkout <checkout> --apply
   ```
   Review the plan before applying:
   - every home shows `home is a symlink -> <checkout>/.output/...`
   - managed names look like generated files (`CLAUDE.md`, `skills`, `commands`, `settings.json`, `AGENTS.md`, `config.toml`, ...)
   - `move runtime` covers sessions, histories, DBs, `computer-use`, `.tmp`, `worktrees`, and so on
6. **Fix the Codex values that are now live-only.**
   - `notify`, `marketplaces.openai-bundled`, `marketplaces.openai-primary-runtime`, `mcp_servers.node_repl`, and `mcp_servers.cua_repl` are no longer in the registry source; each machine keeps its own (`692eb15`).
   - In the live file `<checkout>/.output/codex/default/config.toml` (`~/.codex/config.toml` links to it), replace `<checkout>/.output/codex/default/` with `~/.codex/` spelled out as an absolute path, in `notify` (`.../computer-use/Codex Computer Use.app/...`) and `marketplaces.openai-bundled.source` (`.../.tmp/bundled-marketplaces/openai-bundled`).
   - Check that both paths exist after the move.
   - Codex may ask to re-trust the hooks, because `hooks.state` is keyed by the old hook path.
7. **Bootstrap:** `bun run bootstrap -- -y`. Expect `applied ...` for every home and profile home with no errors. A `backed up ... to: ...` line means a real entry sat where a managed link belongs; compare the backup with the generated file before deleting it.
8. **Verify.**
   - `for h in .claude .codex .pi/agent .config/opencode; do [ -L ~/$h ] && echo "$h STILL A SYMLINK"; done` prints nothing.
   - `ls ~/.claude/projects | wc -l` matches the backup's count (`$B/xdg-ai-registry/claude-code/projects` plus anything Claude recreated). Start Claude Code in a known project and check that `/resume` lists old sessions.
   - `sqlite3 ~/.codex/state_5.sqlite "select count(*) from threads where rollout_path like '%/.output/%'"` returns `0`, and `codex resume` lists old threads.
   - `git -C <a main repo> worktree list` shows Codex worktrees under `~/.codex/worktrees/` without `prunable`.
   - Pi: `ls ~/.pi/agent/sessions | wc -l` matches the backup.
   - `ls <checkout>/.output/<harness>/default` holds only generated entries, plus a dangling `sessions`-style link or two, which is harmless.
9. **Re-enable the scheduled update**, run `bun run scheduled:update` once by hand, and check `.tmp/scheduled-update.log`. It should bootstrap successfully and push any queued settings commits.
10. **Clean up later**, once the Mac has run normally for a while: the store copies the script kept, the backup directory, and the leftovers step 5 reported.

## Known differences from the Linux migration

- Linux also merged a second, older checkout's state into the homes. The Mac has one checkout; if `readlink` on the homes shows two different checkouts, stop and merge by hand.
- Profile homes for non-default profiles now live in `${XDG_DATA_HOME:-~/.local/share}/ai-registry/<harness>/profiles/<profile>`. They share the default home's runtime entries, Codex's SQLite databases included. Bootstrap reports a profile-home entry that hides a shared one as `own copies hiding the shared home's entries`.

## Script

```python
#!/usr/bin/env python3
"""One-time migration for a single ai-registry checkout whose harness homes are
still symlinks into <checkout>/.output/.

Turns ~/.claude, ~/.codex, ~/.pi/agent, and ~/.config/opencode into real
directories: managed entries become links into the generated profile, and every
runtime entry is moved (rename, same filesystem) into the home. The old Claude
Code persistent store under ${XDG_DATA_HOME:-~/.local/share}/ai-registry/claude-code
is moved into ~/.claude. Codex SQLite paths and worktree back-pointers that still
name <checkout>/.output/codex/default/ are rewritten to ~/.codex/.

Usage: migrate_harness_homes.py --checkout <path> [--apply]
Without --apply it only prints what it would do.
"""
import argparse
import json
import os
import sqlite3
import subprocess
from pathlib import Path

CLAUDE_STORE_NAMES = ["plugins", "projects", "sessions", "shell-snapshots", "todos"]

parser = argparse.ArgumentParser()
parser.add_argument("--checkout", required=True, type=Path)
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()

APPLY = args.apply
HOME = Path.home()
CHECKOUT = args.checkout.resolve()
OUT = CHECKOUT / ".output"
DATA_HOME = Path(os.environ.get("XDG_DATA_HOME") or HOME / ".local/share")
CLAUDE_STORE = DATA_HOME / "ai-registry/claude-code"

# (generated dir relative to .output, home, synced settings file name)
HARNESSES = {
    "claude-code": ("claude-code/default", HOME / ".claude", "settings.json"),
    "codex": ("codex/default", HOME / ".codex", "config.toml"),
    "pi": ("pi/default", HOME / ".pi/agent", "settings.json"),
    "opencode": ("opencode", HOME / ".config/opencode", "opencode.jsonc"),
}


def log(message):
    print(message, flush=True)


def run(command):
    log(f"  $ {' '.join(map(str, command))}")
    if APPLY:
        subprocess.run(command, check=True)


def preflight():
    for variable in ["CLAUDE_CONFIG_DIR", "CODEX_HOME", "PI_CODING_AGENT_DIR", "OPENCODE_CONFIG_DIR"]:
        if os.environ.get(variable):
            raise SystemExit(f"ABORT: {variable} is set; this script only handles the default homes")
    if not (OUT / "manifest.json").is_file():
        raise SystemExit(f"ABORT: {OUT / 'manifest.json'} is missing; run `bun run build` first")
    if json.loads((OUT / "manifest.json").read_text()).get("version") != 2:
        raise SystemExit("ABORT: manifest is not version 2; pull and rebuild first")
    devices = {OUT.stat().st_dev}
    for _, home, _ in HARNESSES.values():
        devices.add(home.parent.stat().st_dev)
    if CLAUDE_STORE.exists():
        devices.add(CLAUDE_STORE.stat().st_dev)
    if len(devices) != 1:
        raise SystemExit("ABORT: homes, store, and checkout are on different filesystems; renames would copy")


def managed_names(relative_dir):
    manifest = json.loads((OUT / "manifest.json").read_text())
    prefix = f"{relative_dir}/"
    paths = list(manifest["entries"]) + list(manifest.get("syncedFilePaths", []))
    return {path[len(prefix):].split("/")[0] for path in paths if path.startswith(prefix)}


def flip_home(harness):
    relative_dir, home, synced = HARNESSES[harness]
    generated = OUT / relative_dir
    managed = managed_names(relative_dir) | {synced}
    log(f"\n=== {harness}: {home}")
    log(f"  managed: {sorted(managed)}")
    if home.is_symlink():
        target = Path(os.readlink(home))
        if not target.is_absolute():
            target = (home.parent / target).resolve()
        log(f"  home is a symlink -> {target}")
        if target != generated:
            raise SystemExit(f"  ABORT: {home} points at {target}, expected {generated}")
    elif home.is_dir():
        log("  home is already a real directory; nothing to flip")
        return
    elif not home.exists():
        log("  home does not exist; bootstrap will create it")
        return
    staging = home.with_name(home.name + ".migrating")
    if staging.exists():
        raise SystemExit(f"  ABORT: {staging} exists from an earlier run; inspect and remove it first")
    log(f"  mkdir {staging}")
    if APPLY:
        staging.mkdir(mode=0o700)
    for entry in sorted(generated.iterdir(), key=lambda path: path.name):
        if entry.name in managed:
            log(f"  link {entry.name}")
            if APPLY:
                (staging / entry.name).symlink_to(entry)
        elif entry.is_symlink():
            # Old-layout links (such as Claude store links); the store is handled below.
            log(f"  skip old link {entry.name} -> {os.readlink(entry)}")
        else:
            log(f"  move runtime {entry.name}")
            if APPLY:
                os.rename(entry, staging / entry.name)
    if harness == "claude-code":
        move_claude_store(staging)
    log(f"  replace symlink {home} with the real directory")
    if APPLY:
        home.unlink()
        os.rename(staging, home)


def move_claude_store(staging):
    for name in CLAUDE_STORE_NAMES:
        store = CLAUDE_STORE / name
        if not store.is_dir() or store.is_symlink():
            continue
        destination = staging / name
        # In a dry run nothing was moved into staging, so look at what would have been.
        generated_entry = OUT / "claude-code/default" / name
        will_exist = destination.exists() if APPLY else generated_entry.is_dir() and not generated_entry.is_symlink()
        if not will_exist:
            log(f"  move store {store} -> {name}")
            if APPLY:
                os.rename(store, destination)
        else:
            # Claude recreated the directory after the store links went away; keep
            # what it wrote and add the store's entries it does not have.
            log(f"  merge store {store} into {name} (store copy kept; delete it after verifying)")
            run(["rsync", "-a", "--ignore-existing", f"{store}/", f"{destination}/"])


def rewrite_codex_paths():
    home = HOME / ".codex"
    old_prefix = f"{OUT}/codex/default/"
    new_prefix = f"{home}/"
    log(f"\n--- codex: rewrite {old_prefix} -> {new_prefix} in SQLite text columns")
    for database in sorted(home.glob("*.sqlite")):
        connection = sqlite3.connect(database)
        try:
            tables = connection.execute(
                "select name from sqlite_master where type='table' and name not like 'sqlite_%'"
            ).fetchall()
            for (table,) in tables:
                for column in connection.execute(f'pragma table_info("{table}")').fetchall():
                    if column[2].upper() != "TEXT":
                        continue
                    count = connection.execute(
                        f'select count(*) from "{table}" where instr("{column[1]}", ?) > 0', (old_prefix,)
                    ).fetchone()[0]
                    if count == 0:
                        continue
                    log(f"  {database.name}: {count} {table}.{column[1]}")
                    if APPLY:
                        connection.execute(
                            f'update "{table}" set "{column[1]}" = replace("{column[1]}", ?, ?) where instr("{column[1]}", ?) > 0',
                            (old_prefix, new_prefix, old_prefix),
                        )
            connection.commit()
        finally:
            connection.close()


def repair_codex_worktrees():
    log("\n--- codex: repair worktree back-pointers")
    for git_file in sorted((HOME / ".codex/worktrees").glob("*/*/.git")):
        if git_file.is_file():
            run(["git", "-C", str(git_file.parent), "worktree", "repair", str(git_file.parent)])


def report_profile_leftovers():
    log("\n--- leftovers in generated non-default profiles (real entries the build does not manage)")
    for harness, (relative_dir, _, _) in HARNESSES.items():
        if harness == "opencode":
            continue
        for profile_dir in sorted((OUT / relative_dir).parent.iterdir()):
            if profile_dir.name == "default" or not profile_dir.is_dir():
                continue
            managed = managed_names(f"{relative_dir.split('/')[0]}/{profile_dir.name}")
            for entry in sorted(profile_dir.iterdir(), key=lambda path: path.name):
                if entry.name not in managed and not entry.is_symlink():
                    log(f"  {entry}")


def main():
    log(f"mode: {'APPLY' if APPLY else 'DRY RUN'}  checkout: {CHECKOUT}")
    preflight()
    for harness in HARNESSES:
        flip_home(harness)
    if APPLY or (HOME / ".codex").is_dir() and not (HOME / ".codex").is_symlink():
        rewrite_codex_paths()
        repair_codex_worktrees()
    else:
        log("\n--- codex: SQLite path rewrite and worktree repair run after the flip (skipped in dry run)")
    report_profile_leftovers()


if __name__ == "__main__":
    main()
```
