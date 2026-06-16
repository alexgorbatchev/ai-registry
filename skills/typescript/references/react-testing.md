# React Testing

Use this reference for React-specific testing strategy and failure analysis. Keep generic Storybook authoring, coverage, and `play`-test rules in `{{skills_dir}}/storybook/SKILL.md`.

## Scope

- Own the decision of whether coverage belongs in a unit test, a Storybook story with a `play` test, or an end-to-end test.
- Own React-specific debugging guidance for browser-tested components.
- Do not duplicate generic Storybook rules here; load the Storybook skill when changing stories or `play` functions.

## Workflow

1. Inspect the existing component test setup before adding anything new.
   - If the relevant coverage already lives in Storybook, review those stories first.
   - If setup is missing or unclear, read [react-testing-setup.md](react-testing-setup.md).
2. Pick the correct test layer.
   - **Pure transforms, parsers, selectors, reducers, helpers** → unit tests.
   - **Component rendering, focus, keyboard, async state, modal behavior** → Storybook stories plus `play` functions unless a story is intentionally excluded from Storybook test runs with `"!test"`.
   - **Navigation, persistence, network stacks, multi-page flows** → end-to-end tests.
3. If the task changes `*.stories.*` files or `play` functions, follow `{{skills_dir}}/storybook/SKILL.md` for story coverage and browser-test rules.
4. Keep React harness state deterministic.
   - Initialize state directly or via lazy `useState(() => ...)`.
   - Avoid mount-only `useEffect` resets that merely restate initial state.
   - Keep mocked callbacks and network boundaries explicit.
5. For standard test organization, colocation, and reserved test/fixture directory rules, follow the testing reference in the `typescript` skill. Keep test files private with no exports.
6. Run the narrowest relevant test target first, then the broader suite.
7. Treat warnings and unhandled errors as failures. Fix the root cause instead of hiding the signal.

## Test file and fixture rules

For standard test file constraints, conditional logic restrictions, manual throw bans, module mocking prohibitions, and fixture rules, follow the testing reference in the `typescript` skill. For React-specific tests, also apply:

- Keep committed tests runnable by default.
- Keep runtime code out of `__tests__` imports.

## React Failure Policy

- Do not suppress React `act(...)` warnings, console warnings, or unhandled errors just to make the suite green.
- Fix the component timing, teardown order, or harness wiring so the warning disappears.
- When a warning appears only in Storybook browser tests, still treat it as real unless you can prove it is a framework bug.

## High-Value Fix Patterns

- **Async mount/disappearance**: wait for the textbox, dialog, menu, or spinner to appear or disappear before asserting the next state.
- **Focused input teardown on Enter/Escape**: if pressing Enter or Escape unmounts the active input and triggers `act(...)` warnings, move commit/cancel teardown onto the blur path and let `onBlur` own the unmount.
- **Modal confirmation checks**: add `role="dialog"`, `aria-modal`, `aria-labelledby`, and optional `aria-describedby`, then query within the dialog instead of relying on button order.

## Verification Focus

- Verify that the chosen layer matches the behavior under test.
- Verify that async UI transitions settle before assertions run.
- Verify that focus management, modal semantics, and teardown order match real user behavior.
- Avoid tests that only assert static CSS, Tailwind class strings, theme token values, exact color values, xterm palettes, or full stylesheet text when those values are implementation details.
- Prefer assertions on observable behavior, accessibility state, config registration, or browser-visible interactions.
- Verify that the fix removes the warning or failure rather than hiding it.

Read these references as needed:

- [react-testing-setup.md](react-testing-setup.md) — setup and shared harness guidance
- [react-testing-debugging.md](react-testing-debugging.md) — root-cause playbook for warnings, async timing, modal targeting, and brittle story checks
