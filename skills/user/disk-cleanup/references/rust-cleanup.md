# Rust project cleanup

Use `rust list --root <parent> --idle 30m` to inspect direct child directories containing `Cargo.toml`.
Pass the parent containing the projects, not an individual project. Nested projects are included in their
parent's activity scan; they are not independently discovered for deletion.

## Choose the artifact scope

| Scope | Exact project-relative path | Effect |
| --- | --- | --- |
| `tmp` | `.tmp` | Remove reviewed temporary artifacts; retain protected contents and their ancestor containers. |
| `coverage` | `target/llvm-cov-target` | Remove the reviewed instrumented build directory while retaining ordinary `target/debug` state. |
| `target` | `target` | Discard the full local build cache, including incremental state and nested coverage output. |

Measure coverage separately, but do not add it to the target total: it is a subset. Selecting both `coverage`
and `target` removes the target only once. Missing artifacts are reported with `exists: false` and `bytes: null`.
Failed or incomplete inspection is not a zero-byte measurement.

1. Review project activity, exact artifact paths, allocated sizes, and preserved contents.
2. Verify the build and coverage invocations do not share these paths with another project or redirect coverage
   into normal development storage. Review `.tmp` contents for backups, databases, sessions, and irreplaceable outputs.
3. Match the selection to existing user authorization. “Temporary files” alone does not authorize removal of
   `target`; ask about that ambiguity once. Preserve incremental compilation unless full target removal is selected.
4. Preview exact projects with `rust remove project-a project-b --root <parent> --idle 30m --artifacts tmp,target`.
   Use `--artifacts tmp` or `--artifacts coverage` when normal development builds must remain cached.
5. Append `--execute` within the authorized scope. Read the execution log and measure free space afterward.

Never disable incremental compilation or add unconditional `cargo clean` to everyday builds to control growth.
Prefer cleanup of completed coverage runs and explicitly selected inactive projects. Review the largest paths
after builds; agree on retention and storage budgets before scheduling automatic deletion. This command installs
no scheduler and imposes no recurring deletion policy.

## Activity and preservation rules

Use a fixed cutoff captured at command start. A project is idle only when all scanned filesystem modification
and change timestamps and recorded Git activity are strictly older than that cutoff, with no matching process.
Scan the complete physical project tree, including source, hidden files, artifacts, and Git metadata; use both
file and directory timestamps. Access times do not indicate source changes and are not used.
Inspect Git refs, reflogs, and `FETCH_HEAD` for the owner and nested checkouts. An unborn repository may qualify
using its filesystem evidence; a missing Git owner or failed Git command blocks inspection.

Use `lsof` to detect the current Unix user's open files, mapped executables, and working directories beneath
the project. Return matching PIDs and preserve the project. Fail closed on unknown diagnostics or warnings
affecting the project or its ancestors. Return recognized inaccessible-mount warnings outside the project in
`processWarnings`; they do not block this project's inspection. Other users' processes and external symlink
destinations are outside this check. Coordinate with workers using shared directories or other user identities.

Revalidate the whole batch before its first deletion, then recheck project activity, storage layout, tracked
content, and artifact boundaries before each target. Account for directory timestamp changes caused by this
batch's own removals; a subsequent differing timestamp still blocks cleanup. Stop and keep the partial log on
the first failure. These checks are snapshots, not a lock against a process starting during deletion.

Preserve tracked content, symlinks, special files, mounted filesystems, and embedded Git repositories. Split a
temporary tree around embedded repositories, deleting only reviewed unprotected siblings. Detect `.git` files
and directories and conservatively preserve bare repository layouts containing `HEAD`, `objects`, and `refs`.
Do not remove a retained clone's files merely because the clone lives under `.tmp`.

## Supported storage and output

Run `cargo metadata --format-version 1 --no-deps --locked --offline` in each project with rustup auto-installation
disabled. Do not relax failed metadata inspection. Require the workspace root to equal the project, all member
manifests to remain inside it, and the resolved target to equal its local `target`. A reported separate build
directory, external workspace member, or nonstandard target requires manual review and is not removed here.
See [Cargo metadata](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html).

The command measures only the three literal paths above. Custom coverage directories, build directories omitted
by this Cargo's metadata, overrides used only in earlier build invocations, and other projects pointing into this
target require separate inspection. It does not infer private ownership from a standard directory name.
Use native Cargo or coverage-tool cleanup only after verifying its resolved paths and current command scope.

List output includes `idleMs`, `coverageIncludedInTarget`, and `projects`. Each project includes its path,
eligibility/reason, nullable inspection error and activity timestamp (Unix milliseconds), process IDs, warnings,
and artifact allocations. List returns exit code `1` if any inspection failed while retaining successful reports.
Removal output includes initial project reports, preserved paths/reasons, and the shared removal result.
Active projects are preserved without making a successful inspection an error; inspection failures abort removal.
An empty action set returns `execute: false`, no removals, and no log even if `--execute` was supplied.
Nonempty execution logs contain exact actions, verified removals, failures, and before/after `df` output.

Maintain [project inspection](../scripts/inspectRustProjects.ts), [activity checks](../scripts/inspectRustActivity.ts),
[artifact selection](../scripts/selectRustArtifacts.ts), and [removal](../scripts/removeRustArtifacts.ts) together.
Exercise their behavioral tests before changing safety decisions. The generic `paths remove` command does not
apply Rust inactivity or process checks; do not substitute it to bypass a failed Rust inspection.
