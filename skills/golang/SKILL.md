---
name: golang
description: >-
  Apply Go coding rules, design principles, and project conventions for
  maintainable Go code and repositories. Use when writing, reviewing, refactoring,
  or releasing Go code, or when working on Go-specific project structure, APIs,
  tests, CI, or binaries. Do not use for non-Go codebases or for language-agnostic
  tasks that do not depend on Go conventions.
---

# Go Baseline Skill

This skill defines the non-negotiable idioms and design principles for writing Go code. Every piece of Go code produced must conform to these rules. When in doubt, bias toward simplicity, clarity, and what the Go standard library itself would do.

## References

- `references/github-ci-cd-releases.md` — GitHub Actions CI, tagged releases, GoReleaser config, or binary version metadata. 

---

## 1. Naming

Go naming communicates scope and intent through brevity. Names earn their length.

### 1.1 Variable Length Tracks Usage Distance

The farther a variable is from its declaration, the more descriptive its name should be. The closer it is, the shorter.

```go
// GOOD — single-letter in tight scope
for i, v := range items {
    process(v)
}

// GOOD — short name, used within a few lines
resp, err := http.Get(url)
if err != nil {
    return err
}
defer resp.Body.Close()

// GOOD — descriptive name, lives across many lines or is a struct field
type Worker struct {
    MaxRetryAttempts int
    ShutdownTimeout  time.Duration
}
```

```go
// BAD — unnecessarily verbose in tight scope
for index, value := range items {
    process(value)
}

// BAD — cryptic name that persists across a wide scope
t := time.Hour * 24 * 7
// ... 40 lines later ...
if elapsed > t { // what is t?
```

### 1.2 Receiver Names

Single-letter or two-letter abbreviation of the type. Never `self` or `this`. Consistent across all methods on the type.

```go
func (s *Server) Start() error { ... }
func (s *Server) Stop() error { ... }

// NOT: func (server *Server) Start()
// NOT: func (self *Server) Start()
```

### 1.3 Interfaces

Name interfaces by what they do, not what implements them. Single-method interfaces use the method name plus `-er`.

```go
type Reader interface { Read(p []byte) (n int, err error) }
type Validator interface { Validate() error }

// NOT: type IReader interface { ... }
// NOT: type ReaderInterface interface { ... }
```

### 1.4 Package Names

Short, lowercase, single-word. The package name is part of the call site — don't stutter.

```go
// GOOD
package http    // http.Client
package user    // user.Create(...)

// BAD
package httputil     // httputil.HTTPClient — stutter
package users        // no plurals
package userService  // no camelCase
```

### 1.5 Exported vs Unexported

Export only what other packages need. Start unexported; promote to exported when a real consumer requires it. An unexported API surface is easier to change.

### 1.6 Acronyms

Acronyms are all-caps or all-lower depending on export status. Never mixed.

```go
HTTPClient  // exported
httpClient  // unexported
xmlParser   // unexported
XMLParser   // exported

// NOT: HttpClient, XmlParser
```

---

## 2. DRY — Strict Adherence

Do not repeat yourself. But do not abstract prematurely either. The rule: **duplicate once, refactor on the second duplication**.

### 2.1 Extract, Don't Copy

If you find yourself writing the same 3+ lines in two places, extract a function immediately on the second occurrence. Name it for what it does.

```go
// GOOD — shared logic extracted
func parseID(s string) (int64, error) {
    id, err := strconv.ParseInt(s, 10, 64)
    if err != nil {
        return 0, fmt.Errorf("invalid id %q: %w", s, err)
    }
    return id, nil
}
```

### 2.2 Constants Over Magic Values

Every literal that appears more than once (or carries domain meaning even once) gets a named constant or variable.

```go
const maxRetries = 3
const defaultTimeout = 30 * time.Second

// NOT: if attempts > 3 {
// NOT: ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
```

### 2.3 Table-Driven Tests Over Repeated Test Functions

Never write N test functions that vary only by input/output. Use table-driven tests.

