# GitHub CI/CD and Versioned Releases for Go Repositories

Use this reference when a Go repo needs GitHub Actions CI, release-on-tag automation, or published binary artifacts.

## Table of contents

- [Reference templates](#reference-templates)
- [Recommended baseline](#recommended-baseline)
- [Release workflow](#release-workflow)
- [Version metadata strategy](#version-metadata-strategy)
- [Pre-tag release checklist](#pre-tag-release-checklist)
- [Minimal workflow shape](#minimal-workflow-shape)
- [Common failure modes](#common-failure-modes)
- [Sources](#sources)

## Reference templates

Use these checked-in templates instead of reconstructing workflow YAML from scratch.
Replace any explicit `replace-with-*` placeholders before using them in a repo:

- [github-actions-ci.yml](./github-actions-ci.yml) — baseline CI workflow
- [github-actions-release.yml](./github-actions-release.yml) — tag-triggered release workflow
- [goreleaser.yml](./goreleaser.yml) — baseline GoReleaser config

## Recommended baseline

### CI workflow

Use a CI workflow on `push` and `pull_request` for the main development branch. Start from [github-actions-ci.yml](./github-actions-ci.yml).

Prefer this verification order:

1. `go mod tidy -diff`
2. `go build ./...`
3. `go vet ./...`
4. `go test -race ./...`
5. lint

Why this order:
- fail fast on module hygiene and compile errors
- run `go vet` as a required static check, not an optional extra
- use `-race` in CI for code that can run under the race detector
- keep lint pinned and reproducible

### Linting

Pin the linter version explicitly.

For most Go tools, prefer `tool` directives in `go.mod`.
For `golangci-lint`, make a deliberate exception when appropriate: the upstream project documents binary/action installation as the recommended path and warns that `go install` / `tool` directive installs are not guaranteed.

In GitHub Actions, the safest default is the official `golangci-lint-action` with an explicit version.
For local development, either:
- document a pinned binary install path, or
- vendor the binary in a bootstrap workflow,
- but do not leave the version implicit.

## Release workflow

### Trigger releases from tags

Use a dedicated release workflow triggered by version tags such as:

```yaml
on:
  push:
    tags:
      - "v*"
```

Do not trigger production release artifacts from arbitrary branch pushes.
Treat the Git tag as the release boundary.

### Verify before releasing

Run the same verification steps in the release workflow before publishing artifacts.
A release pipeline that skips CI checks is broken by design.

### Use GoReleaser for binary releases

Prefer GoReleaser for multi-platform Go binary release automation. Start from [github-actions-release.yml](./github-actions-release.yml) and [goreleaser.yml](./goreleaser.yml).
Typical baseline:
- checked-in `.goreleaser.yml`
- `goreleaser/goreleaser-action`
- `goreleaser release --clean`
- generated archives + `checksums.txt`
- GitHub Releases as the default publish target

Typical release job requirements:
- `permissions.contents: write`
- full git history when changelog or tag resolution needs it (`fetch-depth: 0`)
- Go toolchain configured from `go.mod`

If signing, SBOM, or provenance is added later, expand permissions intentionally instead of defaulting to broad write scopes.

## Version metadata strategy

Choose one of these explicitly:

### Option A — explicit app version variable

Use GoReleaser `ldflags` when the program exposes `--version` or prints a semantic version string directly.

Example:

```yaml
ldflags:
  - -s -w -X main.version={{.Version}}
```

Use this when the binary has a user-facing version command and the code expects a dedicated variable.

This is not optional ceremony. If the release artifact name says `v1.2.3` but the binary prints `dev`, the release pipeline is lying.

### Option B — Go build VCS metadata

Go 1.24+ embeds main-module VCS version information in builds automatically.
Use this when the program can read build info via `runtime/debug` and does not need a custom linker-injected variable.

Use `-buildvcs=false` only when there is a specific reason to suppress that metadata.

### Practical rule

If the CLI has a real `--version` command, require explicit `ldflags` wiring and verify the produced release binary reports the tag version.
If it does not, do not pretend release versioning is solved just because artifacts are tagged.
Add the command or document that only build metadata is embedded.

Do not ship a tag-based GitHub Release until runtime version output matches the tag.

## Pre-tag release checklist

Before creating a release tag:

1. confirm CI is green on the target commit
2. confirm `.goreleaser.yml` matches the repo's version strategy
3. if the CLI exposes `--version`, ensure GoReleaser injects the version via `ldflags`
4. build a release-equivalent binary locally or in CI and check that `--version` reports the expected tag value
5. only then create and push the annotated tag

Minimum expectation for CLIs with `--version`:

- archive/file name version matches the tag
- GitHub Release tag matches the tag
- runtime `--version` output matches the tag

If any one of those disagrees, the release process is incomplete.

## Minimal workflow shape

### CI

See [github-actions-ci.yml](./github-actions-ci.yml).

Use:
- `actions/checkout`
- `actions/setup-go` with `go-version-file: go.mod`
- pinned linter action/version

### Release

See [github-actions-release.yml](./github-actions-release.yml).

Use:
- `actions/checkout` with `fetch-depth: 0`
- `actions/setup-go`
- `goreleaser/goreleaser-action`

## Common failure modes

- adding a release workflow without a checked-in `.goreleaser.yml`
- releasing on branch push instead of annotated version tags
- omitting `go mod tidy -diff` from CI, which lets module drift accumulate
- treating `go vet` as optional
- leaving linter version unpinned
- publishing artifacts without checksums
- claiming versioned releases while the binary cannot report its version
- publishing binaries whose `--version` output says `dev` even though the release tag is versioned
- copying a reference GoReleaser template without replacing placeholder project/binary names
- assuming artifact filenames alone prove runtime version metadata is correct
- granting excessive workflow permissions without a concrete need

## Sources

- GitHub Actions workflow syntax: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- GitHub Actions events: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- GoReleaser GitHub Actions docs: https://goreleaser.com/customization/ci/actions/
- Go 1.24 release notes (`tool` directives and build VCS metadata): https://go.dev/doc/go1.24
- golangci-lint install guidance: https://golangci-lint.run/docs/welcome/install/local/
