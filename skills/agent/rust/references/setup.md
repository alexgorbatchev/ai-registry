# Rust project setup

## Inspect before provisioning

Inspect `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml` or `rust-toolchain`, applicable `.cargo/config.toml` files, CI, and repository instructions. Run `rustc --version --verbose`, `cargo --version`, and, when rustup is used, `rustup show`.

Declare the package's supported compiler with `rust-version`; keep edition selection compatible with it. A toolchain pin selects a compiler for development, whereas MSRV describes a compatibility promise. Test that promise rather than assuming the lockfile or edition enforces it. Consult [Cargo's rust-version rules](https://doc.rust-lang.org/cargo/reference/rust-version.html) before changing either.

For new rustup installations, prefer the minimal profile with the components actually required, such as rustfmt and Clippy. Add targets, nightly, documentation, and LLVM tooling only for a concrete workflow. Respect existing pins and overrides; do not change a machine-wide default to fix one project. See [rustup profiles](https://rust-lang.github.io/rustup/concepts/profiles.html) and [overrides](https://rust-lang.github.io/rustup/overrides.html).

## Cargo layout and configuration

- Keep executable startup in `src/main.rs` thin when substantial reusable logic belongs in `src/lib.rs` or domain modules. Use `src/bin/` for additional executable targets.
- Use a Cargo workspace for packages developed together. Share dependency versions and lint policy deliberately; workspace inheritance still requires member opt-in.
- Put profile settings in the workspace root manifest. Virtual workspaces need an explicit resolver compatible with the supported toolchain; choose it from current Cargo documentation, not an unexamined template.
- Use Cargo's native artifact layout. Add distribution staging directories only when packaging requires them, and exclude generated outputs from version control.
- Inspect configuration from the command's working directory through its ancestors and Cargo home, plus command-line and environment overrides. A workspace-root command does not read member-local Cargo configuration as though run from that member.
- Keep build scripts focused on actual code generation or native build needs. Declare their input dependencies correctly; avoid unconditional network access and unnecessary rebuilds.

References: [workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html), [configuration discovery](https://doc.rust-lang.org/cargo/reference/config.html#hierarchical-structure), [build scripts](https://doc.rust-lang.org/cargo/reference/build-scripts.html).

## Dependencies and features

Use standard-library functionality when it meets the requirement. Before adding a crate, inspect existing dependencies and current primary documentation; assess maintenance, API fit, platform support, license, MSRV, features, and transitive cost. Prefer an established implementation to custom parsing, cryptography, protocol handling, or serialization. Do not introduce a second library for an already-solved concern without a reason.

Keep normal, development, and build dependencies in their correct Cargo sections. Provision external developer tools separately with documented versions; do not add a crate as an application dependency merely to install its executable. Follow the repository's lockfile policy and check the [Cargo lockfile guidance](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html) when establishing a new policy.

Inspect the resolved graph with `cargo tree --duplicates` and `cargo tree -e features`. Do not equate duplicate versions with safe removals: compatibility and host/target requirements can justify them. Choose optional dependencies and enabled features deliberately.

Design features to add capabilities. Avoid mutually exclusive features where possible; if a repository already has them, test valid combinations separately rather than prescribing `--all-features`. Document defaults and the supported feature matrix. Disabling a dependency's default features in one declaration does not prevent another dependency from enabling them. See [Cargo features](https://doc.rust-lang.org/cargo/reference/features.html).

## CLI applications

Use the repository's established CLI framework. For a new nontrivial CLI without one, evaluate [clap](https://docs.rs/clap/latest/clap/) and use its native parsing, validation, help, and error handling rather than a handwritten compatibility layer.

Keep argument parsing and output rendering at the boundary; keep domain operations callable without a terminal. Preserve stdout for results and stderr for diagnostics. Define stable machine-readable output and exit behavior where automation needs them. Test help, invalid arguments, noninteractive execution, and command failures. Do not force Rust CLI output into another language's framework conventions.

## Development storage policy

Read [disk usage](disk-usage.md) before introducing profile overrides or cache tooling. Establish one normal development profile and keep incremental compilation enabled. Agree on the debugging capability needed before reducing debug information. Do not spread storage policy across shell startup files, global Cargo configuration, and multiple manifests without understanding precedence.