```go
func TestParseID(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    int64
        wantErr bool
    }{
        {"valid", "42", 42, false},
        {"negative", "-1", -1, false},
        {"empty", "", 0, true},
        {"letters", "abc", 0, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := parseID(tt.input)
            if (err != nil) != tt.wantErr {
                t.Fatalf("parseID(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
            }
            if got != tt.want {
                t.Fatalf("parseID(%q) = %d, want %d", tt.input, got, tt.want)
            }
        })
    }
}
```

### 2.4 Shared Test Helpers

Repeated test setup goes into `testdata/` files or unexported helper functions in `_test.go` files. Mark helpers with `t.Helper()`.

```go
func newTestServer(t *testing.T) *Server {
    t.Helper()
    s, err := NewServer(Config{Addr: "localhost:0"})
    if err != nil {
        t.Fatal(err)
    }
    t.Cleanup(func() { s.Stop() })
    return s
}
```

---

## 3. Interfaces — Must Have a Real Purpose

Interfaces in Go are powerful because they're implicit. That power is squandered when they exist only to satisfy a test double. An interface must have a **concrete, production reason** to exist.

### 3.1 When to Define an Interface

Define an interface when:

- **Two or more real types** already satisfy it in production code.
- **The consumer genuinely does not care** which implementation it gets (e.g., `io.Reader` — files, buffers, network connections all qualify).
- **A package boundary requires decoupling** — the consuming package should not import the providing package.

### 3.2 When NOT to Define an Interface

Do not define an interface when:

- **Only one production implementation exists** and the interface is being created solely so tests can swap in a mock. Test the real thing. Use a real database, a real HTTP server (`httptest.NewServer`), a real filesystem (`t.TempDir()`).
- **The interface mirrors the concrete type 1:1.** If the interface has the same methods as the only struct that implements it, delete the interface and use the struct.
- **You're planning for a future that may never come.** YAGNI. Add the interface when the second implementation actually appears.

### 3.3 Accept Interfaces, Return Structs

Functions should accept the narrowest interface they need and return concrete types. This maximizes flexibility for callers without hiding what's actually being returned.

```go
// GOOD — accepts narrow interface, returns concrete
func ProcessData(r io.Reader) (*Result, error) { ... }

// BAD — returns interface hiding the concrete type
func NewService() ServiceInterface { ... }
```

### 3.4 Define Interfaces at the Consumer, Not the Provider

The package that *uses* the behavior defines the interface. The package that *provides* the behavior just exports a struct with methods.

```go
// package orders — this is the consumer
type PaymentCharger interface {
    Charge(ctx context.Context, amount int) error
}

func (s *Service) Checkout(ctx context.Context, c PaymentCharger) error { ... }

// package stripe — this is the provider, no interface here
type Client struct { ... }
func (c *Client) Charge(ctx context.Context, amount int) error { ... }
```

### 3.5 Testing Without Interface Bloat

Preferred alternatives to mock-driven interfaces:

| Technique                        | When to use                                  |
|----------------------------------|----------------------------------------------|
| `httptest.NewServer`             | Testing HTTP clients                         |
| `t.TempDir()`                    | Testing file operations                      |
| In-memory SQLite / testcontainers | Testing database interactions               |
| Real struct with test config     | Anything with a configurable dependency      |
| Fakes (small, real implementations) | When a lightweight alternative exists     |

---

## 4. Error Handling

### 4.1 Always Handle Errors

Never discard errors with `_`. If you truly do not care, document why with a comment.

```go
// GOOD
if err := f.Close(); err != nil {
    log.Printf("closing file: %v", err)
}

// ACCEPTABLE — with reason
_ = f.Close() // best-effort cleanup, error already returned above
```

### 4.2 Wrap With Context

Use `fmt.Errorf` with `%w` to add context while preserving the error chain. The message should read as a call stack: what was being attempted.

```go
if err != nil {
    return fmt.Errorf("fetching user %d: %w", id, err)
}
```

### 4.3 Sentinel Errors and Custom Types

