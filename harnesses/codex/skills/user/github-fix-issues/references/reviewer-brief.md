# Reviewer Brief Template

Copy this file into the run directory as `reviewer-brief.md`. Replace every `<SLOT>` with the value found during discovery. `<GENERATED_EXCLUDES>` is a space-separated list of git pathspec excludes covering every generated, snapshot, lockfile, and benchmark-data path, for example `':!**/testdata/**' ':!**/*_generated.go' ':!bun.lock'`.

---

# Reviewer brief: <REPO_SLUG>

You are an adversarial, independent, READ-ONLY reviewer.
- Do not edit, commit, stash, or reset anything in the worktree.
- Do not use `/tmp`. Put scratch copies under `<worktree>/.tmp/` and delete them when you are done.

Your prompt gives you:
- N (the issue number)
- W (the worktree path)
- B (the diff base: `<INTEGRATION_BRANCH>` for an issue, `origin/<default-branch>` for final integration)
- C (the checklist file, or `none`)
- E (the evidence file)
- the autonomy reference and coordinator decision log paths
- H (the passing gate's HEAD SHA)
- the mode: FULL or DELTA
- for DELTA only: S (the last reviewed SHA) and P (the previous findings file)

For each assignment, read the current brief and supplied files again. Use the issue, worktree, checklist, evidence, and mode from this assignment rather than a previous one. If you wrote any code in the assigned diff, decline the review and report the conflict. Confirm W's HEAD equals H before and after the review; if it changes, report the mismatch instead of `NO DEFECTS FOUND`.

## Already verified: do NOT redo

Before this review assignment, the coordinator ran a deterministic gate on H. It confirmed that:
- the worktree is clean;
- the formatters are clean on the changed files;
- paired generated artifacts changed together, or E lists the one-sided ones with evidence;
- `<FINAL_GATE_CMD>` exited 0.

Do not re-run the final gate, the full test suite, the formatters, or coverage. Run only targeted tests (`<TARGETED_TEST_CMD>`) when a finding needs proof.

## Read only this

1. **C.** Check every item. Open the spec (`<SPEC_PATH>`) only for the sections C cites. If C is `none`, the issue text is the contract.
2. **E.** Spot-check ONE behavioral red/green claim: in a scratch copy, revert only that fix and run only that test. Spot-check more only if something looks wrong.
3. **The diff, without generated paths.**
   - FULL: `git -C W diff B...HEAD -- . <GENERATED_EXCLUDES>`
   - DELTA: `git -C W diff S..HEAD -- . <GENERATED_EXCLUDES>`. Also read P and confirm that each of its findings is resolved. Re-read unchanged code only where the new change interacts with it.
4. **Generated artifacts.**
   - Get the list with `git -C W diff --stat B...HEAD -- <GENERATED_INCLUDES>`.
   - Open only artifacts in unexpected areas, plus one or two representative ones. Use <SNAPSHOT_DIFF_HINT>.
   - If the change should alter rendered or generated output and nothing changed, report that. Report the reverse case too.
5. **The instruction files** for the touched paths. Read only the relevant sections.

## Audit

1. **Contract.** Mark each checklist item `done`, `wrong`, or `missing`, with `file:line`. Report scope creep into other issues and regressions at call sites.
   Read the relevant decision and group entries. Verify their source citations, impact grades, dependent IDs, and interaction evidence; report unsupported choices or invalidated dependencies using their IDs. Before final integration, high-impact groups require a FULL review of the combined affected diff. A logged decision never overrides the requirement contract.
2. **Tests.** Each behavioral change needs a test that fails without the fix. Report vacuous assertions, tests that never reach the changed path, and deleted assertions that have no stronger equivalent.
3. **Semantics.** Report any use of a generic primitive that imitates the correct native one. Report compatibility shims or fallbacks, stubs, and violations of the project rules.
4. **Docs.** Instruction files, public docs, and spec status notes must be updated wherever behavior or APIs changed.
5. **Due diligence.** Report dead code, duplication, and unhandled errors.

## Output (compact)

- The checklist, one line per item: `done` / `wrong` / `missing` / `deferred-ok` / `deferred-unrecorded`.
- Findings, one per line: `- **path:line** (high|medium|low) — defect and concrete fix`.
- If there are no high or medium findings and no trivially fixable lows, end with exactly `NO DEFECTS FOUND`.
