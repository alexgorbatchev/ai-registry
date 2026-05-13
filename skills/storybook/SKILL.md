---
name: storybook
description: Use whenever touching Storybook files.
author: alexgorbatchev
---

# Storybook

Use `packages/devhost/src/devtools/features/externalDevtoolsPanel/stories/ExternalDevtoolsPanel.stories.tsx` as the reference model for shared setup helpers and behavior-focused `play` tests.

For Storybook review-only tasks, use `{{skills_dir}}/storybook-review/SKILL.md`.

## Workflow

1. Inspect the existing Storybook and test setup before adding anything new.
   - If the repo already has Storybook browser tests, follow its conventions.
2. Pick the correct test layer before writing coverage.
   - **Pure transforms, parsers, selectors, reducers, helpers** → unit tests.
   - **Component rendering, focus, keyboard, async state, modal behavior** → Storybook stories plus `play` functions.
   - **Navigation, persistence, network stacks, multi-page flows** → end-to-end tests.
3. Represent each meaningful externally visible state or configuration with its own story.
4. Reuse an existing story when it already expresses the needed UI state. Otherwise add a story for the exact state you need.
5. Keep story harnesses deterministic.
   - Initialize state directly or via lazy `useState(() => ...)`.
   - Avoid mount-only `useEffect` resets that merely restate initial state.
   - Keep mocked callbacks and network boundaries explicit.
6. Write behavior-focused `play` tests with `within`, `userEvent`, accessible queries, and observable assertions.
7. Run the narrowest Storybook test target first, then the broader suite.
8. Treat warnings and unhandled errors as failures. Fix the root cause instead of hiding the signal.

## Coverage

Represent every meaningful component option, setting, configuration, and state with a story.

Let a user scroll through the story list and see the component in each supported state.

Prefer one story per externally meaningful state instead of hiding multiple states inside a single story.

Add a `play` test to every stateful story.

If a component is purely presentational, keep the `play` test simple and assert the rendered output directly.

Cover at least these user-visible scenarios when they exist:

- initial render and empty states
- loading, success, and error transitions
- keyboard interaction and focus management
- destructive confirmations and cancellation
- async submit, save, and delete flows
- callback payloads and visible result text
- accessibility-critical semantics for controls, dialogs, and alerts

## Story Authoring Rules

- Create one story per meaningful user-visible state: loading, empty, populated, error, destructive confirm, disabled, submitting, and similar states.
- Prefer lightweight harness components when local state is required.
- Keep harness state close to the story file unless multiple story files need the same helper.
- Expose accessible names for all interactive controls.
- Add dialog semantics to modal components so stories and tests can target them reliably.
- Keep assertions user-facing; do not assert implementation details, CSS class names, or DOM order unless that order is the product requirement.

## Play Tests

Assert the behavior that the current story is meant to demonstrate.

Do not stop at `toBeVisible()` unless visibility is the whole point of the component.

Exercise the component through realistic interactions when it has behavior: click buttons, type, focus, toggle controls, open panels, dismiss overlays, or otherwise drive the state change the story exists to show.

Assert the observable result of that interaction: changed text, pressed state, callback effects, opened or closed UI, disabled state, layout constraints, or other user-visible behavior.

Use `waitFor` around async transitions and browser-rendered state changes.

Start with `within(canvasElement)`.

Prefer `getByRole` / `findByRole` with an accessible name.

Use `findBy*` for async appearance.

Use `waitFor` for disappearance or state transitions that are not naturally expressed as appearance.

Scope follow-up queries to the relevant region, dialog, menu, or card with `within(...)`.

Use `userEvent` for clicks, typing, tabbing, and keyboard interaction.

Avoid brittle selectors such as `getAllByRole(...)[1]` when a semantic scope is available.

Never use hard-coded timeouts such as fixed `setTimeout`, `sleep`, or arbitrary delay-based waiting in stories or `play` tests.

Wait on observable browser behavior instead: rendered elements, changed attributes, callback effects, text updates, opened panels, closed overlays, or other user-visible state.

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

## Reuse

Extract repeated setup into helper functions when the story requires non-trivial rendering, provider wiring, shared DOM queries, or repeated interaction flows.

Extract repeated interaction sequences into named helpers when multiple stories exercise the same behavior with different inputs or positions.

Keep helpers focused on setup and reusable behavior. Keep the story-specific assertions inside the story `play` test unless they are truly identical across stories.

## Browser Environment

Treat Storybook `play` tests as real browser tests running through Playwright and Vitest browser mode, not JSDOM.

Use standard `storybook/test` utilities such as `within`, `userEvent`, `expect`, and `waitFor`.

Do not use JSDOM-only hacks, manual DOM event mocking, `dispatchEvent`-driven simulations, or geometry stubs like overriding `getBoundingClientRect` or `elementsFromPoint`.

If browser layout or positioning matters, assert against the real DOM and computed browser state.

## Checklist

Before finishing a story file, verify all of the following:

1. Every meaningful component state has a story.
2. Each story demonstrates one clear state or configuration.
3. Each non-trivial story has a `play` test.
4. Each `play` test exercises the behavior that story is showing.
5. Shared setup and repeated flows are extracted into helpers when the file would otherwise repeat itself.
6. Assertions prove functionality, not just presence, for interactive components.
7. No hard-coded timeouts or arbitrary delays are used.
