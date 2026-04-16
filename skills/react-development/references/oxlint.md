# Oxlint for React Repositories

Read this file when the task involves adding, tightening, or debugging React lint rules, custom Oxlint plugins, or CI enforcement.

## Enforcement strategy

Use Oxlint for fast editor and CI feedback.

Split enforcement into two groups:

1. **Built-in rules** for generic quality and correctness
2. **Local JS plugins** for repository-specific React contracts

Prefer built-in rules when they express the requirement directly. Use a local plugin only when the rule is specific to the repository and cannot be expressed well with built-ins.

## High-value React policies to enforce

### 1. Ban `createElement` in regular application code

Use a linter rule or repo-local plugin to reject:

- `import { createElement } from 'react'`
- `React.createElement(...)`

Scope exceptions explicitly to:

- tests
- Storybook setup/mocks
- documented framework boundaries
- documented schema/plugin renderers

If the repository allows a rare production exception, require a short comment at the use site explaining why JSX is insufficient.

## 2. Enforce the test ID naming contract

If the repository uses test IDs, prefer a custom plugin for exact policy enforcement.

Example policy:

- component root: `ComponentName`
- child elements: `ComponentName--thing`
- helper components with their own tagged roots use their own names

Use a local plugin when the policy depends on component names, render branches, or JSX structure.

## 3. Scope rules by file type

Do not run React-specific rules on the whole repository.

Use `overrides` to target the file types the policy actually governs.

For repositories where every `.tsx` file is in scope for React UI policy, prefer this broad pattern so new files are not missed:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["./scripts/oxlint/reactPolicyPlugin.js"],
  "overrides": [
    {
      "files": ["**/*.tsx"],
      "rules": {
        "repo-react/no-regular-create-element": "error",
        "repo-react/require-component-root-testid": "error"
      }
    }
  ]
}
```

Use narrower globs only when the repository deliberately excludes some `.tsx` categories from the policy.

## Local plugin guidance

Implement a local plugin when the repository needs React-specific contracts that built-ins do not cover.

Concrete reference files in this skill:

- `references/reactPolicyPlugin.js` — example plugin with `no-regular-create-element` and `require-component-root-testid`
- `references/reactPolicyPlugin.test.ts` — Bun tests that run Oxlint against temp fixtures
- `references/oxlintrc.json` — scoped config example wiring the plugin into Oxlint

Typical cases:

- test ID naming derived from component names
- banning `createElement` except in scoped files
- repository-specific wrapper conventions
- enforcing root render wrappers for provider-only components

Keep plugins small and exact. One repository contract per rule is usually the right granularity.

## Rule design guidance

### `no-regular-create-element`

The rule should:

- flag `createElement` imports from `react`
- flag `React.createElement(...)`
- ignore test files and documented exception paths through config scoping, not heuristics
- report a direct message: use JSX instead of `createElement` in regular React code

### `require-component-root-testid`

The rule should:

- detect exported PascalCase components
- inspect all non-null render branches
- require exact root test IDs
- validate child test IDs against the component name
- ignore nested functions and nested classes while traversing one component body

Use a repository-level test in addition to the plugin when the rule performs AST-heavy structural checks.

## Validation workflow

When adding or changing React lint rules:

1. Run the targeted Oxlint command on the affected files first.
2. Run the plugin tests if a local plugin changed.
3. Run the type checker.
4. Run adjacent React tests.
5. Run the broader repo lint command last.

Example:

```bash
bun x oxlint -c oxlintrc.json --deny-warnings src/components
bun test scripts/oxlint/__tests__/reactPolicyPlugin.test.ts
bun x tsgo -p . --noEmit
bun test src/components --max-concurrency=1
```

## Failure policy

Do not weaken a React lint rule just to get a change through.

If the rule blocks valid code, fix one of these instead:

- the component structure
- the rule implementation
- the file scope in config
- the documented policy

Do not add blanket ignores when a scoped override or a better rule is the correct solution.
