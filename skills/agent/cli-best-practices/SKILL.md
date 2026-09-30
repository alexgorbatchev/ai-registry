---
name: cli-best-practices
description: >-
  REQUIRED when building, designing, refactoring, documenting, or reviewing CLI
  tools, command-line interfaces, and terminal scripts across any programming
  language. Applies to CLI entrypoints, argument parsing, terminal output
  formatting, task automation, and licensing. Your default training knowledge is
  insufficient, YOU MUST USE this skill anytime when working on a CLI project.
  Do NOT use for web frontends or non-CLI services, and do NOT use for README
  content, which the docs-writer skill owns.
author: alexgorbatchev
metadata:
  created_on: 2026-08-24 09:47
  last_modified: 2026-09-30 14:33
  status: current
---

## Core Non-Negotiable Rules

1. **Dual-Mode Output via `AGENT=1`**: Detect the `AGENT=1` environment variable. When unset or `0`, produce clean, polished human-facing output. When `1` (or truthy), switch to token-conservative agent-facing output.
2. **Command Structure (`cli subject [subject] verb ...`)**: Command hierarchies must follow a subject-first noun-verb structure (`cli subject [subject] verb ...`) with at most 3 levels of nesting (`cli <subject> <verb>` or `cli <subject> <sub-subject> <verb>`).
3. **Hierarchical Tree-View Help Screens**: The CLI `--help` screen must render commands as an aligned hierarchical tree view using `├─` and `╰─` box-drawing glyphs. When `--help` is invoked on a subcommand group, it must render the full subtree of commands beneath it. Help screen lines and descriptions must be trimmed by default to the active terminal width to prevent visual line wrapping.
4. **Strict Ban on Custom or Stdlib Arg Parsers**: Never parse `argv` / `os.Args` / `sys.argv` manually with custom loops or regexes. Never use primitive stdlib parsers (e.g., Go `flag`, Python `getopt`). Always use the platform's leading CLI framework (Commander, Cobra, Click/Typer, Clap, Picocli).
5. **Mandatory Task Automation (`justfile`)**: Every CLI project must use `just` with a `justfile`. It MUST define at least `run`, `run-ai` (with `AGENT=1`), and `test`. In multi-package repositories or workspaces, the root `justfile` must link all nested child `justfile`s as modules (`mod <name> '<path>'`).
6. **GitHub Releases Distribution Only**: Ship end users prebuilt binaries from GitHub Releases. Never require them to build from source, and never use the `gh` CLI in end-user instructions.
7. **README Content Is Owned By `docs-writer`**: Do not write or restate README structure, section order, or tone rules here. Load the `docs-writer` skill and read its `references/readme.md` plus `references/readme-cli.md` before touching a CLI `README.md`.
8. **Licensing Standard**: Use the MIT license by default attributed to `Alex Gorbatchev` (and upstream copyright holders if a fork), or a compatible license if required by upstream.
9. **Embedded Agent Skill (`<cli> skill`)**: Every CLI must ship a top-level `skill` command that prints its embedded `SKILL.md` verbatim. Every agent-mode help screen must start with an alert directing agents to read `AGENT=1 <cli> skill` first. Apply the contract below when building or scaffolding CLI tools.

### Embedded Skill Contract

