---
name: disk-cleanup
description: Use when inspecting development, home-directory, or Docker disk usage, freeing disk space, cleaning caches or Trash, removing installable dependencies, or reviewing Git worktrees and temporary artifacts.
author: alexgorbatchev
metadata:
  created_on: '2026-10-05 07:10'
  last_modified: 2026-10-29 15:47
  status: current
---

Use [scripts/cleanup.ts](scripts/cleanup.ts) to inspect disk usage and perform authorized cleanup.
Require Bun, Git, and GNU `du`, `df`, and `rm`. Install this skill's locked dependencies with
`bun install --frozen-lockfile` from the skill directory before invoking its scripts.
Use `<%- file_dir %>/scripts/cleanup.ts`; do not assume the working directory is the skill directory.
Rust commands also require an installed Cargo toolchain and Unix `lsof`.
Native cleanup also requires Unix `lsof`. The tool resolves and verifies GNU utilities itself, preferring
`gdu`, `gdf`, and `grm` on macOS; no `gnubin` PATH override is needed. Missing GNU tools fail with an install hint.

## Inspect before selecting deletions

1. Identify the user's target root, default to $HOME. Pass it explicitly as `--root`; the default is the working directory.
2. Run `disk assess --root <target> --system` for a general machine disk-space request on macOS or Linux.
   Omit `--system` when the user selected only a project or directory. Await its final JSON and process exit;
   resume every yielded tool call until it finishes. This command collects filesystem capacity, a three-level
   overview, files and directories of at least 1G at every depth, dependencies, worktrees, stale folders, and Docker.
   Report the largest paths across the entire selected root, including development projects and hidden directories.
   Do not end the assessment or ask about deletion based on an early cache result while any inspection is pending.
   When `isComplete` is false, report successful results together with each failed section and its errors;
   never present incomplete coverage as a full assessment. Report nested directory totals without adding them together.
3. Use `dependencies list` for inactivity decisions and `worktrees list` for workspace registration and file status.
   For Rust builds, use `rust list` and the [Rust cleanup workflow](references/rust-cleanup.md).
4. Match proposed targets to the user's authorized paths or cleanup rule. An inspection request authorizes no deletion.
5. Run the corresponding removal command without `--execute` to review its current targets. Add `--execute` only
   within existing user authorization; ask for missing authorization after presenting the concrete preview.
6. Use the execution log and subsequent disk measurement to report verified removals and available space.

Do not infer disposal from a `.tmp`, `.cache`, `.output`, or `.workspaces` name. Backups, model weights,
agent sessions, credentials, database files, and unregistered workspace directories need content review.
Do not delete an entire agent runtime output directory as though it were regenerated configuration.
Report unregistered workspace directories explicitly; do not label them registered Git worktrees.
When a worktree scan returns errors, report its successful entries and the errors together. Treat null registration,
allocation, or status fields as unknown; do not substitute safe classifications or byte estimates.

## Commands

From the target root, use the following commands:

```sh
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" disk inspect --root . --depth 2
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" disk assess --root .
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" disk assess --root "$HOME" --system
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" folders list --root . --size 1G --days 30
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" dependencies list --root . --days 30
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" dependencies remove --root . --days 30
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" rust list --root . --idle 30m
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" rust remove project --root . --idle 30m --artifacts tmp,target
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" paths remove project/.tmp/build-cache --root .
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" native review Library/Caches/example --root "$HOME"
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" native remove .tmp/native-cleanup-EXAMPLE/manifest.json --root "$HOME"
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" worktrees list --root .
AGENT=1 bun "<%- file_dir %>/scripts/cleanup.ts" worktrees remove project/.workspaces/review --root .
```

Append `--execute` to an authorized removal command to mutate the filesystem. Without it, every removal previews.
Read [scripts/inventory.ts](scripts/inventory.ts) when changing activity classification,
[scripts/removeTargets.ts](scripts/removeTargets.ts) when changing deletion behavior, and
[scripts/inspectWorktrees.ts](scripts/inspectWorktrees.ts) when changing worktree checks.

