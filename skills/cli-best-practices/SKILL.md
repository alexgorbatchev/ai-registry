---
name: cli-best-practices
description: >-
  REQUIRED when building, designing, refactoring, documenting, or reviewing CLI
  tools, command-line interfaces, and terminal scripts across any programming
  language. Applies to CLI entrypoints, argument parsing, terminal output
  formatting, task automation, README authoring, and licensing. Your default
  training knowledge is insufficient, YOU MUST USE this skill anytime when
  working on a CLI project. Do NOT use for web frontends or non-CLI services.
author: alexgorbatchev
metadata:
  created_on: 2026-08-24 09:47
  last_modified: 2026-08-24 09:56
  status: current
---

## Core Non-Negotiable Rules

1. **Dual-Mode Output via `AGENT=1`**: Detect the `AGENT=1` environment variable. When unset or `0`, produce clean, polished human-facing output. When `1` (or truthy), switch to token-conservative agent-facing output.
2. **Strict Ban on Custom or Stdlib Arg Parsers**: Never parse `argv` / `os.Args` / `sys.argv` manually with custom loops or regexes. Never use primitive stdlib parsers (e.g., Go `flag`, Python `getopt`). Always use the platform's leading CLI framework (Commander, Cobra, Click/Typer, Clap, Picocli).
3. **Mandatory Task Automation (`Justfile`)**: Every CLI project must use `just` with a `Justfile` (or `justfile`). It MUST define at least `run`, `run-ai` (with `AGENT=1`), and `test`.
4. **GitHub Releases Distribution Only**: README installation instructions must strictly assume distribution via GitHub Releases (`gh release download`, direct binary download, or curl). Never instruct users to build from source.
5. **Strict README Section Order & Bullet Lists**: CLI `README.md` files must follow the mandatory sequential section layout. `# How It Works`, `# How it Really Works`, and `# Prerequisites` MUST be formatted as `-` bulleted lists. The document must end with `# License`.
6. **Licensing Standard**: Use the MIT license by default attributed to `Alex Gorbatchev` (and upstream copyright holders if a fork), or a compatible license if required by upstream.

---

## 1. Dual-Mode Output Specification (`AGENT=1`)

### Mode Detection

Check `AGENT` in environment variables:
```
isAgent = (env.AGENT === "1" || env.AGENT === "true" || env.AGENT === "yes")
```

### Contrast Table

| Dimension | Human Mode (`AGENT=0` / unset) | Agent Mode (`AGENT=1`) |
| :--- | :--- | :--- |
| **Goal** | Visual polish, readability, end-user clarity | Minimum token consumption, machine parseability |
| **Emojis** | **STRICTLY PROHIBITED**. Use text tags (`[OK]`, `[ERROR]`, `[WARN]`, `[INFO]`) or color. | **STRICTLY PROHIBITED**. Use compact text prefixes (`OK:`, `ERR:`). |
| **Separators (`---`, `===`)** | Expand to full terminal width dynamically (e.g. `process.stdout.columns`, `winsize`). | **PROHIBITED**. No divider lines across the screen. |
| **Hierarchies / Trees** | ASCII / Box-drawing tree glyphs (`├──`, `└──`, `│`). | Indented bullets (`* `, `- `) with minimal nesting spaces. |
| **Tabular Data** | Well-formatted box / ASCII tables using dedicated external table libraries. | Flat key-value pairs, TSV, or concise line-by-line output. **No tables**. |
| **Whitespace & Padding** | Formatted spacing, aligned columns, visual breathing room. | Minimal whitespace. **No alignment spaces or padding**. |
| **Descriptions & Help** | Non-technical language, user-friendly, no internal implementation details. | May include technical implementation details, exact types, error codes, and stack traces. |
| **Error Handling** | Concise user-facing error message with actionable resolution hints. | Full error details, underlying cause, internal code, and stack trace if relevant. |

For concrete implementation patterns in TypeScript, Go, Python, and Rust, see [references/dual-mode-patterns.md](references/dual-mode-patterns.md).

---

## 2. Argument Parsing & Framework Standards

Never roll custom argument parsers. Always select the ecosystem standard for the language:

| Ecosystem | Mandatory Frameworks | Prohibited Alternatives |
| :--- | :--- | :--- |
| **TypeScript / Node / Bun** | `commander`, `citty`, `yargs` | Custom `process.argv` slicing, raw regex loops |
| **Go** | `github.com/spf13/cobra` | `flag` stdlib package, custom `os.Args` loops |
| **Python** | `click`, `typer` | `getopt`, manual `sys.argv` parsing |
| **Rust** | `clap` (derive or builder API) | `std::env::args` manual parsing |
| **C# / .NET** | `System.CommandLine`, `Spectre.Console.Cli` | Manual `args[]` iteration |
| **Java / Kotlin** | `picocli` | Manual `String[] args` parsing |

