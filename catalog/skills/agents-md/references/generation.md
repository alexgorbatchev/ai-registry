# Generation workflow

Use this workflow when creating a new `AGENTS.md` or refactoring a bloated one.

## 1. Target the right artifact

Generate canonical repository `AGENTS.md` files.

Do **not** generate GitHub Copilot specialist persona files under `.github/agents/*.md` unless the user explicitly asked for those. Guidance from those files is still useful for command placement, boundaries, and examples, but the output shape is different.

## 2. Decide what information deserves space

Default rule: include only **non-inferable** or **high-leverage** details.

Include:
- custom commands not obvious from default tool conventions
- non-standard package managers or task runners
- counterintuitive patterns that agents routinely get wrong
- required setup facts that block execution
- explicit write/read boundaries and approval boundaries
- file or package examples that show the house style

Exclude:
- architecture summaries agents can reconstruct from the repo
- framework documentation
- content already stated clearly in `README.md` or dedicated docs
- style rules already enforced by linters or formatters
- aspirational guidance not reflected in the repo today

## 3. Put commands first

Commands should appear early and be copy-paste ready.

Prefer this level of specificity:

```md
## Commands
- Install: `pnpm install --frozen-lockfile`
- Lint one file: `pnpm eslint path/to/file.ts`
- Test one package: `pnpm --filter web test`
- Build docs: `pnpm docs:build`
```

Prefer file-scoped or package-scoped commands when they exist and are materially cheaper than full-repo commands.

## 4. Use concrete examples over prose

If a convention is easy to misunderstand, point to a real file or show a short snippet.

Better:

```md
## Conventions
- Copy route validation patterns from `src/api/users/create.ts`.
- Use the error wrapper from `src/lib/api-error.ts`; do not hand-roll JSON error payloads.
```

Worse:

```md
## Conventions
- Follow existing patterns and keep errors consistent.
```

## 5. Make boundaries explicit

Use a three-tier boundary model when risk exists:

```md
## Boundaries
- Always: run `pnpm test --filter api` after changing `apps/api/`
- Ask first: schema changes, dependency additions, CI edits
- Never: edit `vendor/`, commit secrets, disable failing tests to get green CI
```

Only include boundaries that are grounded in real repository risk.

## 6. Choose root-only vs root+nested

### Root only
Use when the repo is single-package or when nearly all rules are shared.

### Root + nested
Use when any of the following are true:
- multiple apps/packages/services have different commands
- stacks differ across workspaces
- test/lint/build workflows differ significantly
- directory-specific boundaries would clutter the root file

### Root file responsibilities
Keep the root file as the routing layer:
- shared commands
- shared boundaries
- shared non-obvious conventions
- navigation to nested `AGENTS.md` files or deeper docs

### Nested file responsibilities
Each nested file should contain:
- one-sentence local purpose
- local commands
- local conventions and gotchas
- local boundaries
- local references

## 7. Keep files lean without worshipping line count

Use line counts as guardrails, not as the goal.

Reasonable targets:
- single-project root: usually 40-90 lines
- monorepo root: usually 40-100 lines
- nested file: usually 20-60 lines

If the file grows because it contains genuinely high-signal, non-redundant rules, that is acceptable. If it grows because it duplicates docs or records history, split or delete.

## 8. Recommended section order

### Single-project root
1. Project purpose or scope
2. Commands
3. Setup or prerequisites if non-obvious
4. Conventions / gotchas
5. Boundaries
6. References

### Monorepo root
1. Repo scope
2. Shared commands
3. Workspace map / nested file pointers
4. Shared gotchas
5. Shared boundaries
6. References

### Nested file
1. Local purpose
2. Local commands
3. Local conventions / gotchas
4. Local boundaries
5. Local references

## 9. Compatibility files

If the repo uses adjacent instruction files or legacy names:
- prefer `AGENTS.md` as the canonical source of truth
- migrate or alias only when supported and useful
- do not overwrite existing instruction files destructively without confirmation

Example:

```bash
mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md
```

## 10. Human review is mandatory

Do not auto-generate and commit a first draft without review.

Evidence from external guidance is consistent on this point: human-curated files help, while auto-generated boilerplate tends to add cost, redundancy, and stale architecture summaries.
