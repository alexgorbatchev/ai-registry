---
name: react-testing
description: >-
  Test React components through Storybook stories and interaction tests. Use
  when creating or fixing component stories, writing play functions, replacing
  brittle component-only tests with Storybook-owned coverage, debugging
  Storybook browser test failures, React act warnings, accessibility-query
  problems, modal/dialog interactions, async UI states, or deciding whether a
  behavior belongs in Storybook, lower-level unit tests, or end-to-end tests.
---

# React Testing

Use Storybook to validate user-visible component states and interactions. Keep pure logic in unit tests and keep cross-page or browser-system flows in end-to-end tests.

## Workflow

1. Inspect the existing Storybook and test setup before adding anything new.
   - If the repo already has Storybook browser tests, follow its conventions.
   - If setup is missing or unclear, read `references/setup.md`.
2. Pick the correct test layer.
   - **Pure transforms, parsers, selectors, reducers, helpers** → unit tests.
   - **Component rendering, focus, keyboard, async state, modal behavior** → Storybook stories plus `play` functions.
   - **Navigation, persistence, network stacks, multi-page flows** → end-to-end tests.
3. Reuse an existing story when it already expresses the needed UI state. Otherwise add a story for the exact state you need.
4. Keep story harnesses deterministic.
   - Initialize state directly or via lazy `useState(() => ...)`.
   - Avoid mount-only `useEffect` resets that merely restate initial state.
   - Keep mocked callbacks and network boundaries explicit.
5. Write the interaction with `userEvent` and accessible queries.
6. Run the narrowest Storybook test target first, then the broader suite.
7. Treat warnings and unhandled errors as failures. Fix the root cause instead of hiding the signal.

## Story Authoring Rules

- Create one story per meaningful user-visible state: loading, empty, populated, error, destructive confirm, disabled, submitting, etc.
- Prefer lightweight harness components when local state is required.
- Keep harness state close to the story file unless multiple story files need the same helper.
- Expose accessible names for all interactive controls.
- Add dialog semantics to modal components so stories and tests can target them reliably.
- Keep assertions user-facing; do not assert implementation details, CSS class names, or DOM order unless that order is the product requirement.

## Play Function Rules

- Start with `within(canvasElement)`.
- Prefer `getByRole` / `findByRole` with an accessible name.
- Use `findBy*` for async appearance.
- Use `waitFor` for disappearance or state transitions that are not naturally expressed as appearance.
- Scope follow-up queries to the relevant region, dialog, menu, or card with `within(...)`.
- Use `userEvent` for clicks, typing, tabbing, and keyboard interaction.
- Avoid brittle selectors such as `getAllByRole(...)[1]` when a semantic scope is available.

## Warning and Failure Policy

- Do not suppress React `act(...)` warnings, console warnings, or unhandled errors just to make the suite green.
- Fix the component or story timing so the warning disappears.
- When a warning appears only in Storybook, still treat it as real unless you can prove it is a framework bug.
- If a story intentionally exercises an error boundary, keep any error-log handling narrowly scoped and install it before the crashing child renders; effect-time interception is too late for render-time crashes.

## High-Value Fix Patterns

- **Async mount/disappearance**: wait for the textbox, dialog, menu, or spinner to appear or disappear before asserting the next state.
- **Focused input teardown on Enter/Escape**: if pressing Enter or Escape unmounts the active input and triggers `act(...)` warnings, move commit/cancel teardown onto the blur path and let `onBlur` own the unmount.
- **Modal confirmation checks**: add `role="dialog"`, `aria-modal`, `aria-labelledby`, and optional `aria-describedby`, then query within the dialog instead of relying on button order.
- **Story harness churn**: remove mount-only `useEffect` state resets that duplicate initial state.
- **Expected crash stories**: keep crash noise scoped to the story harness instead of muting logging globally.

## What To Cover

Use Storybook interaction coverage for:

- initial render and empty states
- loading, success, and error transitions
- keyboard interaction and focus management
- destructive confirmations and cancellation
- async submit/save/delete flows
- callback payloads and visible result text
- accessibility-critical semantics for controls, dialogs, and alerts

Read these references as needed:

- `references/setup.md` — setup and shared harness guidance
- `references/debugging.md` — root-cause playbook for warnings, async timing, modal targeting, and brittle story checks
