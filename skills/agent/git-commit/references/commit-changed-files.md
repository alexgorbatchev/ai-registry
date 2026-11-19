---
description: Commit only the files changed by the agent
---

Commit only the files you changed. Keep in mind there are other agents working in the same repository. So make sure not to mess up any files that you haven't touched. 

If your work contains multiple logical change sets, create multiple commits (one commit per change set). Do not combine unrelated changes into a single commit. 

Guidelines:
- Name your paths on every commit. Run `git add -- <paths>` for files Git does not track yet, then `git commit -- <paths>`, listing both paths of a rename. Git records those paths as they are in the working tree and leaves everything else in the shared index as it was. Never commit without paths, and never use `git commit -a`, `git add -A` or `git add .`: other sessions' staged changes would land in your commit.
- If one file contains edits for separate commits, commit each part through a private index, which leaves the shared index alone, then refresh that file's entry in the shared index:
  ```sh
  tmp=$(mktemp) && GIT_INDEX_FILE="$tmp" git read-tree HEAD
  GIT_INDEX_FILE="$tmp" git apply --cached <patch holding only this commit's hunks>
  GIT_INDEX_FILE="$tmp" git commit -m "<message>" && rm "$tmp"
  git reset -q -- <file>
  ```
- Do not make changes to files to accommodate commits.
- Do not include any development environment specifics such as full absolute paths, etc.
- Group files by intent (for example: feature, fix, refactor, docs, tests).
- Use a single commit only when all changed files belong to one cohesive change set.
- Attribute commits to an associated ticket only when repository publication policy permits it. Keep private tracker numbers and content out of public commit messages; record the commit in the private ticket instead. Follow permitted repository conventions and omit attribution when no ticket applies; do not fabricate one.

Each commit message should be structured as follows:

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