| Command | Arguments and options | Behavior |
|---|---|---|
| `disk assess` | `--root <directory>` default `.`, `--size <size>` default `1G`, `--days <count>` default `30`, `--system` default false | Await all inspection sections and emit one combined report. Include platform cache, temp, library, and log scopes when selected. `--size` sets large-path and stale-folder thresholds; `--days` controls inactivity. No deletion or log files. |
| `disk inspect` | `--root <directory>` default `.`, `--depth <levels>` default `2` | Return capacity, sorted directory allocations, `errors`, and `isComplete`. Preserve successful output when either command fails; incomplete inspection exits `1`. |
| `folders list` | `--root <directory>` default `.`, `--size <size>` default `1G`, `--days <count>` default `30`, `--time <mode>` default `either`, `--depth <levels>`, `--no-prune` | Return directories exceeding size and staleness thresholds with access/modification timestamps, pruning nested matching children by default. |
| `dependencies list` | `--root <directory>` default `.`, `--days <count>` default `30` | Return discovered outermost `node_modules` folders with owner, allocation, activity, eligibility, reason, and top-level `errors`. Preserve readable siblings on errors; incomplete inspection exits `1`. Unknown allocation is null. |
| `dependencies remove` | Same options plus `--execute` default false | Preview or delete all eligible folders under the selected root. |
| `rust list` | `--root <directory>` default `.`, `--idle <duration>` default `30m` | Inspect direct child Cargo projects; return activity, process IDs, warnings, eligibility, and separate `.tmp`, coverage, and target allocations. Coverage is included in the target total. Inspection errors return exit code `1`. |
| `rust remove <projects...>` | Exact direct child projects; `--root` and `--idle` as above; required `--artifacts <kinds>`; `--execute` default false | Preview or remove explicitly selected `tmp`, `coverage`, and/or `target` artifacts in idle projects. Preserve active projects and protected contents. Recheck before every removal. |
| `paths remove <paths...>` | One or more exact paths; `--root <directory>` default `.`, `--execute` default false | Preview or delete reviewed artifacts beneath `.tmp`, `.cache`, `node_modules`, `target`, or `dist`. |
| `native review <paths...>` | Exact reviewed cache/temp directories; `--root <directory>` default `.`, `--verbose` default false | Save an exact manifest beneath root's `.tmp/native-cleanup-*`. Return its path and counts; `--verbose` includes the full manifest. Writes the review record only; never deletes targets. |
| `native remove <manifest>` | Manifest path relative to root or absolute inside it; `--root <directory>` default `.`, `--execute` default false, `--verbose` default false | Validate the saved selection; preview by default. Execute only its unchanged, inactive targets and retain a receipt. Return counts, failure, log path, and free-space change; `--verbose` includes full target/command records. |
| `worktrees list` | `--root <directory>` default `.` | Return linked worktrees and `.workspaces` entries, allocations, branches/HEADs, locks, registration, status counts, and inspection errors. Partial scans return exit code `1`. |
| `worktrees remove <paths...>` | One or more exact paths; `--root <directory>` default `.`, `--execute` default false | Preview or remove validated registered linked worktrees through Git. |
| `skill` | No positional arguments or command-specific flags | Print this entire file verbatim, including frontmatter. |
| `help [command]` | One immediate subcommand name, or `-h`/`--help` on any command | Show commands and options. Use a group's `help` to select its child. No completion or version command is provided. |

Require positive integers for `--days` and `--depth`. Interpret relative removal paths relative to `--root`.
For `--idle`, require a positive whole number suffixed with `m`, `h`, or `d` (minutes, hours, days).
For `--artifacts`, use comma-separated `tmp`, `coverage`, and/or `target`, without duplicates or spaces.
Accept absolute paths only strictly inside that root. Reject filesystem-root cleanup, duplicate or overlapping targets,
symbolic-link targets or ancestors, filesystem boundaries, and Git metadata. Do not pass wildcard paths or shell-expanded deletion lists.

## Stale folder discovery

Use `folders list` to find directories anywhere under the target root that exceed `--size` (default `1G`, accepts
numbers with optional units like `500M`, `1.5`, `2GB`) and have not been touched for `--days` (default `30`).
Evaluate staleness with `--time <mode>`:
- `either` (default): stale only when neither accessed nor modified within `--days` (safest for cached runtimes/binaries).
- `modified`: stale when file contents have not been modified within `--days`.
- `accessed`: stale when files have not been read or executed within `--days`.

`folders list` prunes nested matching children by default so an entire stale directory tree is reported as a single
top-level entry. Pass `--no-prune` to review matching nested subdirectories individually. Limit recursion depth
with `--depth <levels>`. When candidates are discovered, review their contents before remediation: authorized caches
under `.cache` or `.tmp` use `paths remove`, registered worktrees use `worktrees remove`, and tool runtimes use their
respective package manager or CLI uninstaller.

