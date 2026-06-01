---
name: storybook
description: Create and update Storybook stories, story-owned fixtures, and `play` tests. Use when touching `*.stories.*` files or Storybook-driven component coverage; use `storybook-review` instead for review-only audits.
author: alexgorbatchev
---

# Storybook

For Storybook review-only tasks, use `{{skills_dir}}/storybook-review/SKILL.md`.

Treat this repository's Storybook guidance and lint rules as hard requirements for Storybook files.

## Workflow

1. Inspect the existing Storybook and test setup before adding anything new.
   - If the repo already has Storybook browser tests, follow its conventions unless they conflict with an explicit lint or policy contract.
2. Pick the correct test layer before writing coverage.
   - **Pure transforms, parsers, selectors, reducers, helpers** → unit tests.
   - **Component rendering, focus, keyboard, async state, modal behavior** → Storybook stories plus `play` functions.
   - **Navigation, persistence, network stacks, multi-page flows** → end-to-end tests.
3. Treat Storybook as the canonical component-behavior artifact when the repo is story-first.
   - Keep component structure and interaction coverage in the story layer instead of splitting the same behavior across ad-hoc story and test files.
4. Represent each meaningful externally visible state or configuration with its own story.
5. Reuse an existing story when it already expresses the needed UI state. Otherwise add a story for the exact state you need.
6. Keep story harnesses deterministic.
   - Initialize state directly or via lazy `useState(() => ...)`.
   - Avoid mount-only `useEffect` resets that merely restate initial state.
   - Keep mocked callbacks and network boundaries explicit.
7. Write behavior-focused `play` tests with `within`, `userEvent`, accessible queries, and observable assertions.
8. Run the narrowest Storybook test target first, then the broader suite.
9. Treat warnings and unhandled errors as failures. Fix the root cause instead of hiding the signal.

## Policy-Driven Story File Contract

Follow this exact shape:

- Put every `*.stories.tsx` file under a sibling `stories/` directory.
- Keep Storybook project-support TSX files under `.storybook/*.tsx` or `.storybook/**/*.tsx`; those files are Storybook harness files, not component ownership files.
- Keep each story file mapped to a sibling component ownership file by exact basename. By default use `ComponentName.tsx` with `ComponentName.stories.tsx`; when the shared config uses `FilenameStyle.DashCase`, use `component-name.tsx` with `component-name.stories.tsx`.
- Keep the owning component itself under a canonical `components/`, `templates/`, or `layouts/` directory.
- Bind the default export as a top-level typed const:

  ```tsx
  const meta: Meta<typeof ComponentName> = {
    component: ComponentName,
    title: "@scope/package/path/ComponentName",
  };

  export default meta;
  ```

- Do not use `as Meta<...>` or `satisfies Meta<...>` for the meta object. Use the const type annotation instead.
- Set `meta.title` from the package-relative story path with structural `src/` and `stories/` segments removed.
- Keep story exports limited to the approved Storybook surface. Move helpers and support code into fixture or helper modules instead of exporting them from the story file.
- Give every exported story a typed `Story` binding and a `play` function unless `meta.tags` or `story.tags` remove Storybook's built-in `test` tag with `"!test"`.
- Use the correct export shape:
  - single exported story: `const Default: Story = { ... }; export { Default as ComponentName };`
  - multiple exported stories: `export const StoryName: Story = { ... };`

Use the same typed-meta and typed-story patterns consistently; do not rely on looser local conventions.

## Coverage

Represent every meaningful component option, setting, configuration, and state with a story.

Let a user scroll through the story list and see the component in each supported state.

Prefer one story per externally meaningful state instead of hiding multiple states inside a single story.

Add a `play` test to every stateful story unless that story is intentionally excluded from Storybook test runs with `"!test"`.

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
- Keep story files under the canonical story area for the owning component instead of colocating them as loose siblings beside runtime files.
- Prefer lightweight harness components when local state is required.
- Keep harness state close to the story file unless multiple story files need the same helper.
- Move reusable helpers and shared fixtures out of the story file when they would otherwise become extra exports.
- Keep story support files inside the `stories/` area limited to `helpers.ts[x]`, `fixtures.ts[x]`, and `fixtures/`.
- Expose accessible names for all interactive controls.
- Add dialog semantics to modal components so stories and tests can target them reliably.
- Keep assertions user-facing; do not assert implementation details, CSS class names, or DOM order unless that order is the product requirement.

## Story Fixtures And Helpers

If multiple stories need shared fixtures or factories, define them in the canonical fixture support area and import them through the fixture entrypoint.

- Do not declare `fixture_...` or `factory_...` bindings inline inside consumer stories when the repo's policy requires fixture entrypoints.
- Do not reach into private fixture implementation files from stories.
- Keep fixture files focused on shared data and factories rather than story execution logic.

## Play Tests

Assert the behavior that the current story is meant to demonstrate.

Do not stop at `toBeVisible()` unless visibility is the whole point of the component.

Exercise the component through realistic interactions when it has behavior: click buttons, type, focus, toggle controls, open panels, dismiss overlays, or otherwise drive the state change the story exists to show.

Assert the observable result of that interaction: changed text, pressed state, callback effects, opened or closed UI, disabled state, layout constraints, or other user-visible behavior.

Do not write tests that only assert static CSS, Tailwind class strings, theme token values, exact color values, xterm palettes, or full stylesheet text when those values are implementation details. Prefer assertions on observable behavior, accessibility state, config registration, or browser-visible interactions.

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
