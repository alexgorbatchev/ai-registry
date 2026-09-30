# CLI README Variant

Read `readme.md` first. This file covers only what differs for a CLI tool or terminal program. Copy-pasteable template: `../assets/readme-cli-template.md`.

---

## Formatting

`# How It Works`, `# How it Really Works`, and `# Setup` are formatted strictly as `-` bulleted lists.

---

## `# How it Really Works` For A CLI

Cover what the user can observe from a terminal: where the tool reads and writes files (config, cache, state, output), which external services or binaries it invokes and with what, what a run costs, what it skips on a repeat run, what goes to stdout versus stderr, and which exit codes mean what. Dual-mode output (`AGENT=1`) belongs here when the tool supports it.

---

## `# Setup`

For published CLI tools, omit `# Prerequisites`. Place `# Installation` first, followed by optional `# Setup`, then `# Quick Start`.

In `# Setup`, list only requirements for running the published artifact — credentials, accounts, external binaries, or runtimes actually required by that artifact. Link each requirement and explain which operation needs it and how to configure it. Omit this section when no runtime setup is required.

Do not list compilers, SDKs, task runners, or test tooling merely because the source project uses them. Put development prerequisites in `AGENTS.md` or contributor docs alongside build-from-source instructions; do not put them before or inside the README's installation or setup sections. Do not infer runtime requirements from the project's implementation language. Never list the `gh` CLI as an installation prerequisite.

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
