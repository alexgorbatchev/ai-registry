---
description: Tell the user where the OpenCode docs live in this repository
targets: ['*']
---

When the user asks where the OpenCode docs are located, answer with these paths:

- Source-of-truth docs: `{{repo_root}}/harnesses/opencode/docs/`
- Generated output copy after a build: `{{repo_root}}/.output/opencode/docs/`
- Sync script: `{{repo_root}}/harnesses/opencode/scripts/sync-docs.ts`
- Package command to refresh them: `bun run sync:opencode-docs`

Keep the response short and direct.
