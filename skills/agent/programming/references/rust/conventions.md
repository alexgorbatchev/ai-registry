Read the repository instructions, workspace manifests, toolchain configuration, and relevant implementation before changing Rust code. Respect the project's minimum supported Rust version (MSRV), target platforms, and existing runtime. Verify unfamiliar APIs against documentation for the resolved dependency version.

Read these references when the task reaches their domain:

- [Setup](setup.md): package layout, toolchains, dependencies, Cargo features, and CLI projects.
- [Testing and releases](testing-and-releases.md): verification commands, CI, coverage, packaging, and publishing.
- [Disk usage](disk-usage.md): **5 GB task-owned artifact budget**, shared/global cache exclusions, immediate scratch cleanup, profile tuning, and safe retention. Read this before builds, tests, coverage, profile changes, or artifact cleanup.

Keep incremental compilation enabled for active development. A disk-space request does not authorize disabling it or discarding active development caches. Apply storage changes only within the requested scope.

Keep the current task's own artifacts at or below **5 GB (5,000,000,000 allocated bytes)** as defined in the disk-usage reference. Exclude shared/global caches, pre-existing artifacts, dependencies, other tasks' outputs, and runtime data. A shared cache's total size alone never blocks task work or authorizes cleanup. Remove task-owned temporary files after their last consumer finishes; pause only operations that would increase an exhausted task budget, preserving active incremental state and continuing independent authorized work.

## Names and domain boundaries

- Use `snake_case` for functions, modules, and fields; `UpperCamelCase` for types and traits; and `SCREAMING_SNAKE_CASE` for constants. Prefer `HttpClient` to `HTTPClient`.
- Name modules for responsibilities. Keep public exports deliberate; default to private fields and narrow visibility. Avoid dumping unrelated logic into `utils` or `common`.
- Use enums for mutually exclusive states, newtypes for distinct domain values, and constructors that establish invariants. Implement `Default` only when its value is meaningful.
- Use `Option` for absence and `Result` for failure. Do not use sentinel strings, invalid zero values, or boolean argument sequences to encode domain states.
- Follow conventional conversion names and traits: `as_` for borrowed views, `to_` for conversions, `into_` for consuming conversions. Use `TryFrom` when conversion can fail; do not implement `Deref` to simulate inheritance.

Naming and API conventions: [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/checklist.html).

## Ownership and data flow

- Make ownership transfer intentional. Borrow when the caller retains ownership; take ownership when the callee must retain or consume the value. Prefer `&str` and slices when the operation does not require an owned string or vector.
- Resolve borrow-checker errors by clarifying lifetimes and responsibility. Do not add `clone()`, `Arc<Mutex<_>>`, leaked allocations, or `'static` bounds merely to silence diagnostics. Cloning is appropriate when independent ownership is actually required; document expensive copies at important boundaries.
- Use `Path`/`PathBuf` and `OsStr`/`OsString` for filesystem and process boundaries. Do not assume paths are UTF-8 or use lossy conversion as an identifier.
- Use RAII for resource ownership. If flushing, committing, or closing can fail in a way the caller must handle, expose an explicit fallible operation rather than hiding it in `Drop`.
- Prefer straightforward iteration and borrowing to allocation-heavy transformations. Benchmark before introducing elaborate lifetime machinery, custom allocators, or unsafe optimizations.

## Traits, abstraction, and duplication

- Extract repeated domain behavior when its meaning is shared. Similar syntax alone does not justify a generic framework.
- Start with concrete types. Introduce traits for meaningful contracts, multiple implementations, ecosystem integration, or a real substitution boundary. Rust traits are explicitly implemented; account for coherence and orphan rules when designing extension points.
- Use generics for static dispatch when it fits the API. Use `dyn Trait` when runtime heterogeneity or an intentional erased boundary is needed; check dyn compatibility. Do not box every dependency or make every function generic by habit.
- Keep generic constraints as small as the implementation requires. Consider monomorphization and compile-time cost when designing heavily generic APIs.
- Prefer small named functions and explicit control flow to deeply nested combinators. Use macros only when ordinary functions, types, or generics cannot express the required abstraction clearly.

Trait contracts: [Rust Reference](https://doc.rust-lang.org/reference/items/traits.html).

## Errors and diagnostics

- Return recoverable failures through `Result`; propagate with `?` and add context where the operation becomes meaningful. Preserve error sources instead of converting everything into strings.
- Expose typed errors when callers must inspect variants or recover programmatically. Use the standard error traits; an existing `thiserror` dependency can derive their implementation.
- At application boundaries, an existing `anyhow` dependency is appropriate for contextual reports. Do not force an opaque application error type into every public library API.
- Reserve panics for violated internal invariants. Avoid `unwrap()`/`expect()` on user input, network responses, filesystem state, and other runtime failures. A justified invariant assertion should explain the invariant; tests may use assertions to fail clearly.
- Log or display errors at an owning boundary rather than repeatedly logging and returning the same failure. Keep secrets out of error context and structured logs.

Error crate contracts: [thiserror](https://docs.rs/thiserror/latest/thiserror/), [anyhow](https://docs.rs/anyhow/latest/anyhow/).

## Concurrency and async

- Choose threads or async from the workload and existing architecture. Do not add an async runtime to a synchronous library without a concrete requirement.
- Every spawned thread or task needs an owner, a shutdown path, and a policy for observing failure. Define timeouts, cancellation, and bounded concurrency at external boundaries.
- Keep lock scopes short. Avoid holding synchronous lock guards across `.await`; redesign the critical section or use the runtime's appropriate primitive when asynchronous locking is required.
- Keep blocking work off async executor threads. For Tokio, check `spawn_blocking` semantics: a started blocking task cannot simply be aborted. Bound its concurrency and design cooperative termination when necessary.
- Treat cancellation as a correctness concern: identify partial writes, held resources, and operations that must finish. Do not assume dropping a future rolls back external effects.
- Prefer channels or explicit shared-state ownership over pervasive mutable globals. Test shutdown and failure paths, not only successful parallel execution.

Runtime references: [Tokio graceful shutdown](https://tokio.rs/tokio/topics/shutdown), [Tokio blocking tasks](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html). For another runtime, consult its corresponding contracts.

## Unsafe and public contracts

- Prefer safe library or standard-library primitives. Keep necessary `unsafe` small and encapsulated behind a safe interface whose invariants are enforced.
- Explain each unsafe operation's safety argument at its use site. Document caller obligations with a `# Safety` section on unsafe public APIs. Test boundaries and failure cases; a passing test is not a proof of soundness.
- Do not use unchecked indexing, `transmute`, manual `Send`/`Sync`, or raw-pointer lifetime tricks as routine performance fixes.
- Document public behavior, errors, panics, feature requirements, and meaningful examples. Keep examples executable as documentation tests where practical.

Unsafe obligations: [Rust Reference](https://doc.rust-lang.org/reference/unsafe-keyword.html).

## Completion checks

- Verify behavior with relevant tests and the repository's required checks; report exact commands and failures. Use the testing reference to select additional coverage, platform, or feature checks.
- Review API compatibility, ownership, failure propagation, and task shutdown alongside formatting and lint results.
- Inspect dependency and feature changes for unnecessary work, build-size growth, and MSRV impact.
- For storage work, report measured before/after usage and exactly what was removed or configured. Preserve active incremental caches and distinguish estimates from reclaimed space.
