# Persistent Memory Maintenance

Persistent memory files must be maintained when the task reveals durable new guidance.

When the user course-corrects you, or when you materially change course after discovering new evidence, decide whether the learning should be written to a persistent memory file.

Use the narrowest durable location that fits:

- `{{repo_root}}/wiki/LEARNINGS.md` for durable engineering wisdom that should generalize across projects in this repository
- `ARCHITECTURE.md` at the project root for project-specific architecture or design decisions
- comments or docblocks in the code for file-local or function-local invariants, caveats, or non-obvious behavior

Do not append blindly. Prefer merging with existing guidance when the learning is already captured.

You MUST load the `persistent-memory-files` skill before editing, structuring, or compacting these memory files, and then follow its front matter, counter, and compaction rules.
