# TypeScript Testing

Mandatory testing guidelines for TypeScript projects using Bun's test runner.

## Test Organization

**Before writing tests:**

- Review adjacent tests in the same `__tests__` directory for patterns and conventions
- Check existing fixtures and shared testing helpers before creating new ones
- Reuse existing testing helpers (mocks, factories, utilities) before creating new ones
- Only create new fixtures or helpers when existing ones do not meet the test requirements

**File naming and location:**

- Test files: `*.test.ts` or `*.test.tsx` in a `__tests__` directory **directly adjacent to the code being tested**
- Hook tests must preserve the source basename and extension: `hooks/useAccount.ts` requires `hooks/__tests__/useAccount.test.ts`, while `hooks/useAccount.tsx` requires `hooks/__tests__/useAccount.test.tsx`.
- Shared fixtures: a single local `./fixtures` entrypoint per test area using `fixtures.ts`, `fixtures.tsx`, or `fixtures/`
- Fixture exports: `fixture_<lowerCamelCase>` for constant fixtures and `factory_<lowerCamelCase>` for factories

The `__tests__/` area is reserved for `*.test.ts[x]`, `helpers.ts[x]`, `fixtures.ts[x]`, and `fixtures/` only.

**Colocation rule:** The `__tests__` directory must be a sibling of the source file(s) it tests. Each directory containing source files should have its own `__tests__` directory.

Example structure:

```
packages/shell-emissions/src/
├── index.ts
├── blocks/
│   ├── BlockBuilder.ts
│   └── __tests__/
│       └── BlockBuilder.test.ts
├── emissions/
│   ├── factories.ts
│   ├── guards.ts
│   └── __tests__/
│       ├── factories.test.ts
│       ├── guards.test.ts
│       └── fixtures.ts
└── renderer/
    ├── BlockRenderer.ts
    └── __tests__/
        └── BlockRenderer.test.ts
```

**Key principle:** Navigate from the source file to its test by going into the adjacent `__tests__` directory. Tests for `blocks/BlockBuilder.ts` go in `blocks/__tests__/BlockBuilder.test.ts`, not in a top-level `src/__tests__/` directory.

## Critical Rules

### No Conditional Logic in Tests

**Never use `if`, `else`, `switch`, or ternary operators in tests.** Conditionals create code paths that may skip assertions, leading to false positives.

```typescript
// ❌ BAD: If condition is false, expect() never runs
if (!result.success) {
  expect(result.message).toBe('failed');
}

// ✅ GOOD: assert() narrows type AND guarantees execution
import assert from 'node:assert';
assert(!result.success);
expect(result.message).toBe('failed');
```

Use `assert()` from `node:assert` for type narrowing without conditional execution.

### Exact String Matching

**Always verify complete string content.** Partial matches with `toContain()` or `toMatch()` can miss unexpected content.

```typescript
// ❌ BAD: May contain extra unwanted content
expect(result.message).toContain('Installation failed');
expect(result.message).toMatch(/failed/);

// ✅ GOOD: Verifies exact output
expect(result.message).toMatchInlineSnapshot(`"Installation failed"`);
expect(result.message).toBe('Installation failed');
```

Use `toMatchInlineSnapshot()` for multi-line strings or complex output.

### No Manual Throws

Do not use `throw new Error(...)` as an ad-hoc failure path inside committed tests. Use matchers, `assert(...)`, or `assert.fail(...)` instead.

### No Module Mocking

Do not mock whole modules. Inject collaborators and stub the injected dependency instead.

## Strict Prohibitions

- **DO NOT** delete or skip tests to make them pass
- **DO NOT** write tests for testing helpers
- **DO NOT** write tests that only verify static constants, raw configs, or hardcoded values (e.g., asserting a global configuration object equals its definition). However, if a constant is returned as part of a function call or dynamic logic, verify it as part of that behavioral check.
- **DO NOT** filter CLI test output in a way that hides failures or loses the test command's exit status.
- **DO NOT** use conditional logic (`if`, `else`, `switch`, ternary)
- **DO NOT** use partial string matches (`toContain`, `toMatch`)
- **DO NOT** export from test files
- **DO NOT** import runtime code from `__tests__/` into non-test modules

## Fixture Rules

- Use one local fixture entrypoint per test or story area: `fixtures.ts`, `fixtures.tsx`, or `fixtures/index.ts`.
- Declare shared fixtures and factories in `fixtures.ts[x]` files under `__tests__/` or `stories/`. Use direct `export const fixture_<lowerCamelCase>` or `export function factory_<lowerCamelCase>` declarations, with explicit concrete types imported from outside the declaration file. Do not declare local interfaces, type aliases, or enums there.
- For the directory form, keep `fixtures/index.ts` a pure re-export barrel. Re-export values from checked `fixtures.ts[x]` declaration files inside that same fixture directory, including nested owners. Use unaliased named exports or bare wildcard exports; preserve the fixture and factory binding names.
- Extensionless relative re-export sources require an existing matching `.ts` or `.tsx` declaration file. Do not point them at extensionless files or directory-only barrels, and do not end source paths with `/`.
- Keep local declarations, default exports, namespace exports, type-only exports, and `index.tsx` out of fixture barrels. Do not re-export fixtures through helpers, runtime modules, another fixture area, or arbitrary support files. Wildcard syntax does not bypass these ownership rules.
- Do not declare `fixture_...` or `factory_...` bindings inline inside consumer tests.
- Import fixtures with unaliased named imports from the same area's canonical relative `fixtures` entrypoint; do not import private declaration files directly.

Both canonical barrel forms are valid:

```typescript
// __tests__/fixtures/index.ts — named form
export { fixture_account, factory_account } from './fixtures';
```

```typescript
// __tests__/fixtures/index.ts — wildcard form
export * from './fixtures';
```

The shared lint policy checks direct relative re-export edges and fixture-like exported names. It does not resolve arbitrary package aliases, symbolic links, or transitive module graphs; inspect those boundaries explicitly rather than treating a clean lint result as proof of fixture isolation.

## Test Structure Best Practices

**Arrange-Act-Assert pattern:**

```typescript
describe('myFunction', () => {
  it('should return success when input is valid', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    assert(result.success);
    expect(result.value).toBe('test');
  });
});
```

**Type narrowing with assertions:**

```typescript
// For union types, use assert to narrow before accessing properties
type Result = { success: true; value: string; } | { success: false; error: string; };

const result: Result = functionUnderTest();

// Narrow the type
assert(result.success);

// Now TypeScript knows result.value exists
expect(result.value).toBe('expected');
```

## Common Testing Patterns

**Snapshot testing for formatted output:**

```typescript
expect(formattedOutput).toMatchInlineSnapshot(`
  "line 1
  line 2
  line 3"
`);
```

**Testing error cases:**

```typescript
it('should throw when input is invalid', () => {
  expect(() => myFunction(null)).toThrow('Invalid input');
});
```

**Array and object testing:**

```typescript
// Exact match
expect(result).toEqual({ id: 1, name: 'test' });

// Partial match (when needed)
expect(result).toMatchObject({ name: 'test' });
```

## Running Tests

For Bun projects, use the commands and recipes below, defined as in the [Bun justfile](../bun/justfile.md). For other runtimes, use the project's configured equivalents for these checks.

- Single test file: `bun test [file]`
- All tests: `just test`
- Update snapshots: `bun test --update-snapshots`
- Apply lint fixes and formatting: `just fix`

Select checks and report measured test durations under [testing and coverage](../testing-and-coverage.md). Use focused recipes for affected behavior; run aggregate `just check` only when its full scope applies.
