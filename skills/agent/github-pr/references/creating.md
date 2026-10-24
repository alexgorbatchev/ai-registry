## Workflow

1. Use the current repository as the target unless the user explicitly requests another repository. Inspect the current branch, remotes, and repository conventions to determine the head and base branches; respect a user-specified base.
2. Read the complete branch diff and commit messages relative to the base, including commit bodies. Inspect the working tree, but do not describe uncommitted work as part of the published PR unless it is committed into the head branch before publication. Ground the draft in verified changes and check results.
3. Find related issues in commit messages. Look for references such as `#123`, `fixes #123`, and `closes #123`, including case variants and qualified references such as `owner/repo#123`. Deduplicate references and verify they identify relevant issues, not unrelated PR numbers. If none are found, state `None found in branch commit messages`; never invent an issue number.
4. Use the matching repository PR template when one exists. Keep its required fields and place the information below in the corresponding sections; do not duplicate sections. Otherwise use the fallback body below.
5. Write `.tmp/pr.md` at the repository root: title on the first line, a blank second line, then the body. Keep the draft and supporting files in `.tmp/`.
6. Run the relevant local checks required by the repository: tests, lint, typecheck, build, and project-specific validation. Record the actual commands and outcomes. Fix failures within the assigned scope; report unrelated failures without changing unrelated code. Do not claim checks passed unless their output proves it, and do not publish while required checks are failing.
7. Use the user's existing authorization to create or update the PR with verified title and body content; do not require separate approval of that exact text. Honor any explicit requirement to review content before publication. For a draft-only request, present the concrete title and body and stop before publication. If publication is outside the authorized scope, prepare the content and ask for the missing authorization. Authorization to create or update a PR does not authorize merging, releasing, or deploying.
8. When publication is authorized, create or update the PR with `gh` using the verified title and body. For creation, specify the target repository, base, and head explicitly. Pass the body through `--body-file` using a separate `.tmp/pr-body.md` containing only the body; do not include the title line or use commit autofill in place of the prepared text. Check the result and report the PR number, title, and direct GitHub URL.

## Description Rules

- Keep titles as concise change summaries.
- In the fallback body, use one to three sentences for Description, one line for Type of Change, and two compact bullets for Test Procedure: checks and risks. List related issue references without retelling the issues. Preserve required repository-template details without adding drawn-out explanations.
- Explain the problem solved, why the changes were made, and the resulting behavior. Do not narrate the coding process, repeat the title, paste a commit log, or provide a file-by-file inventory.
- Select the applicable Type of Change from: `Bug fix`, `New feature`, `Breaking change`, `Refactor`, `Cosmetic`, `Documentation`, or `Workflow`. List multiple types only when each describes a substantive part of the diff.
- State what was tested, the observed result, and what could break. Name affected behavior or compatibility risks supported by the diff. For unrun checks, write `Not run` with the reason; never fabricate test results or claim `No risk` without evidence. Report unresolved check failures before publication.
- Treat commit issue references as evidence to investigate. Use plain `#123` for related work; use `Fixes #123` or `Closes #123` only when the change resolves the verified issue. Do not infer closing intent from a bare reference. See [GitHub's issue-linking rules](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue) for closing behavior and cross-repository syntax.

## Fallback PR Body

Replace every placeholder with verified information before presenting the draft.

```markdown
## Related Issue Number

<Verified issue references, or None found in branch commit messages>

## Description

<Explain in first person what problem I addressed, why, and what behavior changed>

## Type of Change

<Applicable change type>

## Test Procedure

- Checks: <Commands or manual steps I ran and observed results; Not run with reason where applicable>
- Risks: <Affected behavior or compatibility that could break>
```

Use the [GitHub CLI PR documentation](https://cli.github.com/manual/gh_pr_create) to verify flags when publishing.
