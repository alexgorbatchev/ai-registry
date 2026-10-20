---
name: github-pr
description: >-
  Use when preparing, writing, creating, or updating GitHub pull requests with
  the gh CLI, including PR titles and descriptions, or when reviewing and
  responding to review comments on a GitHub pull request.
author: alexgorbatchev
metadata:
  created_on: 2026-10-01 21:08
  last_modified: 2026-10-20 11:09
  status: current
---

Choose the mode from the request and follow its reference.

| Request | Read and follow |
| --- | --- |
| Draft, create, or update a PR title or description | [Creating](references/creating.md) |
| Review or respond to comments left on a PR | [Reviewing](references/reviewing.md) |

## Writing Rules

- Write PR descriptions, comments, and replies posted from the user's account in first person as the account owner (`I`, `me`, `my`). This includes implementation updates, review replies, approval statements, and landing notices. Use `I approved landing this change` instead of `The user approved landing this change`.
- Ground first-person statements in actual work, check results, and authorization. A change of voice does not grant approval or justify inventing actions or decisions. Do not refer to the account owner as `the user`, `the requester`, or `the human`, or narrate an assistant acting as intermediary. A review posted by a separate bot speaks only for that bot's identity.
- Keep posted text concise and to the point.
- In text posted to GitHub, reference issues and PRs as `#123` or `owner/repo#123` and commits by SHA instead of pasting URLs; GitHub [autolinks these references](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls) in conversations and descriptions.
- In reports to the user, give every referenced PR, issue, commit, or file a direct GitHub URL, because the user's terminal or chat does not autolink `#123`.
- Do not use emojis, AI signatures, assistant attribution, or conversational filler in posted text. Reactions placed through the reactions API are not posted text.