Folder scans stay on the root filesystem and report unreadable paths in `errors` alongside successful matches;
any recorded error returns exit code `1`.

### Combined assessment output

`disk assess` emits `{root, isComplete, sections, scope}` only after every section finishes. Each section has `name`,
`isComplete`, `data`, and `errors`. Names are `filesystem`, `overview`, `largePaths`, `dependencies`, `worktrees`,
`staleFolders`, and `docker`. Overview and large-path data are arrays of `{bytes, path}` sorted largest first.
The overview includes directories through depth three regardless of size; large paths include files and directories
at every depth meeting `--size`. These are overlapping allocations, not independent reclaimable totals.
Filesystem data is raw `df` output. Dependency, worktree, and stale-folder data retain their list-command JSON.
Docker data contains individual command reports for context, endpoint, data root, usage, verbose details, containers,
container IDs, and mounts when containers exist. All daemon queries use the initially selected context; inspect its
endpoint before attributing usage to this machine. A missing Docker executable or unavailable daemon is an error,
not zero usage. A failed context lookup prevents dependent Docker queries.
Nonzero commands retain available stdout and stderr; failed sections never hide successful sibling sections.
`isComplete` describes scan completion only, never deletion safety. Exit code is `1` if any section is incomplete.
`scope` lists inspected roots, exclusions, and the Docker context boundary. With `--system`, macOS adds the current
user's OS temp directory, its sibling `X` staging directory, `~/Library/Caches`, `/Library`, and `/private/var/log`.
Linux adds the OS temp directory, `/var/tmp`, `/var/cache`, `/var/log`, and `~/.cache`. Resolve existing root aliases
to physical paths and deduplicate identical extra roots. A missing or restricted path remains an explicit error.
Extra roots have `system:<path>` sections with large files and folders at every depth; they are inspection scope,
never deletion targets. Overlapping roots and directory totals must not be summed. Other users' paths outside
these roots, nested filesystems, and symlink traversal are excluded. Unsupported platforms reject `--system`;
use explicit roots instead. Use targeted commands for content review and Rust process/activity decisions.

## Dependency decisions

Define recorded Git activity as the newest committer timestamp across all available refs/HEADs, reflog event time,
or `FETCH_HEAD` modification time. Treat timestamps at or after `now - days * 86400` seconds as recent.
Scan physical directories on the root filesystem, including hidden directories; do not follow symbolic links or
traverse `.git` or dependency trees. Removing an outer dependency folder also removes its nested dependencies.
Use the nearest encountered `.git` owner; linked worktrees share repository refs, so a recently active repository
protects dependencies in its older worktrees. Do not fetch or contact remotes during activity inspection.

Preserve dependencies with recent activity, unknown owners/history, failed Git inspection, symbolic links,
or tracked files. A stale repository's uncommitted files outside its dependencies remain untouched.
Before executing, recheck activity, containment, tracked files, and embedded repositories; stop on failed validation.
Do not replace Git-history evidence with folder modification times or a clean working-tree requirement.
Explain that Git activity does not prove absence of running processes; coordinate cleanup with ongoing work.

When the user authorizes reinstallable dependencies in worktrees regardless of activity, inspect the selected
workspace's Git ownership and locate its package manifest and lockfile before selecting `node_modules`.
Use `paths remove` for those exact paths; `dependencies remove` retains its inactivity rule.
Do not classify a main checkout as a linked worktree merely because its directory is named `.workspace`.
Preserve dependency folders containing embedded `.git` entries. Report blocked paths, select the remaining
validated targets, and preview that new batch before executing; do not weaken the repository guard.

## Home caches and Trash

For a home-directory inspection, pass the resolved home directory explicitly as `--root` and inspect `.cache`,
`.npm`, `.bun`, `.cargo`, `.local/share`, and `.local/state` before proposing targets.
Measure each candidate again immediately before cleanup; shared hard links can change totals between scans.
Inspect database files, WAL files, sessions, snapshots, installed runtimes, and model weights separately.
In particular, inspect OpenCode's `opencode.db` and companion files before treating its data directory as disposable.
Do not infer that an application database is a rebuildable cache from its parent directory's location.

For an authorized cache beneath `.cache`, use the existing `paths remove` preview and execution commands with
the home directory as `--root`. For example, select `.cache/pi-codegraph` only after inspecting its contents.
Do not generalize authorization for one cache to Go, npm, Bun, browser, or other caches.
For package-manager cache commands or database maintenance, verify current official documentation first.
The artifact command does not accept arbitrary `.npm`, `.bun`, or Trash paths. Use the reviewed native-directory
workflow below for exact cache/temp directories outside its naming policy; Trash retains its separate procedure.

