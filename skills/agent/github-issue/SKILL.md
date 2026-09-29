---
name: github-issue
description: >-
  Write and file GitHub issues with the `gh` CLI. Use when asked to open, file,
  report, or prepare a GitHub issue, to turn a bug or a proposal into a ticket,
  or to check whether something has already been reported. Do not use for pull
  requests, releases, or Gitea hosts.
author: alexgorbatchev
metadata:
  created_on: 2026-09-18 13:22
  last_modified: 2026-09-29 11:37
  status: current
---

An issue is a case, not a note. It must let a reader who has never seen the problem confirm it from the repository alone. Ground every claim in source you have read: file and line references, real command output, actual defaults. Never file a symptom you have not traced to code.

For the full section-by-section anatomy of each issue type, read [references/issue-anatomy.md](references/issue-anatomy.md).

## Workflow

1. **Review open issues first.**
   Check currently open issues to see if the problem is already being tracked:
   ```bash
   gh issue list --state open --search "<distinctive keywords>" --limit 30
   ```
   **Always use `--state open`** with targeted keywords (search the specific symbol, flag, or error message rather than broad prose descriptions). **Do not fetch all issues** or list without filters.
   - **Already covered:** If an existing open issue already covers the problem, stop and give the user the matching issue numbers and titles instead of filing anything.
   - **Partially covered:** If an existing open issue partially covers the problem (e.g., related symptom, same root cause in another component, or incomplete reproduction), **do not file a new issue**. Instead, update the existing issue (via `gh issue comment` or `gh issue edit`) with the new evidence, additional call sites, or expanded scope.
2. **Read the repository's conventions.** Check `.github/ISSUE_TEMPLATE/` and follow the matching template when one exists; its structure wins over the default anatomy.
3. **Investigate before drafting.** Find the responsible code, the call sites, and any place the same problem is handled correctly. A contrasting correct call site is the strongest evidence an issue can carry: it shows the defect is an oversight rather than a design choice.
4. **Identify dependencies.**
   - If this issue depends on another issue, clearly specify that dependency (e.g., under `## Dependencies` or `Depends on #<number>`).
   - If this new issue introduces a dependency into an existing issue (i.e., the existing issue cannot proceed without this one), **update the existing issue** (via `gh issue comment` or `gh issue edit`) to explicitly declare that dependency.
5. **Pick labels.** See the rule below. Do this before drafting, because an issue that fits no existing label is usually an issue whose type you have not settled.
6. **Draft to `.tmp/issue.md` (or `.tmp/issue-<name>.md` when drafting multiple).** First line is the title, second line blank, the rest is the body. Keep drafts out of the repository root.
7. **Check approval requirement:**
   Determine the repository owner/organization:
   ```bash
   gh repo view --json owner -q .owner.login
   ```
   (Pass `<owner>/<repo>` if targeting an external repository).
   - **Auto-approved (`alexgorbatchev`):** If the owner is `alexgorbatchev`, the ticket is auto-approved. Proceed immediately to creation without prompting for review or waiting for confirmation.
   - **Review required (any other org):** If the owner is ANY other organization or user, stop and present the draft for user review. Never create the issue unprompted; wait for explicit approval before proceeding. Prohibited excuses for bypassing review: defect severity, urgency, small scope, or implied consent.
8. **Create the issue (after auto-approval or user approval):**
   ```bash
   sed '1,2d' .tmp/issue.md | gh issue create \
     --title "$(sed -n '1p' .tmp/issue.md)" \
     --label bug \
     --body-file -
   ```
   When drafting multiple issues (`.tmp/issue-<name>.md`), create each file sequentially.
9. **Update dependent issues and verify:**
   - If this new issue introduced a dependency into existing issues, ensure those existing issues are updated with the newly assigned issue number (`#<number>`).
   - Verify the labels landed, because a silently unlabelled issue is the failure this skill exists to prevent:
   ```bash
   gh issue view <number> --json number,title,labels
   ```
   Report the issue number and title. Do not paste URLs.
10. **Clean up draft files:**
    Once created and verified, remove all `.tmp/issue*` draft files to keep the workspace clean:
    ```bash
    rm -f .tmp/issue*
    ```

## Labels Are Mandatory

Every issue gets at least one label. An unlabelled issue is incomplete work.

- List what the repository actually has before choosing: `gh label list`. Use only names from that list.
- `gh issue create --label` is not documented to create missing labels, so never rely on it to invent one. When no existing label fits, propose a new label to the user with its name and one-line description, and only after they agree create it explicitly:
  ```bash
  gh label create "<name>" --description "<one line>" --color "<hex>"
  ```
- Add the type label (`bug`, `enhancement`, or the repository's equivalent) always. Add area or priority labels too when the repository maintains them.
- If the user declines a new label and none fit, say so plainly rather than filing the issue bare.

## Title Rules

The title is the whole issue compressed into one specific sentence.

- State the defect **and** its consequence: "Unresolvable placeholders in tracked file paths are discarded and the operation retargets at the cwd".
- Write plain prose, present tense. No backticks, no emoji, no `Bug:` or `[Feature]` prefix, no trailing period.
- Name the real symbol, flag, or setting. "`--libc` is registered and documented but never read" beats "CLI flag ignored".
- A title that could describe three different bugs is too vague. Rewrite it.

## Body Rules

- Open with a `## Summary` that says what the code does and what goes wrong, naming the symbols involved.
- Prove it. Cite `path/to/file.go:666` and quote the offending lines in a fenced block with its language, or show a real terminal transcript with the surprising output annotated.
- Say why it matters in user-visible terms: what a person loses, and a realistic way to reach it. Relate it to sibling issues by number when the same class of defect appears more than once.
- State the expected behavior as a requirement, not a wish.
- Offer a direction for the fix and name the test that should cover it. Stop short of writing the patch.
- Explicitly declare dependencies: if this issue depends on another issue, state `Depends on #<number>` (or `Blocked by #<number>`). If it introduces a dependency into an existing issue, update that existing issue immediately.
- Prose is present tense and factual. No changelog phrasing, no promotional filler, no AI signature, no emojis.
- Reference other issues as `#72`. Never paste URLs into issues or into your replies to the user.
