---
name: disk-cleanup
description: Use when inspecting development, home-directory, or Docker disk usage, freeing disk space, cleaning caches or Trash, removing installable dependencies, or reviewing Git worktrees and temporary artifacts.
author: alexgorbatchev
metadata:
  created_on: '2026-10-05 07:10'
  last_modified: '2026-10-08 16:45'
  status: current
---

Use [scripts/cleanup.ts](scripts/cleanup.ts) to inspect disk usage and perform authorized cleanup.
Require Bun, Git, and GNU `du`, `df`, and `rm`. Install this skill's locked dependencies with
`bun install --frozen-lockfile` from the skill directory before invoking its scripts.
Use `{{file_dir}}/scripts/cleanup.ts`; do not assume the working directory is the skill directory.

## Inspect before selecting deletions

1. Identify the user's target root, default to $HOME. Pass it explicitly as `--root`; the default is the working directory.
2. Measure allocated space with `disk inspect` and discover large stale directories across the target root with `folders list`. Report filesystem capacity and the largest paths.
3. Use `dependencies list` for inactivity decisions and `worktrees list` for workspace registration and file status.
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
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" disk inspect --root . --depth 2
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" folders list --root . --size 1G --days 30
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" dependencies list --root . --days 30
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" dependencies remove --root . --days 30
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" paths remove project/.tmp/build-cache --root .
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" worktrees list --root .
AGENT=1 bun "{{file_dir}}/scripts/cleanup.ts" worktrees remove project/.workspaces/review --root .
```

Append `--execute` to an authorized removal command to mutate the filesystem. Without it, every removal previews.
Read [scripts/inventory.ts](scripts/inventory.ts) when changing activity classification,
[scripts/removeTargets.ts](scripts/removeTargets.ts) when changing deletion behavior, and
[scripts/inspectWorktrees.ts](scripts/inspectWorktrees.ts) when changing worktree checks.

| Command | Arguments and options | Behavior |
|---|---|---|
| `disk inspect` | `--root <directory>` default `.`, `--depth <levels>` default `2` | Return filesystem capacity and directory allocations, sorted largest first. |
| `folders list` | `--root <directory>` default `.`, `--size <size>` default `1G`, `--days <count>` default `30`, `--time <mode>` default `either`, `--depth <levels>`, `--no-prune` | Return directories exceeding size and staleness thresholds with access/modification timestamps, pruning nested matching children by default. |
| `dependencies list` | `--root <directory>` default `.`, `--days <count>` default `30` | Return each discovered outermost `node_modules` folder, owner, allocation, latest activity, eligibility, and reason. |
| `dependencies remove` | Same options plus `--execute` default false | Preview or delete all eligible folders under the selected root. |
| `paths remove <paths...>` | One or more exact paths; `--root <directory>` default `.`, `--execute` default false | Preview or delete reviewed artifacts beneath `.tmp`, `.cache`, `node_modules`, `target`, or `dist`. |
| `worktrees list` | `--root <directory>` default `.` | Return linked worktrees and `.workspaces` entries, allocations, branches/HEADs, locks, registration, status counts, and inspection errors. Partial scans return exit code `1`. |
| `worktrees remove <paths...>` | One or more exact paths; `--root <directory>` default `.`, `--execute` default false | Preview or remove validated registered linked worktrees through Git. |
| `skill` | No positional arguments or command-specific flags | Print this entire file verbatim, including frontmatter. |
| `help [command]` | One immediate subcommand name, or `-h`/`--help` on any command | Show commands and options. Use a group's `help` to select its child. No completion or version command is provided. |

Require positive integers for `--days` and `--depth`. Interpret relative removal paths relative to `--root`.
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
The existing artifact command does not accept arbitrary `.npm`, `.bun`, or Trash paths; do not claim it does.

When emptying Trash is explicitly authorized, inspect its resolved `.local/share/Trash/files` and `info`
directories, reject symbolic-link containers and filesystem crossings, and save the exact entry list before removal.
Remove the enumerated entries with native `rm -r --`, preserving both containers; do not use wildcard or force deletion.
Preserve unrelated home data. Record selected entries, command exit status, before/after `df`, and any failures in
the project's `.tmp`. Verify that both Trash containers are empty; report concurrent new entries or failures rather
than declaring completion. Trash cleanup currently requires this explicit workflow; no bundled Trash command exists.

## Docker

Include Docker when inspecting system-wide cleanup candidates. Check the current context and endpoint before
attributing usage to the local filesystem: `docker context show`, `docker context inspect`, and
`docker info --format '\{{.DockerRootDir}}'`. Report daemon unavailability rather than zero usage.
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
No other environment variables control cleanup. Each execution creates `.tmp/cleanup-*/execution.json` under root,
records selected actions, verified removals, failures, and before/after `df` output. Preview/list commands write no logs.
Return exit code `0` on success or help, `1` on validation, usage, inspection, removal, or verification failure.

Distinguish allocated size from actual reclaimed bytes: hard links/shared storage and concurrent filesystem changes
can make per-folder estimates differ from the change in filesystem free space. Report actual free space from `df`;
do not sum allocations and claim that amount was reclaimed. Unknown or failed checks are not evidence of safety.

When modifying any command, argument, option, default, environment handling, output, or side effect, update this file
in the same change, update `last_modified`, and run `just check` from the skill directory. Use tests in
[scripts/__tests__/cleanup.test.ts](scripts/__tests__/cleanup.test.ts) and keep test artifacts in the skill's `.tmp`.
