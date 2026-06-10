---
name: git-commit
description: User when asked to commit changes in a Git repository.
author: alexgorbatchev
---

When requested to commit, analyze the user's intent to select the correct strategy:

### 1. Default: Commit Changed Files Only
If the user asks to commit, or when finalizing changes made during the session, **always default** to committing only the files that you have modified.
- **Reference**: See [commit-changed-files.md](references/commit-changed-files.md) for detailed guidelines, message structure, and staging rules.
- **Goal**: Protect files modified by other agents/collaborators in the same repository by only staging your own changes.

### 2. Explicit Override: Commit All Files
Only commit all files if the user **explicitly** asks to commit all files (e.g., "commit all", "commit everything").
- **Reference**: See [commit-all-files.md](references/commit-all-files.md) for rules on grouping and committing accumulated, unrelated changes.
- **Goal**: Safely identify, group, and make individual commits for accumulated, uncommitted work in the repository.
