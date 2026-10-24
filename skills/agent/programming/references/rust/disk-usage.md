# Rust disk usage

## Contents

- [Storage ceiling and temporary files](#storage-ceiling-and-temporary-files)
- [Measure and explain](#measure-and-explain)
- [Keep fast development builds](#keep-fast-development-builds)
- [Cleanup workflow](#cleanup-workflow)
- [Coverage artifacts](#coverage-artifacts)
- [Cargo home and rustup](#cargo-home-and-rustup)
- [Prevent recurrence](#prevent-recurrence)

## Storage ceiling and temporary files

- Keep artifacts owned by the current task at or below **5 GB (5,000,000,000 allocated bytes)** in total: task-created temporary files, final/intermediate build outputs, incremental state, test/coverage/profiling artifacts, and caches dedicated to that task. Count these artifacts across checkout, worktrees, external target/build directories, profiles, and target triples. Moving them does not reset the budget. Keep the same task baseline across retries, resumed sessions, and agent handoffs. Count physical storage once without adding nested totals.
- Exclude artifacts created before this task began, other tasks' outputs, shared/global compiler and build caches, downloaded dependencies, installed tools, and runtime data such as sessions, credentials, and databases. A shared cache or target directory exceeding 5 GB does not by itself block task work or authorize cleanup.
- Resolve affected paths using the measurement workflow below. Record a baseline for reused output directories and measure attributable task artifacts before and after artifact-producing runs; monitor long-running commands. Do not charge the entire reused target directory to the task. If concurrent writes prevent reliable attribution, report that limitation and continue while actual filesystem space permits; uncertain ownership never authorizes deletion.
- At the task's limit, pause only operations that would increase its counted artifacts. Remove verified task-owned disposable files and remeasure, while continuing independent authorized work. If required task artifacts still cannot fit, preserve them and report their paths, sizes, affected operations, and the required budget or scope decision. Actual filesystem exhaustion is a separate blocker even when caused by excluded storage.
- Keep task scratch files in a dedicated project `.tmp` child and register cleanup when creating them. Remove each temporary file immediately after its last consumer finishes, including on failure or cancellation. Clean completed experiments and intermediate coverage/profile files once results have been consumed or retained outside disposable storage. Perform a final cleanup before handing off the task; do not wait for an inactivity threshold.
- Preserve source, fixtures, manifests, lockfiles, requested deliverables, and required diagnostic evidence. Count retained task-created generated files toward the task budget. Check tracked contents, ownership, symlinks, concurrent builds, and running binaries before deletion; remove exact task-owned disposable paths rather than wiping `.tmp` or `target` by name. Other agents' artifacts, runtime data, and active processes remain protected. The task budget grants no authority to delete or reconfigure shared storage. Use the cleanup workflow below for Cargo-managed artifacts.
- Reuse the normal workspace target and shared compiler/build caches, preserving incremental compilation. Retire only task-owned finished coverage builds and obsolete profiles; do not clean before every build or delete arbitrary hashed intermediates. Do not create fresh caches to satisfy accounting or impose the task's 5 GB limit on shared caches. Inspect shared cache sizes or change retention only for separately authorized maintenance or diagnosis of actual disk pressure, coordinating consumers first.
- Cargo's downloaded dependency sources, installed tools, and rustup toolchains are outside the task artifact budget. Never wipe `CARGO_HOME` or `RUSTUP_HOME` to satisfy that budget. Configure any shared-cache retention rule only within separately authorized maintenance after verifying the cache tool's semantics. Verify authorized cleanup's exit status and remaining task-owned allocations.

## Measure and explain

For ordinary task accounting, inspect filesystem free space and the task-owned paths identified above; do not scan global caches or other projects just to enforce the task budget. For an explicitly requested storage investigation, measure the affected directories and rank them before expanding the scan. Use the platform's `df` and `du` equivalents; verify flags locally. On GNU systems, `df -h .` and `du -h --max-depth=2 -- <resolved-directory>` provide a bounded first pass.

Locate the workspace with `cargo metadata --format-version 1 --no-deps`; review its resolved `workspace_root` and `target_directory`. Metadata can still resolve dependencies or update a lockfile, so use `--locked --offline` for inspection when supported by the existing checkout, and report resolution failures rather than silently relaxing those constraints.

Inspect the actual build invocation, Cargo configuration, and relevant environment overrides. Account for `CARGO_TARGET_DIR`, `--target-dir`, target triples, custom profiles, and coverage-specific directories. Newer Cargo also supports a separate intermediate build directory through `build.build-dir` / `CARGO_BUILD_BUILD_DIR`; verify support in the installed version and measure that directory too. Do not assume every project uses a local `target` folder.

| Storage | What to investigate |
| --- | --- |
| `debug/deps` | Compiled dependencies, libraries, test executables, debug information, and variants |
| `debug/incremental` | Incremental compiler state that speeds subsequent development builds |
| `debug/build` | Build-script outputs and native dependencies |
| Release, custom-profile, target-triple directories | Additional compilation configurations and deployment outputs |
| Coverage build and report directories | Instrumented artifacts, profiles, and generated reports |
| Cargo home registry/git directories | Downloaded archives, extracted sources, and Git dependencies |
| Rustup toolchains | Compilers, components, and target standard libraries |

The intermediate layout is Cargo-internal, not an API for selective file surgery. Dev and test normally share the `debug` directory, so deleting it is not a test-only cleanup. See [Cargo build cache](https://doc.rust-lang.org/cargo/reference/build-cache.html).

Explain growth from measured components. Multiple toolchains, flags, features, profiles, and instrumentation can require different artifacts; hashed filenames alone do not establish staleness. Do not blame incremental compilation for an entire target directory without measuring its share.

## Keep fast development builds

Preserve incremental compilation for active projects. Do not set `CARGO_INCREMENTAL=0`, disable it in Cargo profiles, or add automatic `cargo clean` before ordinary builds as a storage remedy.

When full variable-level debugging is not needed for everyday work, consider the following workspace-root configuration after reviewing the existing profile and MSRV:

```toml
[profile.dev]
debug = "line-tables-only"
incremental = true

[profile.test]
debug = "line-tables-only"
incremental = true

[profile.dev-full]
inherits = "dev"
debug = "full"
incremental = true
```

`line-tables-only` retains source locations for backtraces but sacrifices variable/parameter inspection. These string debug settings require Rust 1.71 or later. The optional `dev-full` profile is for deliberate debugger sessions via `cargo build --profile dev-full`; omit it if unnecessary. Profiles belong in the workspace root, and config/environment overrides can supersede them. See [Cargo profiles](https://doc.rust-lang.org/cargo/reference/profiles.html).

Merge the chosen settings into existing tables; never append duplicate profile tables. Do not reduce debug information for a user who requires full debugging. Keep coverage requirements separate. Avoid manually stripping files inside active build directories.

Profile changes cause rebuilds and do not guarantee immediate reclamation of old variants. Budget temporary headroom; measure a representative rebuild, subsequent edit/rebuild time, and resulting directory size. If there is insufficient space, first retire an authorized independent artifact set. Do not discard active incremental state merely to make room for the tuning experiment.

## Cleanup workflow

1. List exact resolved paths, allocated sizes, owners, and why their contents are reproducible. Check symlinks, shared target directories, mounted filesystems, tracked files, embedded repositories, and concurrent builds or running binaries. Unknown ownership or failed inspection is a reason to stop that candidate.
2. Prefer finished coverage runs, obsolete custom/release profiles, and inactive projects over active development artifacts. Directory timestamps alone do not prove inactivity; inspect repository activity and coordinate ongoing work.
3. Preview the native command's exact scope. Match it to existing user authorization; an inspection request authorizes no deletion. If authorization is missing, present concrete candidates before asking. Do not ask again for an already authorized scope.
4. Revalidate targets immediately before removal. Execute sequentially and stop on the first failure. Preserve source, manifests, lockfiles, reports still needed, and build artifacts that are the only retained copy of a deliverable.
5. Record the command, exit status, and before/after measurements in the project's scratch directory. Verify retained development state and actual filesystem free space. Allocation totals are estimates, not guaranteed reclaimed bytes: hard links, shared storage, open files, and concurrent writes affect the result.

Native Cargo previews, run in the inspected workspace with the same verified directory/configuration overrides as the build:

```sh
cargo clean --doc --dry-run --verbose
cargo clean --profile release --dry-run --verbose
cargo clean --profile dev-full --dry-run --verbose
```

Select one applicable command; these are alternatives, not a cleanup script. Remove `--dry-run` only for the authorized selection after checking the preview. Check local `cargo clean --help`; if this Cargo lacks dry-run support, inspect the directory contents and documented scope explicitly before acting. Never silently fall back to a broader clean.

Unqualified `cargo clean` removes the target artifacts broadly. Reserve it for an explicitly selected inactive workspace whose entire affected build state may be discarded. Package selection (`-p`) is not an age filter, and cleaning a package can discard its useful incremental work. `--workspace` selects workspace packages; it is not a synonym for every cached dependency. See [cargo clean](https://doc.rust-lang.org/cargo/commands/cargo-clean.html).

With shared targets or a separate build directory, establish the scope of both final and intermediate artifacts before any clean. A profile's output can serve multiple projects; selecting one manifest does not make a shared directory private. Do not delete arbitrary hashed files from `deps`, `.fingerprint`, or `incremental`, or recursively remove every directory named `target`.

## Coverage artifacts

Keep normal and instrumented builds separate. Inspect the installed coverage tool, its configuration, and any `CARGO_LLVM_COV_TARGET_DIR` override; do not guess the coverage path from a familiar folder name. Export reports that must survive cleanup to a retained location outside all affected directories.

For cargo-llvm-cov, distinguish these operations:

- `cargo llvm-cov clean --workspace` resets workspace artifacts that could distort coverage; it is not a promise to reclaim the full dependency cache.
- `cargo llvm-cov clean` performs broader removal of its coverage build and default output directories. Current implementation also handles a separate coverage build directory. Verify the installed version's behavior and resolved paths first.

The clean command does not provide Cargo's `--dry-run` flag. Preview by inspecting the affected paths and sizes, not by inventing unsupported flags. If overrides or a `show-env` workflow point coverage at normal development storage, resolve that overlap before cleaning. Do not erase active development artifacts under the assumption that the command name implies isolation.

Sources: [cargo-llvm-cov usage](https://github.com/taiki-e/cargo-llvm-cov), [cleanup implementation](https://github.com/taiki-e/cargo-llvm-cov/blob/main/src/clean.rs).

## Cargo home and rustup

Resolve `CARGO_HOME` and `RUSTUP_HOME` rather than assuming default locations. Never delete either root as a cache. Cargo home also contains installed executables, installation metadata, configuration, and credentials. Preserve offline dependencies and private Git sources that cannot be fetched again. See [Cargo home](https://doc.rust-lang.org/cargo/guide/cargo-home.html).

Current Cargo automatically ages out unused global source/download caches during qualifying commands. This does not collect project build artifacts. `cache.auto-clean-frequency` controls how often cleanup checks run, not the retention age or a maximum cache size; offline/frozen operation disables automatic deletion. Verify the installed Cargo's support before changing configuration. Do not recommend unstable manual GC commands as stable functionality. See [global cache configuration](https://doc.rust-lang.org/cargo/reference/config.html#global-caches).

Inspect `rustup toolchain list`, `rustup show`, and `rustup override list`, then inspect installed components and targets for each candidate toolchain. Check project toolchain files and CI/MSRV needs before declaring one unused. Use native `rustup toolchain uninstall <toolchain>`, `rustup component remove --toolchain <toolchain> <component>`, or `rustup target remove --toolchain <toolchain> <target>` only for the reviewed, authorized selection. Angle-bracket values are placeholders, not literal shell commands. Confirm flags with local help and [rustup documentation](https://rust-lang.github.io/rustup/).

Do not remove nightly if an active workflow needs Miri or nightly features, or remove LLVM tools needed for coverage. Do not remove rust-src without checking editor and build needs. Remove installed Cargo applications through `cargo uninstall` when requested, not by manually deleting installation metadata.

## Prevent recurrence

- Keep a small, intentional set of development, release, and coverage configurations. Avoid unnecessary changes to compiler flags and target locations between commands.
- Reuse the normal target within a real Cargo workspace. Do not impose one global target directory on unrelated projects: ownership and cleanup become coupled.
- Enforce the task-owned 5 GB budget and immediate task scratch cleanup above. Schedule broader cleanup of inactive project builds or retained release artifacts only within an explicitly authorized retention rule; do not apply the task budget to shared cache totals.
- Recheck the largest directories after representative development and coverage runs. Report growth by category so the next cleanup targets the cause.
- Treat shared compiler caches as a separate performance experiment. Check the cache tool's current incremental-compilation compatibility and configure a size bound before adoption; do not disable incremental compilation just to obtain cache hits.
