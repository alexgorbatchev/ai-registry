# Go Project Setup & Environment Reference

This reference provides the binding project-level rules plus setup instructions, boilerplate templates, and configuration guidance for initializing new Go projects according to repository baseline standards. Read it when starting, restructuring, building, or releasing a project. Day-to-day coding rules live in `SKILL.md`.

## Table of Contents

- [0. Binding Project Rules](#0-binding-project-rules)
- [1. Initializing a New Go Project](#1-initializing-a-new-go-project)
- [2. Recommended Directory Structure](#2-recommended-directory-structure)
- [3. Justfile Automation Template](#3-justfile-automation-template)
- [4. Cobra CLI Setup, Tree Help & Version Flag](#4-cobra-cli-setup-tree-help--version-flag)
- [5. XDG Base Directory Compliance](#5-xdg-base-directory-compliance)
- [6. GitIgnore Baseline](#6-gitignore-baseline)

---

## 0. Binding Project Rules

These are non-negotiable and apply to every Go project. The rest of this file shows how to satisfy them.

- **Project Scaffolding & Setup (`go-scaffold`)**: To provision a new Go CLI or library, use `go-scaffold` (available in `$PATH`). The sections below cover manual setup, `justfile` task automation templates, Cobra initialization, XDG directory helpers, and the `.gitignore` baseline.
- **Latest Go Version**: Always use the latest version of Go (currently at least Go 1.26+). Declare `go 1.26` or higher in `go.mod`.
- **Binary Output Location (`bin/`)**: Compiled binaries must always be placed into the project-local `bin/` directory using the project's actual application name (e.g., `go build -o bin/<app-name> ./cmd/<app-name>`). Never output binaries into root or source directories, and never output literally as `bin/app` (replace `<app-name>` with the project binary name). Always git-ignore `bin/`.
- **Never Commit Compiled Binaries**: Compiled Go binaries (executables, `.exe` files, shared libraries, etc.) are platform-specific, huge, and must never be committed to git repositories. Distribute compiled assets solely through CI/CD pipelines, package registries, or release platforms.
- **Task Automation (`just` & `justfile`)**: Use `just` for task automation, builds, tests, and project recipes via a `justfile` (e.g., `just build`, `just test`, `just lint`). Avoid raw uncoordinated shell scripts or legacy makefiles.
- **CLI Framework & Argument Parsing (Cobra & cobra-help-tree)**: For CLI applications, always use Cobra (`github.com/spf13/cobra`) for CLI command structure, flags, and argument parsing. Do not use the standard library `flag` package or write custom argument parsers. For help screen output, always use `github.com/alexgorbatchev/cobra-help-tree` (`cobrahelptree.Setup(rootCmd)`) to display aligned hierarchical tree-view help screens across all command levels.
- **Version Flag Output (`--version`)**: `--version` must return ONLY the raw version string (e.g., `1.2.3` or `v1.2.3`), followed by a newline. Do not include application names, banners, labels, or extra formatting (e.g., NOT `app version 1.2.3` or `Version: 1.2.3`). Clean version output is strictly required for automated scripting, tooling, and CI/CD validation.
- **XDG Base Directory Specification**: Applications must strictly follow XDG Base Directory conventions (`$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_CACHE_HOME`, `$XDG_STATE_HOME`) for user configuration, data, cache, and state directories unless otherwise explicitly specified by requirements or CLI flags. Leverage standard APIs like `os.UserCacheDir()` or `os.UserConfigDir()` with appropriate fallbacks.
- **Build/Dev Tools as Module Tools**: For CLI tooling used by the repo (linters, generators, etc.), use `tool` directives in `go.mod` (Go 1.24+) rather than `tools.go` blank-import stubs. This keeps tool dependencies explicit and enables `go get -tool`, `go install tool`, and `go tool`.

Verify before shipping a project change:

- [ ] New Go CLI or library project is provisioned using `go-scaffold`
- [ ] Go version is latest (at least Go 1.26+) declared in `go.mod`
- [ ] Binaries are built strictly into `bin/`, and `bin/` is git-ignored with no compiled binaries committed
- [ ] Task automation uses `just` with a `justfile` (`just build`, `just test`, etc.)
- [ ] CLI tools use Cobra with `github.com/alexgorbatchev/cobra-help-tree` for flags, subcommands, argument parsing, and tree help screens
- [ ] `--version` returns ONLY the version string (no app name, prefix, or extra text)
- [ ] User paths follow XDG Base Directory conventions unless explicitly specified otherwise
- [ ] Module tool dependencies use `tool` directives (not `tools.go` blank imports)

---

## 1. Initializing a New Go Project

To provision a new Go CLI or library project, use `go-scaffold` (available in `$PATH`).

For manual setup or customization, always target the latest stable Go toolchain (Go 1.26+).

```bash
# Create project directory
mkdir my-app && cd my-app

# Initialize module
go mod init github.com/owner/my-app
```

Ensure `go.mod` declares Go 1.26 or higher:

```go
module github.com/owner/my-app

go 1.26
```

---

## 2. Recommended Directory Structure

Organize projects by domain responsibility, keeping binaries in `bin/` and main entrypoints in `cmd/` (replace `<app-name>` with the actual application/binary name):

```
<app-name>/
├── bin/                   # Git-ignored binary output directory
│   └── .gitkeep
├── cmd/
│   └── <app-name>/
│       └── main.go        # Main executable entrypoint
├── internal/              # Private application/domain code
│   ├── config/            # XDG configuration loading
│   └── runner/            # Core business logic
├── .gitignore
├── go.mod
├── go.sum
└── justfile               # Task runner automation recipes
```

Inside `internal/`, group packages by the domain concept they own, never by technical layer:

```
// GOOD — domain-oriented
project/
  order/
    order.go
    service.go
    store.go
  product/
    product.go
    service.go

// BAD — layer-oriented
project/
  models/
    order.go
    product.go
  services/
    order.go
    product.go
  repositories/
    order.go
    product.go
```

---

## 3. Justfile Automation Template

Use `just` for task automation instead of makefiles or uncoordinated shell scripts:

```just
# Default recipe: list available tasks
default:
    @just --list

# Build compiled binary strictly into bin/ (replace <app-name> with the actual binary name)
build:
    @mkdir -p bin
    go build -o bin/<app-name> ./cmd/<app-name>

# Run all unit tests with race detector
test:
    go test -race ./...

# Check module hygiene and run vet + linter
lint:
    go mod tidy -diff
    go vet ./...
    golangci-lint run

# Clean build artifacts
clean:
    rm -rf bin/
```

---

## 4. Cobra CLI Setup, Tree Help & Version Flag

When building CLI applications, use Cobra (`github.com/spf13/cobra`) for flag and argument parsing, and `github.com/alexgorbatchev/cobra-help-tree` for hierarchical tree help formatting.

### 4.1 Installing Cobra & cobra-help-tree

```bash
go get github.com/spf13/cobra@latest
go get github.com/alexgorbatchev/cobra-help-tree@latest
```

### 4.2 Main Command Setup

```go
package main

import (
	"fmt"
	"os"

	cobrahelptree "github.com/alexgorbatchev/cobra-help-tree"
	"github.com/spf13/cobra"
)

// Injected during build via -ldflags "-X main.version=1.2.3"
var version = "dev"

func main() {
	rootCmd := &cobra.Command{
		Use:   "<app-name>",
		Short: "<app-name> description",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Root command execution
			return nil
		},
	}

	// Set version explicitly so --version prints ONLY the raw version string followed by a newline
	rootCmd.Version = version
	rootCmd.SetVersionTemplate("{{.Version}}\n")

	// Enable hierarchical tree help screens across all command levels
	cobrahelptree.Setup(rootCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
```

### 4.3 Version Flag Output Contract

The `--version` flag MUST return ONLY the version string followed by a newline:

```bash
$ ./bin/<app-name> --version
1.2.3
```

**Prohibited formats:**
- `<app-name> version 1.2.3` (DO NOT include application name)
- `Version: 1.2.3` (DO NOT include label prefixes)
- Banner graphics, titles, or build timestamps unless requested via a separate subcommand (e.g. `<app-name> version --verbose`)

---

## 5. XDG Base Directory Compliance

User files must conform to the XDG Base Directory specification unless overridden by CLI flags or environment variables:

- **Config (`$XDG_CONFIG_HOME`)**: Default `~/.config/my-app/config.json`
- **Data (`$XDG_DATA_HOME`)**: Default `~/.local/share/my-app/`
- **Cache (`$XDG_CACHE_HOME`)**: Default `~/.cache/my-app/`
- **State (`$XDG_STATE_HOME`)**: Default `~/.local/state/my-app/`

### Go Standard Library Helpers

Use Go's built-in OS functions for cross-platform resolution with XDG fallbacks:

```go
package config

import (
	"os"
	"path/filepath"
)

func GetConfigDir(appName string) (string, error) {
	if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
		return filepath.Join(xdgConfig, appName), nil
	}
	baseDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(baseDir, appName), nil
}

func GetCacheDir(appName string) (string, error) {
	if xdgCache := os.Getenv("XDG_CACHE_HOME"); xdgCache != "" {
		return filepath.Join(xdgCache, appName), nil
	}
	baseDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(baseDir, appName), nil
}
```

---

## 6. GitIgnore Baseline

Always exclude compiled binaries and temporary build files from version control:

```gitignore
# Compiled binaries
/bin/

# Test binaries and coverage profiles
*.test
*.out
*.prof

# IDE and OS files
.DS_Store
.idea/
.vscode/
```
