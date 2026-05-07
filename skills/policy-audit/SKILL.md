---
name: policy-audit
description: Strict repository policy audit for tests, CI, pre-commit, AGENTS, and deploy or release enforcement. Use when asked to verify whether a repository's checked-in code, scripts, workflows, and docs actually define and enforce those policies, or when producing a formal audit report at `docs/internal/audit/policy.md`.
---

# Policy Audit

Use this skill for evidence-based repository policy audits that must follow a fixed rubric and produce a strict Markdown report.

## Workflow

1. Read `references/policy-rubric.md` before auditing anything. That file is the authoritative rubric.
2. Capture the current git SHA before the audit begins.
3. Inspect the repository conservatively, prefer checked-in evidence over convention, and be very diligent when changing existing documentation so you do not regress or weaken prior instructions.
4. Follow wrapper commands until the real validation, test, CI, hook, and deploy or release paths are clear.
5. Run canonical validation and test commands in a read-only manner whenever feasible.
6. After making fixes, perform a post-fix review of the changed documentation and surrounding instructions to verify there were no regressions.
7. Create `docs/internal/audit/` if it does not exist, then write the final Markdown report to `docs/internal/audit/policy.md`, including the quality checks that were run and their results.
8. Return the same Markdown report with no extra commentary.

## Reference

- `references/policy-rubric.md` contains the exact audit rules, discovery scope, required checks, and output format. Do not deviate from it.
