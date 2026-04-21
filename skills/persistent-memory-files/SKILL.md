---
name: persistent-memory-files
description: Read, create, update, and compact `{{repo_root}}/wiki/LEARNINGS.md` and any project `ARCHITECTURE.md` file. Use whenever a task involves consulting, editing, appending to, reorganizing, compacting, or creating those files, or when course corrections, durable lessons, or architecture decisions need to be recorded there.
author: alexgorbatchev
---

# Persistent Memory Files

Use this skill for the detailed workflow when persistent memory files need to be created, edited, or compacted. The always-on system prompt should establish that these files exist and must be maintained; this skill supplies the extra rules that are only needed during memory-file changes.

## Files And Scope

Use the narrowest durable location that fits the learning:

- `{{repo_root}}/wiki/LEARNINGS.md` for durable engineering wisdom that should generalize across projects in this repository
- `ARCHITECTURE.md` at the project root for project-specific architecture, design decisions, and local constraints
- code comments or docblocks for file-local or function-local invariants, caveats, or non-obvious behavior

When these sources conflict, prefer the most specific applicable source of truth:

1. Explicit user instructions in the current conversation
2. Repository-local source of truth such as `AGENTS.md`, `README.md`, checked-in docs, tests, and code
3. Project `ARCHITECTURE.md`
4. `{{repo_root}}/wiki/LEARNINGS.md`

If a memory file is missing, continue without it unless the current task is to create or update that file.

## Front Matter Contract

Use YAML front matter at the top of both `{{repo_root}}/wiki/LEARNINGS.md` and project `ARCHITECTURE.md`.

Recommended `{{repo_root}}/wiki/LEARNINGS.md` front matter:

```yaml
---
created_on: 2026-04-21 00:00
author: openai/gpt-5.4
source_url: null
file_kind: learnings
scope: cross-project
compaction_threshold: 10
changes_since_compaction: 0
last_compacted_at: null
---
```

Recommended `ARCHITECTURE.md` front matter:

```yaml
---
file_kind: architecture
scope: project
compaction_threshold: 10
changes_since_compaction: 0
last_compacted_at: null
---
```

Field rules:

- `created_on`, `author`, and `source_url` satisfy the wiki front matter contract in this repository
- `file_kind` identifies the file's role and should stay stable
- `scope` distinguishes cross-project guidance from project-local guidance
- `compaction_threshold` is the maximum number of substantive writebacks to accumulate before compaction should be considered
- `changes_since_compaction` counts substantive writebacks since the last compaction
- `last_compacted_at` stores the last compaction date in ISO format `YYYY-MM-DD`, or `null` if the file has never been compacted

## Read Workflow

Before substantive code work, read any relevant memory files that exist:

1. Look for `{{repo_root}}/wiki/LEARNINGS.md` when the task may benefit from cross-project engineering guidance in this repository.
2. Look for project-root `ARCHITECTURE.md` when the task may depend on project-local architecture or design decisions.
3. Apply only the entries that are relevant to the current task.
4. If a memory file is noisy, duplicated, or obviously stale, mention that to the user rather than silently trusting it.

Do not turn every task into a memory-management task. Load this skill when persistent memory is relevant, not by default.

## Writeback Workflow

When the user course-corrects you, or when you materially change course after discovering new evidence, decide whether the learning is durable enough to record.

Write it down only if it is:

- durable
- actionable
- likely to matter again

Do not record:

- one-off debugging facts
- temporary workarounds
- transient task chatter
- lessons that are already captured adequately elsewhere

When you do record a learning:

1. Choose the narrowest durable location.
2. Check whether the learning already exists and merge with the existing text instead of appending a duplicate.
3. Keep the writeback concise and concrete.
4. Update `changes_since_compaction` in the same edit.
5. If the file did not exist, create it with the front matter above and initialize `changes_since_compaction` to reflect the new writeback.

## Compaction Workflow

Compaction is a cleanup pass that preserves meaning while reducing noise.

Trigger compaction when any of the following are true:

- `changes_since_compaction >= compaction_threshold`
- the file has substantial duplication or contradictions
- the file has drifted into iteration history instead of durable guidance

During compaction:

1. Preserve all still-valid guidance.
2. Merge duplicates and near-duplicates.
3. Remove stale or superseded items when the newer rule fully replaces them.
4. Rewrite for clarity and durable use, not as a changelog.
5. Reset `changes_since_compaction` to `0`.
6. Set `last_compacted_at` to today's date in `YYYY-MM-DD` format.

If the threshold has been reached during another task, prefer telling the user that compaction is due before appending more guidance unless the user clearly wants you to proceed immediately.

## Writing Style

- Prefer short, operational rules over abstract slogans.
- State the rule directly.
- Add a brief reason only when it helps future readers apply the rule correctly.
- Keep architecture notes as decisions and constraints, not generic advice.
- Keep `{{repo_root}}/wiki/LEARNINGS.md` as general wisdom, not project-specific notes.