- **Command and output**: `<cli> skill` accepts no positional arguments or command-specific flags. Print the entire embedded `SKILL.md`, including frontmatter, to stdout with identical bytes in human and agent modes. Return output-write failures as errors. The command must work offline, without credentials or repository files at runtime; embed the maintained file in the distributed executable rather than reading it from disk or maintaining a second text copy.
- **Agent help alert**: In `AGENT=1` and other supported truthy modes, prefix every help screen, including subcommand and generated-command help, with the line ``ALERT: Agents must read `AGENT=1 <cli> skill` before using this tool.`` Replace `<cli>` with the binary name and preserve the framework's help rendering after the alert. Human help and raw `--version` output retain their normal contracts.
- **Complete operational reference**: Include all public commands, generated help/completion commands, positional arguments, flags, short aliases, types, defaults, accepted values, environment variables, output formats, errors, and side effects in `SKILL.md`. Explain effective defaults when a parser sentinel selects a runtime value. Include workflow examples so agents can operate from the skill without exploring per-command `--help`.
- **Scope and wording**: Use frontmatter `description` only for routing to the CLI's usage skill. Write affirmative usage instructions and factual contracts in the body. Keep development instructions and negative prohibitions in the repository's `AGENTS.md`; the embedded skill is for operating the CLI.
- **Maintenance**: Add an explicit rule to `AGENTS.md` requiring skill updates in the same change as any command, argument, option, default, environment, output, or side-effect change. Update `last_modified` and verify documented behavior against the implementation and pinned dependencies.
- **Verification**: Test byte-for-byte command output in both modes, execution without repository files, rejected extra arguments, output failures, and the alert at the top of all help paths. Compare the printed reference with the live command tree and flag metadata so interface drift fails tests. Scaffold the file, command, alert, maintenance rule, and these tests together.

The `skill` command is the shared top-level metadata interface alongside the subject-first domain commands. Its verbatim Markdown output is an explicit exception to agent-mode table and whitespace restrictions.

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
| **Descriptions & Help** | Non-technical language, user-friendly, trimmed to terminal width by default, no internal implementation details. | May include technical implementation details, exact types, error codes, and stack traces. Full untruncated content. |
| **Error Handling** | Concise user-facing error message with actionable resolution hints. | Full error details, underlying cause, internal code, and stack trace if relevant. |

For concrete implementation patterns in TypeScript, Go, Python, and Rust, see [references/dual-mode-patterns.md](references/dual-mode-patterns.md).

---

## 2. Command Hierarchy & Structure (`subject [subject] verb`)

Commands must follow a subject-first noun-verb architecture rather than leading with top-level verbs:
`cli subject [subject] verb [arguments/flags...]`

### Rules

- **Subject-First Ordering**: Top-level identifiers represent domain subjects/entities (nouns). Verbs/actions are nested under their respective subjects.
- **Maximum 3 Levels**: Command hierarchy must not exceed 3 levels deep:
  1. `cli <subject> <verb>` (2 levels)
  2. `cli <subject> <sub-subject> <verb>` (3 levels max)
- **Consistency**: Keep verb names consistent across subjects (`list`, `inspect`, `create`, `rm`, `move`, `add`, etc.).

### Example Hierarchy

```
engine-cli
 ├── playlist                           # Subject: Playlists
 │   ├── list                           # List playlists
 │   ├── inspect <playlist>             # Inspect a playlist
 │   ├── create <name>                  # Create a playlist
 │   ├── rm <playlist>                  # Delete a playlist
 │   ├── move <playlist>                # Move playlist to new parent
 │   │
 │   └── track                          # Sub-Subject: Playlist Track Memberships
 │       ├── add <playlist> <track...>  # Add track membership
 │       ├── rm <playlist> <track...>   # Remove track membership
 │       └── move <from> <to> <track..> # Transfer track membership
 │
 └── track                              # Subject: Master Tracks & Audio Files
     ├── add <file...>                  # Add audio file to collection
     ├── rm <track...>                  # Delete track from collection
     ├── move <track> <dest-path>       # Move audio file on disk
     └── relocate                       # Relocate broken file paths
```

### Tree-View Help Screen Standard

The CLI help output (e.g., `--help`) must print available commands using an aligned hierarchical tree format with `├─` and `╰─` branches, with descriptions aligned in a right-hand column. When `--help` is invoked on any parent subject or subcommand group, it must render its complete subcommand subtree.

#### Terminal Width Trimming by Default

