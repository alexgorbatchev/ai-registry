---
name: gitea
description: Create and manage Gitea repositories and inspect Gitea Actions using Tea CLI and direct Gitea credential or API workflows. Use when asked to create a repo, make a "tea repo", inspect Tea logins, check whether a repo exists, configure or update a Git remote, push local branches, verify remote repository state, or diagnose CI or workflow failures on a Gitea host.
author: alexgorbatchev
metadata:
  created_on: 2026-05-06 11:40
  last_modified: 2026-10-16 16:42
  status: current
---
# gitea

Use this workflow for Gitea repository creation, initial push, and Gitea Actions CI inspection.

## Non-negotiable rule

- Always create repositories as **private**.
- Do not create or suggest public repositories on self-hosted Gitea hosts.

## Tea CLI workflow

When the user asks for a "tea repo" or otherwise references Tea, use the `tea` CLI before trying raw Git credentials or direct Gitea API calls.

1. Inspect available logins:

```bash
tea logins
```

2. Pick the matching login and host. Prefer the configured user login for the target host unless the user names another Tea login.
3. Check whether the repo already exists:

```bash
tea repos --login <login> --output json <owner>/<repo>
```

4. If missing, create it as private:

```bash
tea repos create --login <login> --name <repo> --private
```

Rules:
- For user-owned repos under the logged-in user, omit `--owner`; Tea may treat `--owner <user>` as an org lookup and fail with `GetOrgByName`.
- Use `--owner <org>` only for org-owned repositories.
- If Tea has no usable login, then fall back to the credential/API workflow below.

## Authentication

Use existing configured Tea authentication or the credential-store entry for the
verified target host. Capture credential-helper output inside a private process
context; never emit the full output, passwords, or tokens into tool results,
logs, or reports. If authentication is missing or invalid, record the named
requirement and suspend only remote-dependent actions. Continue authorized local
preparation and independent work under the blocker protocol. Request the missing
access through the approved configuration channel; never ask for secrets in chat
or invent credentials.

For the API examples below, derive `user` and `pass` from the captured `username`
and `password` fields within that private process context.

## Gitea Actions CI Inspection

Use the Gitea API when checking workflow failures on a Gitea host.

Do not assume GitHub tooling works:
- `gh run ...` usually cannot resolve non-GitHub remotes unless the host is explicitly configured for GitHub-compatible access.
- `tea actions ...` is acceptable only when a login already exists; if it reports no available login, use the API with existing git credentials instead of asking for a token first.

Keep identifying information out of reports and skill updates:
- Do not paste actor email addresses, personal names, avatars, full credential-helper output, or tokens.
- Redact internal runner or container names unless they are necessary to explain the failure.
- Prefer run IDs, job IDs, commit SHAs, step names, and sanitized error text.

Workflow:
1. Identify `<owner>`, `<repo>`, and `<branch>` from the remote and the request context.
2. Use credentials from the Authentication section.
3. List recent runs:

```bash
curl -fsS -u "$user:$pass" \
  'https://<gitea-host>/api/v1/repos/<owner>/<repo>/actions/runs?limit=10&branch=<branch>'
```

4. Inspect jobs for the failing run:

```bash
curl -fsS -u "$user:$pass" \
  'https://<gitea-host>/api/v1/repos/<owner>/<repo>/actions/runs/<run-id>/jobs'
```

5. Download logs for the failing job:

```bash
curl -fsS -L -u "$user:$pass" \
  'https://<gitea-host>/api/v1/repos/<owner>/<repo>/actions/jobs/<job-id>/logs'
```

6. Report only the durable failure signature: workflow name, run ID, job or step name, failing command, commit SHA, and minimal sanitized error text.

Known failure pattern to recognize:
- During `bun install --frozen-lockfile`, Bun may resolve a Git dependency through the Gitea API host and fail with a 404 shaped like `/api/v1/repos/<external-owner>/<external-repo>/tarball/<sha>`.
- Treat this as dependency-resolution or CI-environment behavior, not as proof that the external dependency SHA is missing.
- Prefer a dependency form or CI environment fix that forces direct resolution from the external source; do not paper over it with a compatibility shim.

## Create Repository

1. Determine the owner and repo name.
   - If the user explicitly names an owner, use that owner.
   - Prefer the current repo name or `package.json` name as the repo name when that is the obvious match.
2. Check whether the remote repo already exists:

```bash
curl -u "$user:$pass" https://<gitea-host>/api/v1/repos/<owner>/<repo>
```

3. If it does not exist, create it with the Gitea API:

```bash
curl -u "$user:$pass" \
  -H 'Content-Type: application/json' \
  -X POST https://<gitea-host>/api/v1/user/repos \
  --data '{"name":"<repo>","private":true,"auto_init":false}'
```

Requirements:
- `private` must be `true`
- `auto_init` should be `false` when pushing an existing local repo

## Configure Local Remote

Use this remote URL shape:

```bash
https://<gitea-host>/<owner>/<repo>.git
```

Rules:
- If `origin` is absent, add it.
- If `origin` already points to the same URL, keep it.

If origin points elsewhere, inspect the current remote, ownership, and requested
destination. An explicit instruction or standing grant to replace that specified
remote authorizes the operation without another confirmation. Verify the intended
destination and preserve unrelated remotes. If replacement is not authorized or
the destination remains ambiguous, preserve origin, record the conflict and
required decision, and suspend only the remote mutation and dependent publication.
Do not infer replacement permission from a request to publish alone.

## Pre-Push Safety Check

Before pushing, check whether the local repo is reasonable to publish as git history.

```bash
git count-objects -vH
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr | head
```

If the repository contains generated outputs, secrets, browser profiles, huge media, or multi-GB git objects:
- do not blindly push
- inspect the largest tracked blobs

Inspect the publication risk and report the concrete finding without exposing
secrets. Before destructive cleanup or history rewriting, verify the exact
affected paths or refs, ownership, and authorization. Use an existing explicit
grant for those operations without asking again. Otherwise preserve the
repository, prepare the reviewable repair, and suspend only the destructive
action and dependent publication pending the missing authorization. Never delete
session data or another owner's work, and never treat publication approval as
permission to rewrite history.

Useful inspection command:

```bash
git rev-list --objects --all |
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  awk '$1=="blob" {print $3 "\t" $4}' |
  sort -nr | head -20
```

## Push

Push only after the safety check passes or the user explicitly approves the trade-off.

```bash
git push -u origin <branch>
```

If git prompts or hangs because auth is not being reused correctly, retry with an explicit auth header derived from the credential store instead of changing the saved remote URL.

## Verify

After creation/push, verify:
- `git remote -v`
- `git branch -vv`
- `git ls-remote --heads origin`
- remote repo exists at `https://<gitea-host>/<owner>/<repo>`

## Report Back

State clearly:
- repo URL
- visibility: private
- whether `origin` was added or reused
- whether the branch was pushed successfully
- any blockers that still require user action
