# gitsnip CLI Help Snapshot

Captured from the installed `gitsnip 0.2.1` on 2026-10-31. Operational details are
also documented in the [upstream README](https://github.com/dagimg-dot/gitsnip).
Use installed help when a different version is present.

## `gitsnip --help`

```text
Download folders and files from any git repository.

Usage
  gitsnip <source> [path...] [flags]

  <source> is owner/repo[@ref], a link to a repository, folder or file,
  or any git URL. Paths can be folders, files or quoted globs.

Examples
  $ gitsnip dagimg-dot/gitsnip internal/app
  $ gitsnip https://github.com/owner/repo/tree/main/docs
  $ gitsnip owner/repo@v1.2.0 src/lib -o vendor/lib
  $ gitsnip gitlab.com/group/project 'config/*.yml'

Flags
  -o, --output dir    where to write (default: the folder's name)
  -b, --branch ref    branch, tag or commit (default: the repo's default)
  -m, --method name   auto, sparse or api (default auto)
  -t, --token token   access token (default: $GH_TOKEN or $GITHUB_TOKEN)
  -f, --force         overwrite existing files
  -q, --quiet         print nothing on success
  -v, --verbose       show git commands and API calls
      --json          print the result as JSON
  -h, --help          show this help
      --version       print the version
```

## `gitsnip --version`

```text
gitsnip 0.2.1
```