### Reviewed native cache and temporary directories

Use this workflow after reviewing contents and identifying the producer, including macOS extracted temp runtimes,
browser staging clones, and application caches. A location or runtime-looking name does not establish disposal.

1. Select exact directories strictly inside one explicit root. Never pass globs, shell-expanded lists, an entire
   temp/cache container, or an unreviewed source tree. `native review <paths...> --root <container>` records the
   selection and returns its manifest path. It rejects symlink targets/ancestors, filesystem crossings, overlapping
   selections, and deletion of root's `.tmp`. Tracked files, embedded repositories, and active targets are preserved
   with reasons. Inspection uncertainty aborts the review. It may record safe siblings alongside blocked entries.
2. Read the saved manifest's `actions`, `preserved`, and `processWarnings`, or request it with `--verbose`. Actions contain allocation and a
   SHA-256 identity derived from every entry's path, device, inode, size, and change/modification times. Parent
   entry lists establish the baseline for detecting later arrivals. The review writes only `.tmp/native-cleanup-*/manifest.json`.
3. Run `native remove <manifest> --root <container>` to validate the saved batch without writing or deleting.
   Obtain missing user authorization for its concrete actions. Do not edit a manifest to expand authorization;
   create a fresh review when scope or contents change.
4. Add `--execute` within existing authorization. Revalidate the entire batch before the first deletion, then
   recheck each target's contents/identity, process use, and identity again before native GNU `rm -r -- <exact-path>`.
   Preserve newly active targets. Stop at the first validation, process, removal, or verification failure.
   Save command exit statuses, selected actions, verified removals, preserved entries, failure, and before/after
   available-byte `df` output in a separate `.tmp/native-cleanup-*/execution.json`, replacing the receipt atomically
   after each removal. Retain the original manifest and partial receipt on failure.
5. Read the receipt or `--verbose` output and report `removed`, `preserved`, `newEntries` in reviewed parent directories, and `failure` separately. Verify
   removed paths are still absent. Report `freeBeforeBytes`, `freeAfterBytes`, and `reclaimedBytes` as the observed
   filesystem change, separate from allocation estimates. Concurrent writes may make this delta negative.

Global `lsof -nP -F0pn` snapshots cover visible open/mapped files, executables, and working directories at review
and immediately before each removal. Normalize macOS `/var` aliases and conservatively preserve ambiguous escaped
names. Related mount warnings and malformed/failed snapshots block cleanup; unrelated mount warnings are recorded.
Process visibility is limited by the invoking user's permissions. Snapshots and repeated identity checks cannot
lock out a producer that starts or writes afterward; coordinate stopping the producer before cleanup when needed.
Do not weaken Git guards to remove copied repositories. Review source changes through a separate authorized workflow.

### CodeGraph indexes

Include CodeGraph storage in development and home disk inspections. Locate the configured index store from
the installed integration's configuration and environment; check the XDG cache root rather than assuming
`~/.cache`. Inspect central stores such as `pi-codegraph/projects` and their daemon directories, plus real
project-local `.codegraph` directories. Resolve project index symlinks for attribution, but measure each
physical directory once and never pass a symlink to the removal command.

Report per-project index sizes, database/WAL sizes, and logs separately. Where present, use
`.pi-codegraph.json` metadata's `sourcePath` to associate hashed directories with projects or worktrees.
Check whether those sources still exist; missing metadata or an inspection error is not proof of a stale index.
Do not apply Rust's 30-minute artifact policy to CodeGraph indexes or assume native garbage collection
enforces an age or size limit. Verify the installed implementation's collection rules before proposing it.

Before proposing index deletion, inspect open database files and mapped files, daemon processes, and sockets.
Preserve active indexes; coordinate stopping their owner before rechecking an authorized target. Never unlink
individual live database, WAL, or shared-memory files as cache cleanup. Explain that removing an index requires
reindexing. Preview only explicitly selected, validated inactive cache directories with `paths remove` where
its path policy permits them; project-local `.codegraph` alone is not an accepted artifact component.
Do not delete an entire central store merely because one project's index is stale.

