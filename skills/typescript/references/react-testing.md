# React Testing

Use this reference for React-specific testing strategy, component logic validation, and failure analysis. For Storybook-specific interaction, visual state, and `play` tests, refer to the `storybook` skill.

## Scope

- Own the decision of whether coverage belongs in a standard unit/integration test, or in a Storybook interaction/browser test.
- Own React-specific debugging guidance for components, hook isolation, and render warnings.

## Workflow

1. Inspect the existing component and hook test setup before adding anything new.
2. Pick the correct test layer:
   - **Pure transforms, parsers, selectors, reducers, helpers, and isolated hooks** → standard unit/integration tests (using React Testing Library, hook testing utilities, etc.).
   - **Component rendering, focus, keyboard, async state, modal behavior** → use the `storybook` skill for interaction/browser tests.
3. Keep React harness state deterministic in tests:
   - Initialize state directly or via lazy `useState(() => ...)`.
   - Avoid mount-only `useEffect` resets that merely restate initial state.
   - Keep mocked callbacks and dependencies explicit.
4. For standard test organization, colocation, and reserved test/fixture directory rules, follow the testing reference in the `typescript` skill. Keep test files private with no exports.
5. Run the narrowest relevant test target first, then the broader suite.
6. Treat warnings and unhandled errors as failures. Fix the root cause instead of hiding the signal.

## Test file and fixture rules

For standard test file constraints, conditional logic restrictions, manual throw bans, module mocking prohibitions, and fixture rules, follow the testing reference in the `typescript` skill. For React-specific tests, also apply:

- Keep committed tests runnable by default.
- Keep runtime code out of `__tests__` imports.

## React Failure Policy

- Do not suppress React `act(...)` warnings, console warnings, or unhandled errors just to make the test suite green.
- Fix the component timing, state-update scheduling, or test wiring so the warning disappears.

## High-Value Fix Patterns

- **Async mount/disappearance**: wait for the element, dialog, or indicator to appear or disappear before asserting the next state.
- **Focused input teardown on Enter/Escape**: if pressing Enter or Escape unmounts the active input and triggers `act(...)` warnings in tests, move commit/cancel teardown onto the blur path and let `onBlur` own the unmount.
- **Modal confirmation checks**: add `role="dialog"`, `aria-modal`, `aria-labelledby`, and optional `aria-describedby` to the dialog element, then query within the dialog landmark instead of relying on button order.

## Verification Focus

- Verify that the chosen layer matches the behavior under test.
- Verify that async UI transitions settle before assertions run.
- Verify that focus management, accessibility semantics, and state updates match real user behavior.
- Avoid tests that only assert static CSS, Tailwind class strings, theme token values, exact color values, or full stylesheet text when those values are implementation details.
- Prefer assertions on observable behavior, accessibility state, config registration, or browser-visible interactions.
- Verify that the fix removes the warning or failure rather than hiding it.
