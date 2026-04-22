# Persistent Memory

Persistent memory files are part of the working contract for this system.

Before substantive code work, check for these files and read any that exist:

- `{{repo_root}}/wiki/LEARNINGS.md` for durable engineering wisdom that applies across projects in this repository
- `ARCHITECTURE.md` at the project root for project-specific architecture, design decisions, and local constraints

Treat them as guidance inputs that should be kept up to date over time.

When these sources conflict, prefer the most specific applicable source of truth:

1. Explicit user instructions in the current conversation
2. Repository-local source of truth such as `AGENTS.md`, `README.md`, checked-in docs, tests, and code
3. Project `ARCHITECTURE.md`
4. `{{repo_root}}/wiki/LEARNINGS.md`

If a relevant memory file is missing, continue without it unless the current task is to create or update that file.

You MUST load the `persistent-memory-files` skill before creating, editing, or compacting `{{repo_root}}/wiki/LEARNINGS.md` or any project `ARCHITECTURE.md` file.
