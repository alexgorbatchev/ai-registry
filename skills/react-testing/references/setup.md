# Storybook React Testing Setup

Read this file when a repository lacks a clear Storybook testing setup or when shared provider/mocking decisions are unclear.

## Baseline Decisions

1. Use the project's existing Storybook version and runner.
2. Prefer the project's existing package manager and scripts.
3. Keep Storybook responsible for component-level rendering and interaction coverage.
4. Keep unit tests for pure logic and end-to-end tests for cross-screen flows.

## Minimum Setup Shape

A solid setup usually includes:

- Storybook configured for the React framework in use
- a shared preview/annotations file for decorators and globals
- Storybook interaction testing support (`storybook/test` or the version-equivalent package already used by the repo)
- a browser-capable test runner already chosen by the repo
- shared mocks for router, theme, query client, i18n, and network boundaries

Follow the repo's installed package names instead of inventing a new stack.

## Shared Decorators

Put stable cross-story concerns in shared decorators, not inside each story:

- theme providers
- router providers
- query/data client providers
- feature flags
- global CSS or app shell wrappers
- shared network interception

Keep per-story harness state local when only one story file needs it.

## Mocking Rules

- Mock at the boundary: fetch, RPC, router, storage, timers, randomness.
- Reuse shared factories for realistic payloads.
- Keep story-specific mock data close to the story file.
- Reset mock state between tests when the runner does not already isolate it.

## Story File Structure

A reliable story file often has:

1. imported component and shared story helpers
2. local factories for initial props or harness state
3. a tiny harness when callbacks or local state must be observable
4. stories for static states
5. `play` functions only where interaction coverage matters

## Harness Guidance

- Prefer lazy initialization such as `useState(createInitialValue)` when setup is slightly expensive or repeated.
- Avoid mount-only `useEffect(() => setState(initialValue), [])` patterns unless the effect itself is the behavior under test.
- Keep harness output visible: current label, current selection, save count, delete count, pending state, last callback payload.

## Query Strategy

Use this order unless the UI gives you no better hook:

1. `getByRole` / `findByRole` with name
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` as the last resort

## Scope Strategy

- Start from `within(canvasElement)`.
- Narrow further with `within(dialog)` or `within(region)` after opening overlays or nested surfaces.
- Avoid cross-canvas global queries when a scoped query can prove the same behavior more precisely.

## Choosing Storybook vs Other Tests

Move a behavior out of Storybook when:

- it is a pure helper with no rendering contract
- it depends on many infrastructure boundaries and the component surface is incidental
- it is a full user journey across routes or browser tabs

Keep a behavior in Storybook when:

- the UI contract is the thing you care about
- the interaction should stay readable beside the story state
- the component must prove focus, keyboard, loading, confirm, or inline edit behavior