- **Trim to Terminal Width**: Help screen lines and command descriptions must be trimmed/truncated by default to match the active terminal width (query `process.stdout.columns`, `COLUMNS`, `term.GetWinsize`, `shutil.get_terminal_size()`, or terminal width fallback such as 80 or 100 columns when stdout is not a TTY).
- **Prevent Wrapping Breaks**: Descriptions that exceed the available terminal width must be truncated with a trailing ellipsis (`...`) so that multi-line text wrapping never breaks tree column alignment or visual structure.
- **Agent Mode Exemption**: In token-conservative agent mode (`AGENT=1`), terminal-width truncation and padding are omitted in favor of compact, untruncated bulleted lines for machine inspection.

#### Root Help (`cli --help`) Example

```
Available Commands:
  artwork                                              Manage and fix album cover artwork
  ├─ normalize                                         Crop album cover art to 1:1 square for DJ jog wheels a...
  ╰─ prune                                             Clean up unused cover art and reclaim disk space
  backup                                               Create a safety backup snapshot of your Engine DJ library
  playlist                                             Inspect and manage playlists and folders
  ├─ create <name>                                     Create a new playlist or folder
  ├─ inspect <playlist>                                Display all songs inside a playlist
  ├─ list                                              Display all playlists and folders in your library
  ├─ move <playlist>                                   Relocate a playlist or folder under a parent folder
  ├─ rm <playlist>                                     Delete a playlist or folder
  ╰─ track                                             Manage track memberships inside playlists
     ├─ add <playlist> <track...>                      Add track(s) to a playlist
     ├─ move <src-playlist> <dst-playlist> <track...>  Move track(s) from one playlist to another
     ╰─ rm <playlist> <track...>                       Remove track(s) from a playlist
  restore <backup-dir>                                 Restore your Engine DJ library from a previous backup ...
  sync                                                 Update song information in Engine DJ from audio files ...
  track                                                Manage audio files and collection tracks
  ├─ add <file-path...>                                Import audio file(s) into your collection
  ├─ move <track-id|path> <dest-path>                  Move an audio file on disk and update its collection path
  ├─ relocate                                          Batch-fix audio file paths across drives or directories
  ╰─ rm <track-id|path...>                             Remove track(s) from your collection
  verify                                               Check your library for missing songs, broken links, an...
```

#### Subcommand Group Help (`cli playlist --help`) Example

When requesting help for a subcommand group, print its full subtree:

```
Available Commands:
  create <name>                                     Create a new playlist or folder
  inspect <playlist>                                Display all songs inside a playlist
  list                                              Display all playlists and folders in your library
  move <playlist>                                   Relocate a playlist or folder under a parent folder
  rm <playlist>                                     Delete a playlist or folder
  track                                             Manage track memberships inside playlists
  ├─ add <playlist> <track...>                      Add track(s) to a playlist
  ├─ move <src-playlist> <dst-playlist> <track...>  Move track(s) from one playlist to another
  ╰─ rm <playlist> <track...>                       Remove track(s) from a playlist
```

---

## 3. Argument Parsing & Framework Standards

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

For setup templates and code snippets per framework, see [references/framework-setups.md](references/framework-setups.md) (to provision a new Go CLI or library, use `go-scaffold` available in `$PATH`).

---

## 4. Mandatory `justfile` Standard

Every repository and CLI tool must use `just` with a `justfile` for workflow and task orchestration.

### Required Recipes

```justfile
# Run in human-facing interactive mode
run *args:
    <command-to-run-binary> \{{args}}

# Run in agent-facing token-conservative mode
run-ai *args:
    AGENT=1 <command-to-run-binary> \{{args}}

# Run test suite
test:
    <command-to-run-tests>
```

### Standard Additional Recipes

- `build`: Compiles or bundles the application (e.g. into `bin/`).
- `lint`: Checks formatting and static analysis.
- `check`: Runs typecheck, lint, and test in sequence.

### Workspace & Nested `justfile` Modules (`mod`)

When a repository contains multiple packages, services, or sub-projects (e.g. in `apps/` or `packages/`), each nested directory must maintain its own `justfile`. The parent root `justfile` must link all nested `justfile`s using `mod` directives:

