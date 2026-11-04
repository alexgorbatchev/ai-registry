# CLI Best Practices

## Contents

- [Scope](#scope)
- [Core Rules](#core-rules)
- [Dual-Mode Output (`AGENT=1`)](#dual-mode-output-agent1)
- [Command Hierarchy & Help Screens](#command-hierarchy--help-screens)
- [Argument Parsing](#argument-parsing)
- [Task Automation (`justfile`)](#task-automation-justfile)
- [Documentation & README](#documentation--readme)
- [Licensing](#licensing)
- [Verification Checklist](#verification-checklist)

## Scope

[Task Automation](#task-automation-justfile) applies to every project. Every other section applies to CLI applications intended to be operated as tools by users or agents, including standalone executables and packaged commands.

For new CLI applications or explicitly authorized standardization, apply all relevant requirements within the authorized scope. For existing applications, apply requirements to the changed surfaces and the smallest necessary prerequisite repairs under the active task policy. Report unrelated pre-existing deviations as follow-up work; they do not expand the task or block its completion unless they prevent required checks from passing. Preserve existing licensing and distribution arrangements unless the task explicitly authorizes changing them. All required checks remain in force.

Scripts embedded in a repository, skill bundle, or project workflow for internal automation, such as build helpers, tests, CI tasks, migrations, code generation, or maintenance scripts, are not CLI applications. A script's arguments, flags, shebang, or execution from a terminal do not make it one; use the relevant language and project guidance for those scripts. A CLI application implemented in a scripting language remains in scope; classify by its intended use and supported interface.

Web frontends and non-CLI services fall outside the CLI sections. README-only work belongs to `docs-writer`; follow its README references when an application task also changes the README.

Language-specific implementation of these rules lives in each language's references:

| Language | CLI reference | Justfile reference |
| --- | --- | --- |
| Go | [Go CLI](../go/cli.md) | [Go justfile](../go/justfile.md) |
| Python | [Python CLI](../python/cli.md) | [Python justfile](../python/justfile.md) |
| Rust | [Rust CLI](../rust/cli.md) | [Rust justfile](../rust/justfile.md) |
| TypeScript / Bun | [TypeScript CLI](../typescript/cli.md) | [Bun justfile](../bun/justfile.md) |

## Core Rules

1. **Dual-Mode Output via `AGENT=1`**: Detect the `AGENT=1` environment variable. When unset or `0`, produce clean, polished human-facing output. When `1` (or truthy), switch to token-conservative agent-facing output.
2. **Command Structure (`cli subject [subject] verb ...`)**: Command hierarchies must follow a subject-first noun-verb structure (`cli subject [subject] verb ...`) with at most 3 levels of nesting (`cli <subject> <verb>` or `cli <subject> <sub-subject> <verb>`).
3. **Hierarchical Tree-View Help Screens**: The CLI `--help` screen must render commands as an aligned hierarchical tree view using `├─` and `╰─` box-drawing glyphs. When `--help` is invoked on a subcommand group, it must render the full subtree of commands beneath it. Human help wraps to the active terminal width with aligned continuation lines. Help text is never truncated in any mode.
4. **Strict Ban on Custom or Stdlib Arg Parsers**: Never parse the process arguments manually with custom loops or regexes, and never use the standard library's primitive option parser. Always use the ecosystem's leading CLI framework, named in the language's CLI reference.
5. **Mandatory Task Automation (`justfile`)**: Follow [Task Automation](#task-automation-justfile), including the CLI recipes `run` and `run-ai`.
6. **GitHub Releases Distribution Only**: Ship end users prebuilt binaries from GitHub Releases. Never require them to build from source, and never use the `gh` CLI in installation instructions. A CLI built on `gh` documents its `gh` login and runtime use under `# Setup`; any other CLI never mentions `gh` to end users.
7. **README Content Is Owned By `docs-writer`**: Do not write or restate README structure, section order, or tone rules here. Load the `docs-writer` skill and read its `references/readme.md` plus `references/readme-cli.md` before touching a CLI `README.md`.
8. **Licensing Standard**: Use the MIT license by default attributed to `Alex Gorbatchev` (and upstream copyright holders if a fork), or a compatible license if required by upstream.
9. **Agent Skill (`<cli> skill`)**: Every CLI must maintain its agent skill at `skills/<cli>/SKILL.md` in the repository root and ship a top-level `skill` command that prints the Skills CLI install command and the skill URL. Every agent-mode help screen must start with an alert directing agents to read `AGENT=1 <cli> skill` first. Apply the contract below when building or scaffolding CLI tools.
10. **Home Directory Folding (`~/`)**: Every path written to stdout or stderr must show the user's home directory as `~`. When a path equals the home directory, print `~`; when it starts with the home directory followed by a path separator, replace that prefix with `~` and keep the rest unchanged (`/home/dev/projects/app` prints as `~/projects/app`). Match whole path segments only: with home `/home/dev`, `/home/developer/app` prints unchanged. Resolve the home directory through the platform's home-directory API, and route every printed path through one shared formatting helper, covering results, logs, warnings, error messages, and help text in both human and agent modes. Fold for display only: keep absolute paths for filesystem calls, subprocess arguments, and written files. Test the helper with the home directory itself, a nested path, a sibling directory sharing the prefix, and a path outside home.

### Agent Skill Contract

- **Skill location**: Keep the skill at `skills/<cli>/SKILL.md` at the repository root, with its `references/` files beside it. The Skills CLI discovers skills under the root `skills/` directory, so `npx skills add <owner>/<repo> --skill <cli>` installs it from there. Set the skill's frontmatter `name` to `<cli>`, because `--skill` selects by that name. In a monorepo the path stays at the repository root, never inside the CLI's package directory. Never embed `SKILL.md` in the executable, and never keep a second copy of it elsewhere in the repository.
- **Command and output**: `<cli> skill` accepts no positional arguments or command-specific flags. Print exactly the text below to stdout, ending in one newline, with identical bytes in human and agent modes. Replace `<cli>` with the binary name, `<owner>/<repo>` with the GitHub repository, and `<branch>` with its default branch; change nothing else. Hold the text as a compiled-in constant: the command makes no network request and reads no repository files or credentials at runtime. Return output-write failures as errors.

  ```
  Install the <cli> skill using the Skills CLI:

    npx skills add <owner>/<repo> --skill <cli>

  Skill:

    https://github.com/<owner>/<repo>/tree/<branch>/skills/<cli>
  ```

- **Agent help alert**: In `AGENT=1` and other supported truthy modes, prefix every help screen, including subcommand and generated-command help, with the line ``ALERT: Agents must read `AGENT=1 <cli> skill` before using this tool.`` Replace `<cli>` with the binary name and preserve the framework's help rendering after the alert. Human help and raw `--version` output retain their normal contracts.
- **Complete operational reference**: Include all public commands, generated help/completion commands, positional arguments, flags, short aliases, types, defaults, accepted values, environment variables, output formats, errors, and side effects in `SKILL.md`. Explain effective defaults when a parser sentinel selects a runtime value. Include workflow examples so agents can operate from the skill without exploring per-command `--help`.
- **Scope and wording**: Use frontmatter `description` only for routing to the CLI's usage skill. Write affirmative usage instructions and factual contracts in the body. Keep development instructions and negative prohibitions in the repository's `AGENTS.md`; the skill is for operating the CLI.
- **Maintenance**: Add an explicit rule to `AGENTS.md` requiring skill updates in the same change as any command, argument, option, default, environment, output, or side-effect change. Update `last_modified` and verify documented behavior against the implementation and pinned dependencies.
- **Verification**: Test byte-for-byte command output in both modes, rejected extra arguments, output failures, and the alert at the top of all help paths. Assert that the `skills/<cli>` path in the printed URL holds a `SKILL.md` in the repository and that its frontmatter `name` equals the printed `--skill` value. Compare `skills/<cli>/SKILL.md` with the live command tree and flag metadata so interface drift fails tests. Scaffold the file, command, alert, maintenance rule, and these tests together.

The `skill` command is the shared top-level metadata interface alongside the subject-first domain commands. Its fixed indented output is an explicit exception to agent-mode whitespace restrictions.

## Dual-Mode Output (`AGENT=1`)

### Mode Detection

Check `AGENT` in environment variables, trimmed and compared case-insensitively:
```
isAgent = (env.AGENT === "1" || env.AGENT === "true" || env.AGENT === "yes")
```

### Contrast Table

| Dimension | Human Mode (`AGENT=0` / unset) | Agent Mode (`AGENT=1`) |
| :--- | :--- | :--- |
| **Goal** | Visual polish, readability, end-user clarity | Minimum token consumption, machine parseability |
| **Emojis** | **STRICTLY PROHIBITED**. Use text tags (`[OK]`, `[ERROR]`, `[WARN]`, `[INFO]`) or color. | **STRICTLY PROHIBITED**. Use compact text prefixes (`OK:`, `ERR:`). |
| **Separators (`---`, `===`)** | Expand to the full terminal width, queried at render time. | **PROHIBITED**. No divider lines across the screen. |
| **Hierarchies / Trees** | ASCII / Box-drawing tree glyphs (`├──`, `└──`, `│`). | Indented bullets (`* `, `- `) with minimal nesting spaces. |
| **Tabular Data** | Well-formatted box / ASCII tables using dedicated external table libraries. | Flat key-value pairs, TSV, or concise line-by-line output. **No tables**. |
| **Whitespace & Padding** | Formatted spacing, aligned columns, visual breathing room. | Minimal whitespace. **No alignment spaces or padding**. |
| **Descriptions & Help** | Non-technical language, user-friendly, wrapped to terminal width and never truncated, no internal implementation details. | May include technical implementation details, exact types, error codes, and stack traces. Full content, never truncated. |
| **Error Handling** | Concise user-facing error message with actionable resolution hints. | Full error details, underlying cause, internal code, and stack trace if relevant. |

Implementation patterns for mode detection, terminal width, dividers, trees, and tables are in each language's CLI reference.

## Command Hierarchy & Help Screens

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

#### Terminal Width Wrapping

- **Wrap to Terminal Width**: Wrap human help between words at the active terminal width. Query the terminal through the language's terminal-size API or `COLUMNS`, and fall back to 80 or 100 columns when stdout is not a TTY.
- **Align Continuation Lines**: Start continuation lines at the description column and keep tree branches connected, so wrapping preserves column alignment and visual structure.
- **Never Truncate**: Show all help text in full. Never clip lines, add an ellipsis, or offer an option to do either.
- **Full Agent Help**: In agent mode (`AGENT=1`), always print complete help as compact, unwrapped bulleted lines. No option, `COLUMNS` value, or terminal size may shorten it.

#### Root Help (`cli --help`) Example

```
Available Commands:
  artwork                                              Manage and fix album cover artwork
  ├─ normalize                                         Crop album cover art to 1:1 square for DJ jog wheels and
  │                                                    media players
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
  restore <backup-dir>                                 Restore your Engine DJ library from a previous backup
                                                       snapshot
  sync                                                 Update song information in Engine DJ from audio files on
                                                       disk
  track                                                Manage audio files and collection tracks
  ├─ add <file-path...>                                Import audio file(s) into your collection
  ├─ move <track-id|path> <dest-path>                  Move an audio file on disk and update its collection path
  ├─ relocate                                          Batch-fix audio file paths across drives or directories
  ╰─ rm <track-id|path...>                             Remove track(s) from your collection
  verify                                               Check your library for missing songs, broken links, and
                                                       duplicates
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

## Argument Parsing

Never roll custom argument parsers. Use the framework named in the language's CLI reference, with its native parsing, validation, help, and error handling. For a language without a CLI reference here, use the ecosystem's leading maintained CLI framework.

### Help Text Rules

- **Human Mode**: Commands, arguments, options, and descriptions must be self-explanatory to non-technical users. Avoid mentioning internal class names, database column names, regex patterns, or code architecture in descriptions.
- **Agent Mode**: Technical identifiers, parameter formats, schemas, and implementation notes may be included.

## Task Automation (`justfile`)

Every project uses `just` with a `justfile` for its development tasks: running, development servers, builds, formatting, linting, type checking, tests, and aggregate validation. Invoke them with `just <recipe>` locally and in CI.

- Run tool binaries and entrypoints directly inside recipes. Do not define development tasks in package-manager script tables: `package.json` has no `scripts` field. Keep package metadata, dependencies, and workspaces in the manifest. When migrating, move task commands into recipes, update local and CI callers, and remove the superseded scripts.
- Avoid makefiles and uncoordinated shell scripts for task orchestration.

### Required Recipes

| Recipe | Required for | Contract |
| --- | --- | --- |
| `check` | Every project | Aggregate validation: formatting check, linting, type checking, unused-code analysis, and tests, as the toolchain provides them. Read-only, including every dependency. |
| `test` | Every project | Runs the test suite. |
| `run *args` | Runnable projects | Runs the primary entrypoint, forwarding arguments. |
| `run-ai *args` | CLI applications | Runs the CLI with `AGENT=1`, forwarding arguments. |

Name aggregate validation `check` and invoke it as `just check` or `just <module> check`. Do not create `verify` or any other alias for it. Task completion requires `just check` to pass.

Keep `check` and its dependencies read-only; files change only through write recipes such as `fmt` (apply formatting) and `fix` (apply lint fixes and formatting). Split read-only counterparts into their own recipes, such as `fmt-check`, so `check` can depend on them. A language reference may require more recipes; for example, Go requires `fmt`.

Common optional recipes: `build` (compile or bundle, binaries into `bin/`), `lint`, `typecheck`, `fmt`, `fmt-check`, `fix`, `dev`, and `clean`.

```justfile
# Run in human-facing interactive mode
run *args:
    <command-to-run-binary> {{args}}

# Run in agent-facing token-conservative mode
run-ai *args:
    AGENT=1 <command-to-run-binary> {{args}}

# Run the test suite
test:
    <command-to-run-tests>

# Validate without modifying files
check: fmt-check lint test
```

### Applications With A Companion CLI

When the repository's primary deliverable is an application (a desktop app, menu-bar app, or service) and the CLI controls it, `run` builds and launches the application. Define the CLI recipes under these names instead of `run` and `run-ai`:

```justfile
# Launch the application
run:
    <command-to-build-and-launch-app>

# Run the CLI in human-facing mode
cli *args:
    <command-to-run-cli-binary> {{args}}

# Run the CLI in agent-facing token-conservative mode
cli-ai *args:
    AGENT=1 <command-to-run-cli-binary> {{args}}
```

List this mapping in the repository's `AGENTS.md` commands section. A repository whose primary deliverable is the CLI itself keeps `run` and `run-ai` for the CLI.

### Nested justfiles

Every subproject, package, library, app, service, or tool directory in a repository keeps its own `justfile` with the required recipes. The parent `justfile` links each one with `mod` and aggregates `check` and `test` across them.

- A `justfile` runs only commands and scripts that belong to its own directory. To act on a subproject, call its recipe as `just <module> <recipe>`, or depend on it; never run that subproject's tools, scripts, entrypoints, or paths from the parent, even with `cd` or path arguments.
- When a parent needs a task a subproject does not expose, add the recipe to the subproject's `justfile` and call it from the parent.

Follow [Modular justfiles](../just/modular-justfiles.md) for module declarations, working directories, and the root template.

## Documentation & README

README structure, tone, and content are owned by the `docs-writer` skill. When writing, restructuring, or reviewing a CLI `README.md`, load `docs-writer` and read its `references/readme.md` (the shared contract every README obeys) followed by `references/readme-cli.md` (the CLI specifics: GitHub Releases installation, bulleted `# How It Works` sections, the `# Options & Flags` table). The copy-pasteable template is `assets/readme-cli-template.md` in that skill. Do not restate README rules here or in a project.

## Licensing

- **Default License**: MIT License.
- **Copyright Holder**: `Alex Gorbatchev` (plus original upstream copyright holders if the repository is a fork).
- **Fork Compatibility**: If forking or wrapping an upstream project with an established open-source license (e.g. Apache 2.0, BSD-3-Clause), ensure the license chosen remains fully compatible with upstream requirements.

## Verification Checklist

Before publishing or finalizing any CLI tool, verify:

- [ ] Command hierarchy follows `cli subject [subject] verb ...` pattern with a maximum depth of 3 levels.
- [ ] Root help screen prints available commands as an aligned hierarchical tree view using `├─` and `╰─`.
- [ ] Human help wraps to the active terminal width with aligned continuation lines, and help text is never truncated in any mode.
- [ ] Subcommand group help screens display their complete command subtree with aligned descriptions.
- [ ] `AGENT=1` detection is implemented across all output pathways.
- [ ] The agent skill lives at `skills/<cli>/SKILL.md` in the repository root, with no embedded or duplicate copy.
- [ ] `<cli> skill` prints the Skills CLI install command and the skill URL, byte-identical in both modes, offline and without repository files.
- [ ] Every agent help screen starts with the skill-reading alert; human help and raw version output preserve their contracts.
- [ ] `SKILL.md` covers every public command and option, and `AGENTS.md` requires it to stay synchronized with the CLI.
- [ ] Behavioral tests verify skill command output, the printed skill path, help alerts, write failures, and documentation coverage of the live command interface.
- [ ] Every path printed to stdout or stderr folds the home directory to `~` in both modes, through one shared helper with segment-boundary tests.
- [ ] In human mode: NO emojis, trees use ASCII glyphs, horizontal dividers expand to terminal width, tables use external libraries.
- [ ] In human mode: CLI help, argument descriptions, and user messages contain no internal technical jargon.
- [ ] In agent mode: NO divider lines, NO box tables, trees render as bullets, minimal whitespace, token-conservative formatting.
- [ ] Argument parsing uses the framework named in the language's CLI reference. No custom argv slicing.
- [ ] `justfile` exists at the project root with working `run`, `run-ai`, `test`, and `check` recipes, or `run` (application), `cli`, `cli-ai`, `test`, and `check` for an application with a companion CLI, plus any recipes the language reference requires, and links nested `justfile`s with `mod` in a multi-package workspace.
- [ ] `just check` passes and modifies no files.
- [ ] When compiled to binary, output goes to `bin/` and is excluded by `.gitignore`.
- [ ] `README.md` was written against the `docs-writer` skill's `references/readme.md` and `references/readme-cli.md`, and passes the checklist there.
- [ ] Prebuilt binaries are published to GitHub Releases with versioned archive names (e.g. `mytool_X.X.X_darwin_arm64.tar.gz`).
- [ ] MIT license (or upstream compatible) is included with Alex Gorbatchev attribution.
