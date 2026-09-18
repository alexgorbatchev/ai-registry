# Go Release Notes (Go 1.23+)

Language and tooling changes released after the model training cutoff. Read this when choosing between a newer and an older idiom, when a build or CI step depends on a recent `go` subcommand or analyzer, or when raising the `go` line in `go.mod`. Day-to-day coding rules live in `SKILL.md`.

## Go 1.23 (Aug 2024)

- **Language**
  - `for range` now supports iterator functions (`func(func() bool)`, `func(func(K) bool)`, `func(func(K, V) bool)`) as range expressions.
  - Generic type aliases were introduced as a preview behind `GOEXPERIMENT=aliastypeparams`.
- **Tooling**
  - Added opt-in Go telemetry (`go telemetry on|off|local`).
  - Added `go env -changed` to print only non-default effective environment settings.
  - Added `go mod tidy -diff` for non-mutating module tidy checks in CI.
  - Added `godebug` directive support in `go.mod` / `go.work`.
  - `go vet` gained the `stdversion` analyzer for version-incompatible symbol usage.
  - `cmd/cgo` added `-ldflags` support to avoid large `CGO_LDFLAGS` argument overflow issues.
  - `trace` became more resilient to partially broken trace data.

## Go 1.24 (Feb 2025)

- **Language**
  - Generic type aliases became fully supported.
- **Tooling**
  - Added first-class module tool dependencies via `tool` directives in `go.mod`.
  - Added `go get -tool` and the `tool` meta-pattern (`go get tool`, `go install tool`).
  - `go run` and `go tool` executable outputs are now cached in the build cache.
  - Added structured JSON build output via `go build -json` / `go install -json`; expanded `go test -json` build event reporting.
  - Added `GOAUTH` for private module fetch authentication.
  - `go build` now embeds main module VCS version info (including `+dirty` when applicable).
  - Added `GODEBUG=toolchaintrace=1` for toolchain selection debugging.
  - Cgo added `#cgo noescape` and `#cgo nocallback` performance annotations.
  - `go vet` added `tests` analyzer and improved checks in `printf`, `buildtag`, and `copylock`.
  - `GOCACHEPROG` cache protocol support graduated from experiment.

## Go 1.25 (Aug 2025)

- **Language**
  - No language changes affecting Go programs (spec cleanup removed “core types” terminology).
- **Tooling**
  - `go build -asan` now enables leak detection by default at process exit.
  - Go distributions ship fewer prebuilt auxiliary tools; non-core tools are built on demand by `go tool`.
  - Added `ignore` directive in `go.mod` for directories excluded from package pattern matching.
  - Added `go doc -http` to launch docs in a local web server/browser.
  - Added `go version -m -json` for machine-readable embedded build info.
  - Added `work` package pattern to target all workspace/main-module packages.
  - `go` no longer auto-adds a `toolchain` line when updating `go` lines in `go.mod` / `go.work`.
  - `go vet` added `waitgroup` and `hostport` analyzers.

## Go 1.26 (Feb 2026)

- **Language**
  - Built-in `new` now accepts expressions, allowing inline initialization (for example `new(yearsSince(born))`).
  - Generic types may now self-reference in type parameter constraints (for example `type Adder[A Adder[A]] interface { ... }`).
- **Tooling**
  - `go fix` was rewritten as the modernizer hub (analyzer-based fixers + `//go:fix inline` support).
  - `go mod init` now defaults new modules to an older, broadly compatible `go` version line.
  - `cmd/doc` and `go tool doc` were removed; `go doc` is the replacement.
  - `pprof -http` now defaults to flame graph view.
