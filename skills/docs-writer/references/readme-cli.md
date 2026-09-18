# CLI README Variant

Read `readme.md` first. This file covers only what differs for a CLI tool or terminal program. Copy-pasteable template: `../assets/readme-cli-template.md`.

---

## Formatting

`# How It Works`, `# How it Really Works`, and `# Prerequisites` are formatted strictly as `-` bulleted lists.

---

## `# How it Really Works` For A CLI

Cover what the user can observe from a terminal: where the tool reads and writes files (config, cache, state, output), which external services or binaries it invokes and with what, what a run costs, what it skips on a repeat run, what goes to stdout versus stderr, and which exit codes mean what. Dual-mode output (`AGENT=1`) belongs here when the tool supports it.

---

## `# Prerequisites`

Bulleted list of external runtime requirements — system binaries, API tokens, minimum runtimes — each linked, each with the reason it is needed and what degrades without it. Never list the `gh` CLI as an installation prerequisite.

---

## `# Installation` — GitHub Releases Only

- Document downloading a prebuilt binary from GitHub Releases.
- Write one sentence directing the user to the latest release page for their platform, followed by a single macOS `curl` / `tar` example.
- Release archive names always include the version, e.g. `mytool_X.X.X_darwin_arm64.tar.gz`.
- Never use `gh release download` or any `gh` CLI command in installation instructions.
- Never instruct end users to clone the repository and run `cargo build`, `go build`, `bun build`, `make`, or any other build command.

---

## `# Quick Start`

Minimal, copy-pasteable shell invocations for the most common tasks, in the order a new user would hit them. Include a realistic `Sample Output:` block for at least the primary command, matching the tool's real formatting.

---

## `# Options & Flags`

A markdown table in exactly this column format:

```markdown
| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--config <path>` | `-c` | `~/.config/mytool.json` | Path to custom configuration file |
```

Document global flags first. When subcommands take their own flags, give each subcommand its own table under a `` `mytool <subcommand>` `` label. Defaults must match the source, not the help text's prose.
