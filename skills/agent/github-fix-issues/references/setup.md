## Repository and local state

Resolve the repository, GitHub host, publishing remote, and primary checkout from
the actual Git configuration and GitHub metadata. Verify the remote has `main`;
do not silently substitute another base when the requested branch is unavailable.
Read root and applicable nested repository instructions, check definitions, CI,
and commit conventions before provisioning work.

Inventory the primary checkout's status, worktrees, local and remote refs, and
existing PRs. Never overwrite, reset, stash, or stage another owner's changes.
Use `.workspaces/` for issue worktrees and `.tmp/` for scratch. Verify both are
ignored before writing; if necessary add local exclusion entries without replacing
existing entries. The persistent queue belongs to the primary checkout, not a
disposable issue worktree.

Record repository identity, remote, primary path, `main` SHA, and chosen commands
in the queue. Check the repository's protection/ruleset requirements before work:
the exact reviewed commits must be publishable to `main` by fast-forward. Do not
disable protections or use an administrator bypass to satisfy this workflow.

## Separate reviewer identity

Use the bundled `scripts/reviewer.ts` helper for identity and access checks;
do not repeat alias, environment, or dotfile discovery. It requires Bun, Git,
GitHub CLI, the implementer's existing `gh` authentication, and an exported bot
token. Keep the token outside Git configuration, files, logs, and PR content.

Resolve `reviewer_scripts` to the absolute `scripts/` directory beside this skill's
`SKILL.md`. Install its pinned CLI dependency once as the implementing agent:

```sh
bun install --cwd "$reviewer_scripts" --ignore-scripts
```

Save the user-supplied login and token **variable name** once. These example values
are placeholders; use the account and exported variable the user configured:

```sh
git config --global github-fix-issues.reviewer review-bot
git config --global github-fix-issues.tokenEnv REVIEW_BOT_TOKEN
```

Use `--local` instead of `--global` for a repository-specific override. Flags and
the two `GH_REVIEWER_*` environment settings documented in the main skill also
override saved configuration. Do not discover token names by dumping environment
variables. If configuration or the token is missing, report the named requirement.

Run from the target repository, or pass `--repo OWNER/REPO`:

```sh
bun "$reviewer_scripts/reviewer.ts" access ensure
```

The helper verifies both identities and implementer write access before checking
membership. For confirmed missing membership, it reuses the bot's matching write
invitation, or creates one with the implementer's administrator permission and
accepts it with the bot token. Organization invitations request `push`; personal
repositories omit that organization-only parameter. An invitation visible only
to the implementer stops the helper with a token-access diagnostic. Authentication,
rate-limit, forbidden, and network errors never authorize a new invitation.

It rechecks membership and the bot's write access, then lists every open issue
oldest first, excluding PRs. This listing seeds queue inspection; it does not
resolve prerequisites, inspect existing work, or replace `.tmp/github-issues.md`.
If a mutation succeeded before a later request failed, access may already exist;
rerun after fixing the reported cause. Existing permissions are never escalated.

Before every review handoff and again before reviewer submission, run:

```sh
bun "$reviewer_scripts/reviewer.ts" access ensure --pr 123 --no-issues
```

Use the actual PR number. This also checks that the verified bot differs from the
PR author. Keep default `gh` authentication as the implementer when running this
helper; it selects the bot token only in isolated subprocess environments. A
successful access check does not prove that a token can submit reviews or satisfy
additional ruleset requirements; verify the native submission and read it back.

Use the implementer's identity for implementation comments and the reviewer's
identity for its comments/reviews. Use a user-configured bot CLI wrapper or invoke
`gh` with the selected bot token only in that process's `GH_TOKEN` (or
`GH_ENTERPRISE_TOKEN` for an enterprise host). Do not switch the saved default
account. Do not have the implementing agent publish the reviewer's approval.

Ensure the review agent has this installed skill, its bundled reviewer workflow,
and the saved local reviewer configuration before handoff. Keep setup commands,
token-variable details, and reviewer instructions out of the PR. Its description
references the issue and contains the check evidence. A tool-launch message
carries only the PR locator; all task-specific coordination remains on the PR.

References: [collaborators](https://docs.github.com/en/rest/collaborators/collaborators),
[invitations](https://docs.github.com/en/rest/collaborators/invitations),
[CLI authentication environment](https://cli.github.com/manual/gh_help_environment), and
[native reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request#submitting-your-review).
