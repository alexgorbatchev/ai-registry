# Final checklist

Use this before finalizing a new or updated `AGENTS.md`.

## Quick pass

- [ ] Commands are early, exact, and copy-paste ready.
- [ ] Commands were run, smoke-checked, or at minimum verified against scripts/tooling.
- [ ] The file contains only repository-specific, non-inferable guidance.
- [ ] At least one real gotcha or counterintuitive pattern is documented.
- [ ] Gotchas tell the agent what to do instead, not just what went wrong.
- [ ] Boundaries are explicit where risk exists.
- [ ] Examples or example file paths beat abstract prose.
- [ ] The root file contains only shared rules.
- [ ] Nested `AGENTS.md` files exist where workspace rules diverge.
- [ ] README/framework duplication was removed.
- [ ] Linked paths resolve.
- [ ] No stale package names, paths, or commands remain.

## Automatic fail conditions

Treat the result as failed if any of these are true:

- most commands are stale or unverified
- the file is mostly generic template text
- the file duplicates framework docs or README sections
- a monorepo root file contains package-specific detail with no nested split
- critical boundaries are missing for risky areas such as secrets, deployments, or vendor/generated code

## Litmus test

Ask of every line:

> If this line is removed, is the agent materially more likely to make a mistake?

If the answer is no, cut or move it.