```justfile
mod devhost 'apps/devhost/justfile'
mod design 'packages/design/justfile'
mod ui 'packages/devhost-ui/justfile'
mod docs 'packages/docs/justfile'
```

- **Scoped Invocation**: Submodule recipes can be executed directly from root using module syntax: `just devhost run`, `just design check`, `just ui test`.
- **Root Coordination**: The parent `justfile` should coordinate common tasks across modules (e.g. `test` or `check` recipe running tests across all linked submodules).

For complete `justfile` templates for Bun/Node, Go, Python, Rust, and workspace parent setups, see [references/justfile-templates.md](references/justfile-templates.md).

---

## 5. Documentation & README Structure

README structure, tone, and content are owned by the `docs-writer` skill, not by this one. When writing, restructuring, or reviewing a CLI `README.md`, load `docs-writer` and read its `references/readme.md` (the shared contract every README obeys) followed by `references/readme-cli.md` (the CLI specifics: GitHub Releases installation, bulleted `# How It Works` sections, the `# Options & Flags` table). The copy-pasteable template is `assets/readme-cli-template.md` in that skill.

Do not restate README rules here, in another skill, or in a project. The CLI distribution contract that used to live in this section - GitHub Releases only, no `gh` CLI, no build-from-source - is part of `references/readme-cli.md` now.

---

## 6. Licensing Requirements

- **Default License**: MIT License.
- **Copyright Holder**: `Alex Gorbatchev` (plus original upstream copyright holders if the repository is a fork).
- **Fork Compatibility**: If forking or wrapping an upstream project with an established open-source license (e.g. Apache 2.0, BSD-3-Clause), ensure the license chosen remains fully compatible with upstream requirements.

---

## 7. Verification Checklist

Before publishing or finalizing any CLI tool, verify:

- [ ] Command hierarchy follows `cli subject [subject] verb ...` pattern with a maximum depth of 3 levels.
- [ ] Root help screen prints available commands as an aligned hierarchical tree view using `├─` and `╰─`.
- [ ] Help screen output and command descriptions are trimmed by default to the active terminal width to prevent line wrapping.
- [ ] Subcommand group help screens display their complete command subtree with aligned descriptions.
- [ ] `AGENT=1` detection is implemented across all output pathways.
- [ ] `<cli> skill` prints the embedded `SKILL.md` verbatim in both modes, offline and without repository files.
- [ ] Every agent help screen starts with the skill-reading alert; human help and raw version output preserve their contracts.
- [ ] `SKILL.md` covers every public command and option, and `AGENTS.md` requires it to stay synchronized with the CLI.
- [ ] Behavioral tests verify embedded skill output, help alerts, write failures, and documentation coverage of the live command interface.
- [ ] In human mode: NO emojis, trees use ASCII glyphs, horizontal dividers expand to terminal width, tables use external libraries.
- [ ] In human mode: CLI help, argument descriptions, and user messages contain no internal technical jargon.
- [ ] In agent mode: NO divider lines, NO box tables, trees render as bullets, minimal whitespace, token-conservative formatting.
- [ ] Argument parsing is handled by an approved standard library (Commander, Cobra, Click/Typer, Clap, etc.). No custom argv slicing.
- [ ] `justfile` exists at the project root with working `run`, `run-ai`, and `test` recipes (and links nested `justfile`s with `mod` when in a multi-package workspace).
- [ ] When compiled to binary, output goes to `bin/` and is excluded by `.gitignore`.
- [ ] `README.md` was written against the `docs-writer` skill's `references/readme.md` and `references/readme-cli.md`, and passes the checklist there.
- [ ] Prebuilt binaries are published to GitHub Releases with versioned archive names (e.g. `mytool_X.X.X_darwin_arm64.tar.gz`).
- [ ] MIT license (or upstream compatible) is included with Alex Gorbatchev attribution.