Define sentinel errors (`var ErrNotFound = errors.New(...)`) when callers need to branch on the error kind. Use custom error types when callers need structured data from the error. Otherwise, a simple wrapped string is fine.

### 4.4 Don't Panic

`panic` is for truly unrecoverable programmer errors (e.g., invalid regexp in `init`). Never panic on bad user input, network failure, or any runtime condition that can be handled.

---

## 5. Package Design and Structure

### 5.1 Organize by Responsibility, Not by Layer

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

### 5.2 Avoid Package `util`, `common`, `helpers`

If you can't name the package by what it does, the code probably belongs somewhere else. Move functions to the package that uses them, or name the package for the domain concept it owns.

### 5.3 Internal Packages

Use `internal/` to prevent external import of implementation details. Anything not meant for outside consumption goes in `internal/`.

### 5.4 Minimal Package API Surface

A package should export the minimum needed. Start every type, function, and constant as unexported. Promote to exported only when an external package has a demonstrated need.

---

## 6. Concurrency

### 6.1 Start Goroutines With Clear Ownership

Every goroutine must have a clear owner responsible for its lifecycle. The owner must ensure the goroutine exits cleanly.

```go
func (s *Server) Start() {
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        s.listen()
    }()
}

func (s *Server) Stop() {
    close(s.quit)
    s.wg.Wait()
}
```

### 6.2 Prefer `context.Context` for Cancellation

Pass `ctx` as the first parameter. Respect cancellation. Don't store contexts in structs.

### 6.3 Protect Shared State

If data is shared across goroutines, protect it. Prefer channels for communication and `sync.Mutex` for simple state protection. Don't mix both for the same data.

### 6.4 Never Leak Goroutines

Every goroutine launched must have a shutdown path. Use `context.Context`, a `done` channel, or `sync.WaitGroup` to track and join goroutines on shutdown.

### 6.5 Be Deliberate With `GOMAXPROCS`

Go 1.25+ adjusts default `GOMAXPROCS` more intelligently (including container CPU limits on Linux and periodic updates when limits change). Do not hardcode `GOMAXPROCS` unless profiling shows a clear benefit for your workload.

---

## 7. Code Clarity and Intent

### 7.1 Write Obvious Code

If a reader has to pause and think about what a block of code does, it needs to be clearer. Techniques:

- **Extract a well-named function** rather than adding a comment to explain a block.
- **Avoid clever one-liners.** Two clear lines beat one clever line.
- **Use early returns** to eliminate nesting and make the happy path obvious.

```go
// GOOD — early return, flat structure
func (s *Service) Process(ctx context.Context, id int64) error {
    u, err := s.store.Get(ctx, id)
    if err != nil {
        return fmt.Errorf("getting user: %w", err)
    }
    if !u.Active {
        return ErrInactive
    }
    return s.notify(ctx, u)
}

// BAD — nested, harder to follow
func (s *Service) Process(ctx context.Context, id int64) error {
    u, err := s.store.Get(ctx, id)
    if err == nil {
        if u.Active {
            return s.notify(ctx, u)
        } else {
            return ErrInactive
        }
    } else {
        return fmt.Errorf("getting user: %w", err)
    }
}
```

### 7.2 Comments Explain Why, Not What

The code shows *what* is happening. Comments explain *why* — business rules, non-obvious constraints, workarounds.

```go
// GOOD
// Retry on 503 because the upstream gateway occasionally returns
// transient errors during deployment rollouts.
if resp.StatusCode == http.StatusServiceUnavailable {

// BAD
// Check if status code is 503
if resp.StatusCode == http.StatusServiceUnavailable {
```

### 7.3 Function Size

If a function exceeds ~40 lines, look for extraction opportunities. This isn't a hard rule — some functions (table-driven tests, switch statements) are naturally longer. The test is readability, not line count.

### 7.4 Parameter Count

More than 3-4 parameters usually means you want an options struct or a rethink of the function's responsibility.

