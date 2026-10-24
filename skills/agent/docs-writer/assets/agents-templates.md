# Templates

Use these as starting structures only.

Do **not** ship them verbatim. Replace placeholders with repository evidence.

Scope testing and coverage rules to behavior-changing implementation work. For instruction-maintenance tasks and their commits/merges, record newly specified but unimplemented enforcement as follow-up work instead of requiring its implementation to complete the task. Preserve existing checks and gates; validate the actual changes. Include this scope distinction in generated guidance when instruction maintenance is a supported workflow.

For cleanup/conformance requests, rewrite the complete requested files using the full rewrite procedure in `references/agents.md`. These headings and lengths are starting points, not a content limit. Add project-specific technical sections when needed; never drop technical details because they do not fit a template. Account for every original rule and technical detail before finishing.

## Single-project root template

```md
# <project-name>

<one-sentence scope>

## Commands
- Install: `<install command>`
- Dev: `<dev command>`
- Test: `<test command>`
- Lint: `<lint or typecheck command>`

## Setup
- `<only required non-obvious prerequisite>`

## Conventions
- `<pattern to copy>`
- `<counterintuitive rule with example path>`

## Gotchas
- `<failure mode> -> <what to do instead>`

## Boundaries
- Always: automatically record explicit standing user instructions in the narrowest applicable `AGENTS.md` or existing policy file without requiring a separate request to save them; update the relevant rule in place when it changes
- Never: record task history, progress, handoffs, or dated user amendments in `AGENTS.md`
- Always (code-based projects only): For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair under the existing policy. Do not weaken coverage gates or make token test edits to satisfy this rule.
- Always: `<safe repeated action>`
- Ask first: `<risky change>`
- Never: publish releases automatically without explicit user authorization
- Never: `<forbidden zone>`

## References
- `<path or nested file>`
```

## Monorepo root template

```md
# <repo-name>

<one-sentence shared scope>

## Shared commands
- Install: `<workspace install>`
- Test all: `<workspace test>`
- Lint all: `<workspace lint>`

## Workspace map
- `apps/web/` -> `apps/web/AGENTS.md`
- `apps/api/` -> `apps/api/AGENTS.md`
- `packages/ui/` -> `packages/ui/AGENTS.md`

## Shared gotchas
- `<cross-workspace gotcha> -> <fix>`

## Shared boundaries
- Always: automatically record explicit standing user instructions in the narrowest applicable `AGENTS.md` or existing policy file without requiring a separate request to save them; update the relevant rule in place when it changes
- Never: record task history, progress, handoffs, or dated user amendments in `AGENTS.md`
- Always (code-based projects only): For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair under the existing policy. Do not weaken coverage gates or make token test edits to satisfy this rule.
- Always: `<shared repeated action>`
- Ask first: `<shared risky change>`
- Never: publish releases automatically without explicit user authorization
- Never: `<shared forbidden zone>`

## References
- `<shared doc path>`
```

## Nested package template

```md
# <workspace-name>

<one-sentence local purpose>

## Commands
- Dev: `<local dev>`
- Test: `<local test>`
- Lint: `<local lint>`

## Local conventions
- `<file or pattern to copy>`
- `<non-obvious local rule>`

## Local gotchas
- `<local failure mode> -> <fix>`

## Boundaries
- Always: automatically record explicit standing user instructions within this subtree's scope in the narrowest applicable `AGENTS.md` or existing policy file without requiring a separate request to save them; update the relevant rule in place when it changes
- Never: record task history, progress, handoffs, or dated user amendments in `AGENTS.md`
- Always (code-based projects only): For code changes that alter executable behavior, add or update meaningful behavioral tests. Require at least 90% line coverage and 90% function coverage across the non-test source of each affected first-party package; include unexecuted source files and exclude `scripts/` directories. Document and configure the coverage command, source scope, metrics, and exclusions. Reproduce a blocking baseline failure on the untouched base and handle the smallest necessary prerequisite repair under the existing policy. Do not weaken coverage gates or make token test edits to satisfy this rule.
- Ask first: `<local risky change>`
- Never: `<local forbidden zone>`

## References
- `<local doc path>`
```

## Boundary examples

Use only when true for the repository.

```md
## Boundaries
- Always: run `pnpm --filter web test` after changing `apps/web/`
- Ask first: database migrations, CI edits
- Never: publish releases automatically without explicit user authorization, modify `vendor/`, commit secrets, remove failing tests to get a green run
```

## Example-driven convention block

```md
## Conventions
- Copy API validation patterns from `apps/api/src/routes/users/create.ts`.
- Use the shared fetch wrapper from `packages/http/src/client.ts`; do not add ad-hoc `fetch()` calls in feature code.
- Keep Zod schemas next to route handlers in `apps/api/src/routes/**`.
```
