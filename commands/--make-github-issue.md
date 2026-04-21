---
description: Prepare a GitHub issue
targets: ['*']
---

Lets prepare an GitHub issue for this problem:

- Check if there are any existing issues opened AND closed related to the problem to avoid duplicates. If this problem has already been reported, stop and provide the matching issue number(s)/title(s) instead of creating a new one.
- Check if there are templates for GitHub issues in the repository.
- If there are templates, use the correct template to format the issue.
- Gather all necessary information about the problem, including steps to reproduce, expected behavior, and actual behavior.
- Compose a `issue.md` at the workspace root, first line should be the issue title, followed by a blank line, and then the issue body with the gathered information.

Wait for the user to review. When the user approves, create a new issue in the GitHub repository using the content of `issue.md` with `gh` CLI tool. Confirm creation to the user without including URLs.

**Style guide**

- Do not use emojis.
- Do not add AI signature.
- Do not include URLs in responses. Reference issues by number/title only.
