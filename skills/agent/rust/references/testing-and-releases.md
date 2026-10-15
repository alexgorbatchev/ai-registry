# Testing and releases

## Verification ladder

Run the repository's existing checks first. For a conventional workspace with a committed lockfile, the following are useful baseline commands; adjust package selection and features to the supported configuration:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo doc --workspace --no-deps --locked
```

Ensure rustfmt and Clippy are installed for the selected toolchain. Use the repository's warning policy; do not silently rewrite unrelated code or blanket-allow warnings to make a check pass. `--locked` prevents dependency resolution from silently changing the lockfile; an intentional dependency update must update and review it separately.

Use focused tests during implementation, then run required workspace checks. Test observable behavior, error propagation, boundary inputs, and regressions. Use real local integration boundaries when practical; isolate filesystem, clock, network, and process dependencies so tests remain reproducible. Do not introduce sleeps as synchronization.

`cargo test` includes documentation tests for library targets under its normal selection. Explicit `--all-targets` is useful for extra targets but is not a substitute for documentation-test coverage; run `cargo test --doc --workspace --locked` separately when target selection or another test runner omits them. See [cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html).

Test default features, supported minimal configurations, and relevant feature combinations. Run `--all-features` only when that combination is valid. Exercise the advertised MSRV and supported platforms in CI. A host build does not establish cross-platform correctness; check native dependencies and run tests on the target where required.

For unsafe code, parsers, concurrent state machines, or performance-sensitive changes, select additional tools based on the risk: Miri, fuzzing, property tests, concurrency model checking, or benchmarks. Verify each tool's supported toolchain and platform; do not present it as a universal correctness proof. Start with the [Miri documentation](https://github.com/rust-lang/miri) when evaluating undefined-behavior checks.

## Coverage

Use the project's existing coverage workflow. When adopting [cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov), provision a compatible version and its required LLVM component. Keep instrumented builds separate from ordinary development artifacts, and preserve its required compilation settings.

Export reports before cleanup. Do not carry instrumented shell settings into subsequent normal builds. When combining coverage across feature configurations, follow the tool's documented clean/accumulate/report sequence so stale artifacts cannot distort results. Coverage percentages supplement behavioral assertions; they do not justify tests that mirror implementation or assert raw configuration constants.

See [disk usage](disk-usage.md) for coverage retention and cleanup scope.

## CI storage

- Separate cache identities by relevant toolchain, platform/target, profile, dependency graph, and instrumentation settings. Use the selected cache tool's actual invalidation model.
- Bound cache retention and artifact lifetime. Avoid saving every feature-matrix target directory indefinitely.
- Keep credentials out of uploaded caches. Cargo home contains both caches and private configuration; cache selected components rather than the whole directory indiscriminately.
- Preserve useful local incremental state. An ephemeral CI optimization is not permission to change developer defaults.

Cargo documents useful cache subsets in [Cargo home](https://doc.rust-lang.org/cargo/guide/cargo-home.html#caching-the-cargo-home-in-ci).

## Packaging and release

Inspect the existing release workflow, registry destination, package metadata, supported targets, and version policy before editing automation. Publishing, tagging, and pushing must remain within the user's authorized scope.

For a crate release, review the packaged file list with `cargo package --list`, then use `cargo publish --dry-run` with the intended package and registry selection. Preserve package verification; do not add `--no-verify` or `--allow-dirty` to conceal failures. A dry run does not publish, and passing it does not guarantee registry acceptance. See [cargo package](https://doc.rust-lang.org/cargo/commands/cargo-package.html) and [cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

For binary releases, build the selected package and target with the intended release profile and lockfile. Test the packaged binary's startup and representative behavior on each supported platform; verify external runtime libraries, licensing, and archive contents. Treat release debug symbols and stripping as deliberate distribution decisions, separate from development profile tuning.

Review public API and feature changes against [Cargo's SemVer guidance](https://doc.rust-lang.org/cargo/reference/semver.html). Version dependent workspace crates coherently. Never delete and recreate an already published version tag to hide a release error; use the repository's corrective release process.
