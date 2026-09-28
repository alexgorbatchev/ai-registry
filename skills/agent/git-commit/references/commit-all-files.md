---
description: Identify changes and make commits
---

We have forgotten to make commits while we were making changes and now there's a bunch of unrelated changes.
Identify changes and make individual commits.

Guidelines:
- Group files by intent (for example: feature, fix, refactor, docs, tests).
- If one file contains unrelated edits, stage only the relevant hunks for each commit.
- Check for an associated ticket number (e.g., from the branch name, issue tracker, task description, or ticket documents) and include it in each commit (for example, in the footer as `Refs: #123` / `Ticket: PROJ-123`, or in the scope/subject following repository conventions) to attribute work. Not all commits will have tickets, so omit it if none applies; do not fabricate one.

The commit message should be structured as follows:

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
