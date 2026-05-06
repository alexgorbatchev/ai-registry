---
name: self-hosted-gitea
description: Create and manage private repositories on self-hosted Gitea instances using Tea CLI and direct Gitea credential or API workflows. Use when asked to create a repo, make a "tea repo", inspect Tea logins, check whether a repo exists, configure or update `origin`, push local branches, or verify remote repository state.
author: alexgorbatchev
source: "{{file_path}}"
---

# self-hosted-gitea

Use this workflow for self-hosted Gitea repository creation and initial push.

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

Prefer existing git credentials instead of asking the user for tokens first.

```bash
printf 'protocol=https\nhost=<gitea-host>\n\n' | git credential fill
```

Extract `username` and `password` from that result and use them for Gitea API calls.

If credentials are missing or invalid, stop and ask the user.

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
- If `origin` points somewhere else, stop and ask before replacing it.

## Pre-Push Safety Check

Before pushing, check whether the local repo is reasonable to publish as git history.

```bash
git count-objects -vH
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr | head
```

If the repository contains generated outputs, secrets, browser profiles, huge media, or multi-GB git objects:
- do not blindly push
- inspect the largest tracked blobs
- explain the issue to the user
- ask before any destructive cleanup or history rewrite

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
