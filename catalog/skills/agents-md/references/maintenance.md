# Maintenance and audit workflow

Use this when `AGENTS.md` already exists.

## Goals

- keep the file current
- remove redundancy and drift
- preserve real project-specific signal
- avoid destructive rewrites unless a rebuild is clearly cheaper and safer

## Audit mode

Default to a quick audit first.

### Quick audit questions

1. Are the core commands present and runnable?
2. Do commands match current scripts/tooling?
3. Is required setup documented when it blocks execution?
4. Is at least one real project-specific gotcha documented?
5. Do gotchas include the corrective action?
6. Are implementation-affecting conventions explicit?
7. Does every line earn its keep?
8. Is the file free of framework-doc or README duplication?
9. Are linked paths and nested file references current?
10. Should some of this content move to nested files or external docs?

If the answer is “no” to several of these, the file needs real work.

## Repair order

Fix problems in this order:

1. broken or stale commands
2. stale paths, package names, or workflow references
3. contradictory rules
4. generic filler and duplicated docs
5. missing boundaries or missing non-obvious patterns
6. missing nested files for divergent workspaces

## Incremental updates beat full rewrites

Prefer targeted edits when the existing file still contains useful signal.

Rewrite from scratch only when one or more of these are true:
- the file is mostly boilerplate or template text
- most commands are wrong
- the structure fights the repository topology
- monorepo-specific detail is crammed into root and cannot be salvaged cleanly

## Validation loop

Before finalizing changes:

1. run or smoke-check the listed commands when safe and practical
2. if commands cannot be run, verify that the scripts or targets still exist
3. verify that linked paths resolve
4. verify that boundaries still match the repository state
5. verify that root and nested files do not contradict each other
6. make sure the root file points to nested files when they exist

## What to remove aggressively

Delete these unless they are truly non-obvious and repo-specific:
- “follow best practices”
- “write clean code”
- framework overviews
- full directory dumps
- stale architecture notes
- historical notes explaining past migrations
- repeated rules already enforced elsewhere

## What to preserve aggressively

Keep these when they are current:
- commands agents actually run
- failure modes that burned the team before
- intentionally weird patterns that look wrong to outsiders
- security and secrets boundaries
- approval-required changes
- package-local rules in nested files

## Reporting format for existing files

When editing an existing `AGENTS.md`, report findings before major rewrites.

Use a compact table like:

```md
## AGENTS.md audit

| File | Status | Key issues |
|------|--------|------------|
| `./AGENTS.md` | Needs update | stale test command, duplicated README guidance |
| `apps/web/AGENTS.md` | OK | missing local lint command |
```

Then propose the smallest set of changes that would make the file trustworthy again.
