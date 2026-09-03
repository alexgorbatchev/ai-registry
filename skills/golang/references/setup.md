# Go Project Setup & Environment Reference

This reference provides setup instructions, boilerplate templates, and configuration guidance for initializing new Go projects according to repository baseline standards.

## Table of Contents

- [1. Initializing a New Go Project](#1-initializing-a-new-go-project)
- [2. Recommended Directory Structure](#2-recommended-directory-structure)
- [3. Justfile Automation Template](#3-justfile-automation-template)
- [4. Cobra CLI Setup, Tree Help & Version Flag](#4-cobra-cli-setup-tree-help--version-flag)
- [5. XDG Base Directory Compliance](#5-xdg-base-directory-compliance)
- [6. GitIgnore Baseline](#6-gitignore-baseline)

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