When emptying Trash is explicitly authorized, inspect its resolved `.local/share/Trash/files` and `info`
directories, reject symbolic-link containers and filesystem crossings, and save the exact entry list before removal.
Remove the enumerated entries with native `rm -r --`, preserving both containers; do not use wildcard or force deletion.
Preserve unrelated home data. Record selected entries, command exit status, before/after `df`, and any failures in
the project's `.tmp`. Verify that both Trash containers are empty; report concurrent new entries or failures rather
than declaring completion. Trash cleanup currently requires this explicit workflow; no bundled Trash command exists.

## Docker

Include Docker when inspecting system-wide cleanup candidates. Check the current context and endpoint before
attributing usage to the local filesystem: `docker context show`, `docker context inspect`, and
`docker info --format '{{.DockerRootDir}}'`. Report daemon unavailability rather than zero usage.
Run `docker system df` and `docker system df -v`, then inspect `docker ps -a` and container mounts.
Report images, build cache, containers, and volumes separately; do not sum shared layers into a reclaimed-space claim.
Review bind-mounted host data separately because container writable-layer size does not measure that data.

Treat reclaimable figures as Docker's estimates, not deletion authorization. Preserve volumes unless their contents
have been reviewed and their removal explicitly authorized; zero container links does not establish disposal.
Review unused locally built images before removal because they may require source and a build rather than a pull.
Use native Docker commands for authorized cleanup; never recursively remove the Docker data directory.
Check [build-cache pruning](https://docs.docker.com/reference/cli/docker/builder/prune/) and
[image pruning](https://docs.docker.com/reference/cli/docker/image/prune/) documentation before choosing flags.
Inspect local command help too: `docker builder prune` may invoke Buildx, whose `--all` semantics differ.
For Buildx, verify the selected builder and consult
[Buildx pruning](https://docs.docker.com/reference/cli/docker/buildx/prune/) documentation.
When all unused build cache and images are authorized, use `docker buildx prune --builder <verified-builder> --all --force`
and `docker image prune --all --force`, running them sequentially and stopping on a failed exit status.
Docker's `--force` skips its confirmation prompt; it does not authorize volume deletion or filesystem force removal.
Do not substitute broad system or volume pruning for a cache-only request. Record prune output and before/after
`docker system df` and local `df` in the project's `.tmp`; verify retained containers after execution.
Docker inspection and cleanup currently use these native commands; no bundled Docker command exists.

## Worktrees and explicit artifacts

Remove worktrees with native `git worktree remove`, never recursive filesystem deletion or `--force`.
Reject the main worktree, unregistered targets, locked/prunable targets, index locks, changed/untracked/ignored files,
and HEADs not retained by a branch or tag. Review ignored artifacts separately with `paths remove` when authorized,
then retry the worktree preview. Preserve branches and tags. Do not infer a branch is merged from its folder name.
For dirty worktrees or detached commits, report the blocking evidence and stop; do not stash, reset, commit, or unlock.

Reject artifact paths containing tracked files or embedded `.git` entries. Review backups before deleting them;
the cache-path naming check does not establish that their content is disposable.
Preserve the root's `.tmp` container because execution logs are stored beneath it. Remove selected children instead.
Validate an entire batch before its first deletion and revalidate each target immediately before deleting it.
On the first removal or verification failure, stop the batch and retain its partial execution log.

## Output and maintenance

Set `AGENT=1`, `true`, or `yes` for compact JSON and untruncated help/errors. Other values use indented JSON,
tree help trimmed to terminal width (100-column fallback), and concise errors. Agent help begins with the skill alert.
Rust inspection inherits Cargo configuration and environment overrides, and disables rustup auto-installation
with `RUSTUP_AUTO_INSTALL=0`. Other commands have no additional cleanup environment settings.
Each nonempty artifact/worktree execution creates `.tmp/cleanup-*/execution.json` under root,
records selected actions, verified removals, failures, and before/after `df` output. Native review/execution uses
`.tmp/native-cleanup-*` as described above. All inspection and removal-preview commands write no logs.
Return exit code `0` on success or help, `1` on validation, usage, inspection, removal, or verification failure.

Distinguish allocated size from actual reclaimed bytes: hard links/shared storage and concurrent filesystem changes
can make per-folder estimates differ from the change in filesystem free space. Report actual free space from `df`;
do not sum allocations and claim that amount was reclaimed. Unknown or failed checks are not evidence of safety.

When modifying any command, argument, option, default, environment handling, output, or side effect, update this file
in the same change, update `last_modified`, and run `bun run check` from the skill directory. Use tests in
[scripts/__tests__/cleanup.test.ts](scripts/__tests__/cleanup.test.ts) and keep test artifacts in the skill's `.tmp`.
