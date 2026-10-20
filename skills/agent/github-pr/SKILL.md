---
name: github-pr
description: >-
  Use when preparing, writing, creating, or updating GitHub pull requests with
  the gh CLI, including PR titles and descriptions, attaching screenshots or
  videos to PR descriptions and comments, or when reviewing and responding to
  review comments on a GitHub pull request.
author: alexgorbatchev
metadata:
  created_on: 2026-10-01 21:08
  last_modified: 2026-10-20 15:53
  status: current
---

Choose the mode from the request and follow its reference.

| Request | Read and follow |
| --- | --- |
| Draft, create, or update a PR title or description | [Creating](references/creating.md) |
| Review or respond to comments left on a PR | [Reviewing](references/reviewing.md) |

## Attachments

Attach images and videos with `gh`'s `--attach <path>[#alt text]` flag on `gh pr create`, `gh pr edit`, and `gh pr comment`. It uploads the file and writes the GitHub-hosted URL into the posted body. Do not upload through a browser, paste local paths, or hand-write asset URLs. If `--help` for the command does not list `--attach`, report that the installed `gh` lacks attachment support instead of using another upload route.

To place media inline, reference each file in the body by the same path passed to `--attach`; `gh` rewrites those references to the uploaded URLs and appends any unreferenced attachment to the end of the body:

```bash
# .tmp/pr-body.md contains, among the prose:
#   ![Error state after sign-in](.tmp/after.png)
#
#   ![](.tmp/demo.mp4)
gh pr edit 123 --body-file .tmp/pr-body.md --attach .tmp/after.png --attach .tmp/demo.mp4
```

- `gh pr edit --attach` without a body flag keeps the existing description and appends the attachment. To place media inside an existing description, save the current body with `gh pr view <number> --json body --jq .body`, insert the references, and pass the file with `--body-file` plus the matching `--attach` flags.
- Put a video reference alone in its own paragraph so it renders as a player; inside a sentence it renders as a link. Videos take no alt text.
- `--attach` accepts only image and media files (PNG, GIF, JPEG, SVG, MP4, MOV, WebM), at most 50 per command and each file once. It requires push access to the repository. See [GitHub's attachment limits](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).
- Uploads to public repositories are readable without authentication. Confirm that a screenshot contains no secrets, tokens, or private data before attaching it.
- When some uploads fail, `gh` still posts the ones that succeeded and exits non-zero. Read the posted body before retrying so the retry does not duplicate attachments.

## Writing Rules

- Write PR descriptions, comments, and replies posted from the user's account in first person as the account owner (`I`, `me`, `my`). This includes implementation updates, review replies, approval statements, and landing notices. Use `I approved landing this change` instead of `The user approved landing this change`.
- Ground first-person statements in actual work, check results, and authorization. A change of voice does not grant approval or justify inventing actions or decisions. Do not refer to the account owner as `the user`, `the requester`, or `the human`, or narrate an assistant acting as intermediary. A review posted by a separate bot speaks only for that bot's identity.
- Keep posted text concise and to the point.
- In text posted to GitHub, reference issues and PRs as `#123` or `owner/repo#123` and commits by SHA instead of pasting URLs; GitHub [autolinks these references](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls) in conversations and descriptions.
- In reports to the user, give every referenced PR, issue, commit, or file a direct GitHub URL, because the user's terminal or chat does not autolink `#123`.
- Do not use emojis, AI signatures, assistant attribution, or conversational filler in posted text. Reactions placed through the reactions API are not posted text.
