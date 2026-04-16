---
description: Prepare a GitHub pull request
targets: ['*']
copilot: { agent: agent }
---

Lets prepare a GitHub pull request for this change:

- Use the current repository as the PR target by default.
- Only use an upstream or different repository when the user explicitly requests it.
- Detect the current branch and the correct base branch (or use the base branch provided by the user).
- Check if there are pull request templates in the repository and use the appropriate one. If no template exists, use the default PR body format below.
- Summarize the complete change set (what changed and why) from the current branch commits and working tree.
- Compose a `pr.md` at the workspace root: first line should be the PR title, followed by a blank line, then the PR body.
- Run all relevant local checks (tests, lint, typecheck, build, and any project-specific validations) and ensure they pass before creating the PR.
- Default PR body format:

  ## Summary
  Briefly describe what changed.

  ## Why
  Explain the problem or motivation behind this change.

  ## Changes
  - Change 1
  - Change 2
  - Change 3

  You may add additional sections/details when needed if important context does not fit this template.

Wait for the user to review. When the user approves, create the PR using `gh` CLI with the content of `pr.md`. Confirm creation to the user without including URLs.

**Style guide**

- Do not use emojis.
- Do not add AI signature.
- Do not include URLs in responses. Reference pull requests by number/title only.
