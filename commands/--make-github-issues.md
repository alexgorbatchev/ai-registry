---
description: Make one or more GitHub issues
---

Make a GitHub issue or multiple issues for the identified problem(s) or work items.

Load the `github-issue` skill and follow it for each issue: review open issues before creating any new one (use `--state open`, do not fetch all issues, and update the existing issue if partially covered), specify ticket dependencies (and update existing issues if this introduces a new dependency), follow repository issue templates, apply mandatory labels, draft at `.tmp/issue.md` (or `.tmp/issue-<name>.md` when drafting multiple issues), observe the title and body rules, and clean up all `.tmp/issue*` files once done. Do not restate those rules here.
