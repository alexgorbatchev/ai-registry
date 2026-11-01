---
name: gitsnip
description: >-
  Use gitsnip to explore remote Git repositories or fetch selected directories,
  files, and globs for source inspection.
author: alexgorbatchev
metadata:
  created_on: 2026-04-15 21:48
  last_modified: 2026-10-31 18:50
  status: current
---

Use `gitsnip` as the default approach for remote GitHub repository exploration.
These instructions match version 0.2.1. Check `gitsnip --version` and `gitsnip --help`
when the installed interface differs; preserve the task's source and destination.

## Command Shape

```bash
gitsnip <source> [path...] -o <output_dir> [flags]
```

- `source`: `owner/repo[@ref]`, a repository/file/folder URL, or another Git URL.
- `path...`: Optional repository-relative directories, files, or quoted globs.
  Use `.` for the full repository; a source URL can also select a file or folder.
- `-o, --output <dir>`: Destination directory. Always specify it for agent work;
  additional positional arguments select source paths, not the destination.

## Core Rules

- Use repository-relative paths and quote globs so the local shell does not expand them.
- Prefer a task-owned destination under the current repository's `.tmp/gitsnip/`.
- Existing files are protected by default. Resolve collisions with a fresh destination;
  use `--force` only when overwriting those specific files is authorized.
- Use existing SSH authentication, Git credential helpers, or `GH_TOKEN`/`GITHUB_TOKEN`
  for private repositories. Keep credentials out of source URLs and logged commands.

## Workflow

1. Identify the source, requested revision, and scope. Ask for a missing repository
   when it cannot be established from the task. Use `-b <ref>` for a branch, tag,
   or commit; otherwise the repository's default branch is selected.
2. Choose an owned destination and download with `-o`. Leave `--method` at `auto`
   unless the task requires a specific transport.
3. Check the exit status and downloaded paths before using their contents. Report
   an unavailable revision, missing path, or access failure rather than silently
   changing the requested source. Use `--json` when the resolved commit matters.
4. Inspect the downloaded source, then remove task-owned temporary downloads after
   their last consumer unless needed for follow-up work.

## Examples

Fetch a full repository from its default branch:

```bash
gitsnip https://github.com/octocat/Spoon-Knife . -o .tmp/gitsnip/spoon-knife/full
```

Fetch a specific directory:

```bash
gitsnip https://github.com/octokit/octokit.js scripts -o .tmp/gitsnip/octokit/scripts
```

Fetch a single file at a verified branch:

```bash
gitsnip https://github.com/octocat/Hello-World README -b master -o .tmp/gitsnip/hello-world/readme
```

Use API mode for a GitHub download:

```bash
gitsnip https://github.com/octocat/Spoon-Knife . -o .tmp/gitsnip/spoon-knife/api -m api
```

Fetch selected files with a quoted glob:

```bash
gitsnip https://github.com/octokit/octokit.js 'scripts/*.mjs' -o .tmp/gitsnip/octokit/scripts-mjs
```

## Flags and Results

- `-b, --branch <ref>`: Branch, tag, or commit; defaults to the repository's default branch.
- `-m, --method <name>`: `auto` (default), `sparse`, or `api`. Auto uses sparse Git
  when Git is installed, otherwise the API for GitHub. API mode supports github.com.
- `-t, --token <token>`: Token override; otherwise uses `GH_TOKEN` or `GITHUB_TOKEN`.
- `-f, --force`: Permit overwriting existing files.
- `-q, --quiet`: Suppress output on success.
- `-v, --verbose`: Show Git commands and API calls for diagnosis.
- `--json`: Write structured results, including resolved ref/commit and output path, to stdout.
- `-h, --help`: Show usage. `--version`: Show the installed version.

Normal progress/results go to stderr. Exit codes are `0` for success, `1` for a
download failure, `2` for invalid arguments, and `130` for interruption. Without
`-o`, folders use their basename, single files use the current directory, multiple
paths retain their structure below their common parent, and full repositories use
the repository name.

## Troubleshooting

- A destination reported as a missing source path usually means `-o` was omitted.
- For a missing revision or path, verify spelling and the intended source; omit
  `-b` only when the task actually wants the default branch.
- For access or rate-limit failures, verify existing authentication and the source
  URL. An API quota failure may be avoided with sparse Git when available.

Read [references/help.md](references/help.md) for the captured 0.2.1 help and version
output. The current CLI uses `--version`; the old provider flag and completion/version
subcommands are absent from this interface.
