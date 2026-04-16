---
name: gitsnip
description: >-
  Use the gitsnip CLI to fetch full repositories or specific directories from
  GitHub without cloning entire repos. Trigger whenever there is a need to
  explore full or partial GitHub repository content, inspect remote code
  quickly, or pull only selected folders for analysis.
---

# gitsnip

Use `gitsnip` as the default approach for remote GitHub repository exploration.

## Command Shape

```bash
gitsnip <repository_url> <folder_path> [output_dir] [flags]
```

Arguments:

- `repository_url`: GitHub repo URL (for example `https://github.com/owner/repo`)
- `folder_path`: Directory path inside the repo to download
- `output_dir` (optional): Destination on disk

## Core Rules

- Use `.` (dot) as `folder_path` to fetch the full repository tree.
- Do **not** use `/` as `folder_path`; sparse checkout rejects leading slashes.
- Pass an explicit `output_dir` to avoid writing files into the current working directory.
- Prefer output paths under the current repository's `.tmp/gitsnip/` directory.
- Treat `folder_path` as a **directory path**. For a single file, download its parent directory.

## Recommended Workflow

1. Identify `repository_url`, `branch`, and required scope (`.` for full repo or `path/to/dir` for partial).
2. Choose a deterministic destination folder under the current project's `.tmp/` directory (for example `.tmp/gitsnip/<repo>/<branch>/<scope>`).
3. Run `gitsnip` with explicit flags.
4. Inspect downloaded content with `ls`, `find`, `grep`, and `read`.
5. Remove temporary downloads when done unless they are needed for follow-up work.

## Examples

Fetch full repo from default branch:

```bash
gitsnip https://github.com/octocat/Spoon-Knife . .tmp/gitsnip/spoon-knife/main/full
```

Fetch a specific directory:

```bash
gitsnip https://github.com/octokit/octokit.js scripts .tmp/gitsnip/octokit/main/scripts
```

Fetch from non-default branch (`master`):

```bash
gitsnip https://github.com/octocat/Hello-World . .tmp/gitsnip/hello-world/master/full -b master
```

Use API mode (can be simpler for lightweight fetches):

```bash
gitsnip https://github.com/octocat/Spoon-Knife . .tmp/gitsnip/spoon-knife/main/full -m api
```

Use token for private repos or rate-limit headroom:

```bash
gitsnip https://github.com/owner/private-repo path/to/dir .tmp/gitsnip/private/main/dir -t "$GITHUB_TOKEN"
```

## Flag Guidance

- `-b, --branch`: Specify branch (default is `main`)
- `-m, --method`: `sparse` (default) or `api`
- `-t, --token`: GitHub token for private repos / higher limits
- `-q, --quiet`: Reduce progress output
- `-p, --provider`: Provider (currently `github`)

## Troubleshooting

- Error `couldn't find remote ref main`: rerun with the actual default branch, often `-b master`.
- Error about sparse checkout + leading slash: remove leading `/` and use relative paths (`.` or `dir/subdir`).
- Error `not a directory`: `folder_path` points to a file; download the file's parent directory instead.

## Help Reference

Read `references/help.md` for the captured help output (`--help`, `completion --help`, `version --help`) used to build this skill.
