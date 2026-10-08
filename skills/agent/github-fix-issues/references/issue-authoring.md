## Investigate and deduplicate

1. Confirm the target repository and whether the user requested a draft or filing.
   Use existing authorization; do not add owner-specific approval rules.
2. Search open issues with distinctive symbols, flags, or error messages:
   `gh issue list --repo OWNER/REPO --state open --search "keywords"`.
   Paginate or refine a truncated search. Read matches before deciding they differ.
   Reuse a fully covered issue; add evidence to a partially covered issue rather
   than creating a duplicate. Searching for duplicates is separate from inventorying
   the complete implementation queue.
3. Read `.github/ISSUE_TEMPLATE/` and follow the matching template. Investigate the
   responsible code and callers; distinguish observed failures from proposals.
   Cite source revisions and lines or actual command output. Do not file an
   unverified symptom as a proven defect.
4. Identify prerequisites and dependents from evidence. State `Depends on #N` and
   `Blocks #N` relationships and update the dependent tickets when a new issue
   introduces a prerequisite. Preserve native dependency relationships where used.
5. List the repository's labels and apply at least one appropriate type label.
   Reuse existing names; explicitly create an appropriate missing label within the
   authorized filing scope, respecting repository label policy. Never claim that
   passing a nonexistent name to issue creation creates a label.

## Draft and publish

Keep each draft under an owned `.tmp/` run directory. Use a separate body file and
pass it with `gh issue create --repo OWNER/REPO --title "..." --label "..." --body-file PATH`.
Use a file-writing tool to preserve Markdown and avoid shell interpolation. Do
not use heredocs. For a draft-only request, return the draft and stop before
publication; otherwise file it under the user's existing authorization.

Write a specific, present-tense title naming the defect and consequence or the
capability requested. No backticks, emoji, generic `Bug:` prefixes, or trailing
period. The body must let an unfamiliar maintainer understand the work:

| Defect | Enhancement |
| --- | --- |
| Summary: observed behavior and responsible symbols | Motivation: current behavior and its cost |
| Evidence or reproduction: source lines or recorded output | Proposed behavior: exact user-visible requirement |
| Impact: realistic route to the failure and consequence | Usage: a concrete example labeled as proposed |
| Expected behavior: requirements with acceptance criteria | Changes: affected components, tests, and documentation |
| Fix direction: scope and regression assertions, without a speculative patch | Acceptance criteria: how the behavior is verified |
| Dependencies and related issue references | Dependencies and related issue references |

Prefer `#N` for same-repository relationships. Link external specifications when
they establish requirements. Omit empty headings. Keep secrets and private details
out of drafts and published evidence.

After filing, read back the issue to verify its title, body, labels, and dependency
references. Update dependent tickets with the assigned number and update the
queue if issue implementation is in progress. Return the issue link and remove
only the exact draft files created by this operation; never delete `.tmp/issue*`
with a wildcard.
