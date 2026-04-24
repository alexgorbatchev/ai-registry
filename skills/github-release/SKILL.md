---
name: github-release
description: Create, inspect, edit, and publish GitHub releases with the `gh release` CLI, including writing release notes, verifying tags, managing draft/prerelease state, and uploading assets. Use when asked to create a GitHub release, fix or replace release notes, publish an existing tag, inspect release metadata, or attach release assets. Do not use for generic git tagging or repository publishing flows that do not involve GitHub Releases.
author: alexgorbatchev
---

# GitHub Release

Use this workflow to manage GitHub Releases with `gh release` instead of guessing flags or hand-editing release pages in the browser.

## Core Rules

- Check authentication first with `gh auth status` if the repository or host context is unclear.
- Determine the target repository explicitly. Use `-R [HOST/]OWNER/REPO` when not operating in the current checkout.
- Inspect the current release/tag state before mutating anything.
- Prefer `--notes-file` for multi-line release notes instead of stuffing large Markdown into `--notes`.
- Prefer `gh release view --json ...` for verification before and after changes.
- Treat `--generate-notes` as a drafting aid at most, not the final release text.
- Use `--verify-tag` when creating or editing a release for an existing tag. Without it, `gh release create` can create a missing tag from the default branch automatically.
- Do not use `gh release upload --clobber` unless the user explicitly accepts the risk. GitHub CLI deletes the existing asset before uploading the replacement.

## Decide The Job

1. Determine whether the user wants to:
   - inspect an existing release
   - create a new release from an existing tag
   - edit title, notes, draft state, or prerelease state
   - upload or replace assets
2. Determine the target repository and tag.
3. Determine whether the tag already exists remotely.
4. Determine whether a release already exists for that tag.

Use this decision rule:

- **Need details about an existing release?** → use `gh release view`
- **Release exists and needs content changes?** → use `gh release edit`
- **Tag exists but release does not?** → use `gh release create --verify-tag`
- **Need to add assets after release creation?** → use `gh release upload`
- **Need to replace an existing asset?** → stop and confirm before `--clobber`

## Inspect First

Start by checking the current state rather than assuming it:

```bash
gh release view <tag> --json name,tagName,isDraft,isPrerelease,createdAt,publishedAt,body,url
```

If the tag is omitted, `gh release view` shows the latest release.

For create flows, also verify the tag exists remotely before relying on it:

```bash
git ls-remote --tags origin <tag>
```

If the user expects a release from a tag that does not exist remotely, stop and clarify whether the tag should be created and pushed first. Do not silently let `gh release create` invent the tag from the default branch unless that behavior is explicitly desired.

## Create A Release

Use `gh release create` when the tag exists and there is no release yet.

Default safe pattern:

```bash
gh release create <tag> \
  --verify-tag \
  --title "<title>" \
  --notes-file "<notes-file>"
```

Add flags only when required:

- `--draft` for unpublished drafts
- `--prerelease` for prereleases
- `--latest=false` when the release should not become Latest
- asset paths after the tag when the assets are ready at creation time

Use `--fail-on-no-commits` when the repository policy is to block duplicate/no-op releases and there is a previous release to compare against.

## Edit A Release

Use `gh release edit <tag>` when the release already exists and only its metadata or notes need to change.

Typical pattern:

```bash
gh release edit <tag> \
  --title "<title>" \
  --notes-file "<notes-file>"
```

Useful variations:

- `--draft=false` to publish a draft
- `--draft` to convert back to draft when appropriate
- `--prerelease` to mark as prerelease
- `--latest` to explicitly mark as Latest

After editing, verify the final body and URL with `gh release view <tag> --json name,body,url`.

## Upload Assets

Attach assets with:

```bash
gh release upload <tag> <file>...
```

To set a display label, append `#Label` to the file path argument.

Example:

```bash
gh release upload v1.2.3 "dist/tool-linux-x64.tar.gz#Linux x64 tarball"
```

If an asset of the same name already exists:

- prefer stopping and asking the user what should replace it
- warn that `--clobber` deletes the old asset before uploading the replacement
- use `--clobber` only with explicit approval

## Write Release Notes From Shipped Changes

Release notes should describe what actually shipped in the `previous-tag...new-tag` range, not whatever happened to be convenient to mention.

Build the notes from evidence:

1. Identify the previous relevant release tag.
2. Inspect the commit range and any diff or changelog material that shipped.
3. Separate user-visible changes from internal noise.
4. Write concise notes grounded in those shipped changes.

Default note structure:

```md
## Summary

- User-visible change 1
- User-visible change 2
- Operationally important change 3

## Notable Commits Since vA.B.C

- `abc1234` type(scope): meaningful commit summary
- `def5678` type(scope): meaningful commit summary

**Full Changelog**: https://<host>/<owner>/<repo>/compare/vA.B.C...vX.Y.Z
```

## Notes Quality Bar

- Prefer 2-5 bullets in `## Summary`.
- Lead with user-visible behavior, fixes, or operator-relevant changes.
- Exclude routine noise such as pure version bumps, trivial housekeeping, or local-only cleanup unless those changes materially affect users or release operators.
- Do not claim a change shipped if it is not in the release range.
- If the release is infra-only or docs-only, say that directly instead of padding the notes.

## Verification Checklist

Before finishing:

1. Confirm the repository and tag are correct.
2. Confirm the release title matches the intended version or product naming.
3. Confirm the notes reflect the actual shipped commit range.
4. Confirm draft/prerelease/latest state is correct.
5. Confirm uploaded assets are present and named correctly.
6. Re-run `gh release view <tag> --json name,body,url,assets,isDraft,isPrerelease` and report the resulting URL.
