---
description: Commit only the files changed by the agent
---

Commit only the files you changed. Keep in mind there are other agents working in the same repository. So make sure not to mess up any files that you haven't touched. 

If your work contains multiple logical change sets, create multiple commits (one commit per change set). Do not combine unrelated changes into a single commit. 

Guidelines:
- Do not make changes to files to accommodate commits.
- Do not include any development environment specifics such as full absolute paths, etc.
- Group files by intent (for example: feature, fix, refactor, docs, tests).
- If one file contains unrelated edits, stage only the relevant hunks for each commit.
- Use a single commit only when all changed files belong to one cohesive change set.

Each commit message should be structured as follows:

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