```go
// GOOD
type ServerConfig struct {
    Addr            string
    ReadTimeout     time.Duration
    WriteTimeout    time.Duration
    MaxConns        int
    TLSConfig       *tls.Config
}

func NewServer(cfg ServerConfig) (*Server, error) { ... }

// BAD
func NewServer(addr string, readTimeout, writeTimeout time.Duration, maxConns int, tlsCfg *tls.Config) (*Server, error) { ... }
```

### 7.5 Zero Values Are Useful

Design structs so their zero value is valid and useful. This reduces constructor boilerplate and makes the API easier to use.

```go
// GOOD — zero value works
var buf bytes.Buffer
buf.WriteString("hello")

// The same principle applied to your own types
type Limiter struct {
    rate  int // 0 means unlimited
    burst int // 0 means default burst
}
```

### 7.6 Prefer Newer Readable Idioms When They Clarify Intent

Use post-1.22 language features when they make code clearer, not because they are new:

- `for range` over iterator functions (Go 1.23+) can remove custom iterator boilerplate.
- `new(expr)` (Go 1.26+) is a concise way to produce pointers to computed values in literals.

Keep the same readability bar: if the newer form is less obvious to your team, use the simpler form.

---

## 8. Standard Library First

Reach for the standard library before any third-party dependency. Go's stdlib is unusually rich. Common traps:

| Don't pull in...         | When stdlib has...                           |
|--------------------------|----------------------------------------------|
| gorilla/mux              | `net/http.ServeMux` (1.22+ has patterns)     |
| logrus/zap (maybe)       | `log/slog` (1.21+)                           |
| testify                  | `testing` + table-driven tests               |
| uuid libraries           | `crypto/rand` + simple formatting             |
| config libraries         | `os.Getenv` + a small struct                  |

### 8.1 Manage Build/Dev Tools as Module Tools

For CLI tooling used by the repo (linters, generators, etc.), prefer `tool` directives in `go.mod` (Go 1.24+) over `tools.go` blank-import stubs.

This keeps tool dependencies explicit and lets you use native workflows like `go get -tool`, `go install tool`, and `go tool`.

Add a dependency only when it provides clear, substantial value that the stdlib cannot match with reasonable effort.


---

## 9. Quick Reference Checklist

Before producing any Go code, verify:

- [ ] Variable names match scope distance — short for tight, descriptive for wide
- [ ] No duplicated logic blocks — extract on second occurrence
- [ ] Every interface has 2+ production implementations or genuine decoupling need
- [ ] Errors are wrapped with context using `%w`
- [ ] No panics on runtime conditions
- [ ] Goroutines have clear ownership and shutdown paths
- [ ] Packages named for responsibility, not layer
- [ ] Exported API is minimal — only what external consumers need
- [ ] Standard library used unless a dependency provides substantial value
- [ ] Module tool dependencies use `tool` directives (not `tools.go` blank imports)
- [ ] Comments explain why, code explains what
- [ ] Zero values are useful
- [ ] Tests are table-driven where applicable
- [ ] `go mod tidy -diff` is clean for module hygiene checks
- [ ] `go vet` is clean (including modern analyzers such as `stdversion`, `tests`, `waitgroup`, and `hostport`)
- [ ] `go fix` has been considered when upgrading/migrating older idioms

---

## 10. Post-Cutoff Go Release Updates (Go 1.23+)

Only include these when relevant. This section intentionally tracks features released after the model training cutoff.

### Go 1.23 (Aug 2024)

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

### Go 1.24 (Feb 2025)

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

### Go 1.25 (Aug 2025)

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

### Go 1.26 (Feb 2026)

- **Language**
  - Built-in `new` now accepts expressions, allowing inline initialization (for example `new(yearsSince(born))`).
  - Generic types may now self-reference in type parameter constraints (for example `type Adder[A Adder[A]] interface { ... }`).
- **Tooling**
  - `go fix` was rewritten as the modernizer hub (analyzer-based fixers + `//go:fix inline` support).
  - `go mod init` now defaults new modules to an older, broadly compatible `go` version line.
  - `cmd/doc` and `go tool doc` were removed; `go doc` is the replacement.
  - `pprof -http` now defaults to flame graph view.