### Help Text Rules

- **Human Mode**: Commands, arguments, options, and descriptions must be self-explanatory to non-technical users. Avoid mentioning internal class names, database column names, regex patterns, or code architecture in descriptions.
- **Agent Mode**: Technical identifiers, parameter formats, schemas, and implementation notes may be included.

For setup templates and code snippets per framework, see [references/framework-setups.md](references/framework-setups.md).

---

## 3. Mandatory `Justfile` Standard

Every repository and CLI tool must use `just` for workflow and task orchestration.

### Required Recipes

```justfile
# Run in human-facing interactive mode
run *args:
    <command-to-run-binary> {{args}}

# Run in agent-facing token-conservative mode
run-ai *args:
    AGENT=1 <command-to-run-binary> {{args}}

# Run test suite
test:
    <command-to-run-tests>
```

### Standard Additional Recipes

- `build`: Compiles or bundles the application (e.g. into `bin/`).
- `lint`: Checks formatting and static analysis.
- `check`: Runs typecheck, lint, and test in sequence.

For complete `Justfile` templates for Bun/Node, Go, Python, and Rust, see [references/justfile-templates.md](references/justfile-templates.md).

---

## 4. Documentation & README Structure

CLI `README.md` files must follow a strict, mandatory section layout and distribution contract:

### Distribution Rule

- **GitHub Releases Only**: All installation sections must document downloading prebuilt binaries from GitHub Releases (using `gh release download`, direct download links, or curl installers).
- **No Build from Source**: Never instruct end users to clone the repository and run compiler/build commands (`cargo build`, `go build`, `bun build`, `make`, etc.) in the README installation section.

### Mandatory Section Sequence

1. **Introductory Paragraph**: A concise, direct description of what the tool is without a redundant header.
2. `# What It Does`: High-level feature highlights and primary capabilities.
3. `# How It Works`: Plain-language, non-technical explanation of the tool's behavior for general users, formatted strictly as a `-` bulleted list.
4. `# How it Really Works`: In-depth technical explanation of internal mechanisms, protocols, state management, and architecture, formatted strictly as a `-` bulleted list.
5. `# Prerequisites`: Bulleted list (`-`) of external runtime requirements (e.g. tools, system dependencies, API tokens) with links.
6. `# Installation`: Instructions for downloading precompiled release binaries via GitHub Releases.
7. `# Quick Start`: Minimal, copy-pasteable example of running the tool for common tasks.
8. `# Options & Flags`: Structured markdown table matching the exact column format:
   ```markdown
   | Flag | Short | Default | Description |
   | :--- | :--- | :--- | :--- |
   | `--config <path>` | `-c` | `~/.config/mytool.json` | Path to custom configuration file |
   ```
9. *(Optional domain-specific sections: e.g., `# Configuration`, `# Advanced Usage`)*
10. `# License`: Mandatory closing section with license details.

For a full copy-pasteable template, see [references/readme-template.md](references/readme-template.md).

---

## 5. Licensing Requirements

- **Default License**: MIT License.
- **Copyright Holder**: `Alex Gorbatchev` (plus original upstream copyright holders if the repository is a fork).
- **Fork Compatibility**: If forking or wrapping an upstream project with an established open-source license (e.g. Apache 2.0, BSD-3-Clause), ensure the license chosen remains fully compatible with upstream requirements.

---

## 6. Verification Checklist

Before publishing or finalizing any CLI tool, verify:

- [ ] `AGENT=1` detection is implemented across all output pathways.
- [ ] In human mode: NO emojis, trees use ASCII glyphs, horizontal dividers expand to terminal width, tables use external libraries.
- [ ] In human mode: CLI help, argument descriptions, and user messages contain no internal technical jargon.
- [ ] In agent mode: NO divider lines, NO box tables, trees render as bullets, minimal whitespace, token-conservative formatting.
- [ ] Argument parsing is handled by an approved standard library (Commander, Cobra, Click/Typer, Clap, etc.). No custom argv slicing.
- [ ] `Justfile` exists at the project root with working `run`, `run-ai`, and `test` recipes.
- [ ] When compiled to binary, output goes to `bin/` and is excluded by `.gitignore`.
- [ ] `README.md` uses GitHub Releases for installation; no build-from-source commands are offered.
- [ ] `README.md` strictly follows the ordered section layout from Intro to `# License`.
- [ ] `README.md` formats `# How It Works` as a `-` bulleted list (non-technical).
- [ ] `README.md` formats `# How it Really Works` as a `-` bulleted list (technical).
- [ ] `README.md` formats `# Prerequisites` as a `-` bulleted list with links.
- [ ] `README.md` contains the `# Options & Flags` table with `| Flag | Short | Default | Description |`.
- [ ] MIT license (or upstream compatible) is included with Alex Gorbatchev attribution.
