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

Obtain the reviewer login and GitHub CLI command/alias from user-provided or
repository-local configuration. Keep credentials and machine-specific shell paths
out of reusable instructions. Do not assume an alias's name proves its identity.

1. Run `gh api user --jq .login` with the implementer's credentials.
2. Run the same identity query through the configured reviewer command in the
   shell context that actually defines it. Verify the result equals the configured
   bot login and differs from the PR author. Repeat before submitting a review.
   Do not dump environment variables or tokens. If the command is unavailable or
   resolves to the wrong account, report the exact mismatch; do not search unrelated
   shell configuration or substitute the implementer's identity.
3. With authorized repository access, check
   `GET /repos/{owner}/{repo}/collaborators/{username}`. Treat authentication
   failures separately from confirmed missing access. If the configured reviewer
   is absent, invite it using `PUT /repos/{owner}/{repo}/collaborators/{username}`.
   For an organization repository request the `push` permission needed for review;
   do not grant administrator access. Reuse an outstanding invitation.
4. With the verified bot identity, inspect its repository invitations and accept
   the matching invitation using `PATCH /user/repository_invitations/{id}`. If the
   bot command cannot authenticate, leave this pending and request the missing
   access. Never accept another account's or another repository's invitation.
5. Recheck collaborator access after acceptance. Native review submission and any
   stricter repository reviewer requirements must be available before handoff.

Use the implementer's identity for implementation comments and the reviewer's
identity for its comments/reviews. Do not have the implementing agent impersonate
the reviewer by publishing an approval itself.

Configure the review agent with this skill's reviewer contract by placing it on
the PR. The PR can name the local reviewer command and expected public login, but
must not contain secrets. A tool-launch message carries only the PR locator and
an instruction to read it; all subsequent coordination remains on the PR.

References: [collaborators](https://docs.github.com/en/rest/collaborators/collaborators),
[invitations](https://docs.github.com/en/rest/collaborators/invitations), and
[native reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request#submitting-your-review).
