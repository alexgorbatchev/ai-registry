# Templates

Use these as starting structures only.

Do **not** ship them verbatim. Replace placeholders with repository evidence.

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
- Always: `<safe repeated action>`
- Ask first: `<risky change>`
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
- Always: `<shared repeated action>`
- Ask first: `<shared risky change>`
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
- Ask first: database migrations, dependency additions, CI edits
- Never: modify `vendor/`, commit secrets, remove failing tests to get a green run
```

## Example-driven convention block

```md
## Conventions
- Copy API validation patterns from `apps/api/src/routes/users/create.ts`.
- Use the shared fetch wrapper from `packages/http/src/client.ts`; do not add ad-hoc `fetch()` calls in feature code.
- Keep Zod schemas next to route handlers in `apps/api/src/routes/**`.
```
