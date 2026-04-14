# Storybook Interaction Debugging

Read this file when Storybook browser tests pass with warnings, emit React `act(...)` noise, fail on modal targeting, or behave differently from real user interaction.

## Triage Order

1. Reproduce the failure on the narrowest story file.
2. Identify whether the problem is:
   - async appearance/disappearance not awaited
   - a component updating during or after keyboard interaction
   - a modal or menu without usable accessibility semantics
   - harness-only state churn
   - intentional crash/error-boundary behavior
3. Fix the component or story contract first.
4. Re-run the narrow target.
5. Re-run the broader Storybook suite.

## React `act(...)` Warnings

Treat these as correctness failures.

### Common Cause 1: Story did not await the visible transition

Symptoms:

- the story clicks or types, then asserts immediately
- the DOM updates a moment later
- warnings mention async work inside `act`

Fix:

- use `findByRole` for elements that appear later
- use `waitFor` for elements that disappear later
- assert the post-transition UI only after the transition finishes

Example pattern:

```tsx
await userEvent.click(canvas.getByRole('button', { name: 'Rename' }));
const input = await canvas.findByRole('textbox');
await userEvent.type(input, 'New title');
await userEvent.keyboard('{Enter}');
await waitFor(() => expect(canvas.queryByRole('textbox')).not.toBeInTheDocument());
await expect(canvas.getByText('Current title: New title')).toBeVisible();
```

### Common Cause 2: Enter/Escape unmounted the focused input inside the key handler

Symptoms:

- the warning happens on inline edit, rename, or inline create flows
- the component closes the active input directly in `onKeyDown` or `onKeyUp`
- the warning disappears if the interaction stops before Enter/Escape

Fix:

- do not unmount the focused input directly from the key handler
- set the intended outcome in the key handler
- call `blur()`
- let `onBlur` perform the real commit/cancel and unmount

Safer pattern:

```tsx
const blurWithCommit = (input: HTMLInputElement) => {
  shouldCommitRef.current = true;
  input.blur();
};

const blurWithCancel = (input: HTMLInputElement) => {
  shouldCommitRef.current = false;
  input.blur();
};

<input
  onBlur={() => {
    if (shouldCommitRef.current) {
      commit();
      return;
    }
    cancel();
  }}
  onKeyDown={(event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      blurWithCommit(event.currentTarget);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      blurWithCancel(event.currentTarget);
    }
  }}
/>
```

This keeps teardown on the blur path instead of tearing down the active field mid-keyboard interaction.

## Modal and Confirmation Checks

Symptoms:

- tests use `getAllByRole('button', { name: 'Delete' })[1]`
- the check depends on DOM order
- the modal is hard to scope because it lacks semantics

Fix:

1. Give the modal a dialog landmark.
2. Add `aria-modal="true"`.
3. Wire `aria-labelledby` and `aria-describedby` when title/description exist.
4. Query the dialog by role and name.
5. Query the confirm button within that dialog.

Pattern:

```tsx
const dialog = await canvas.findByRole('dialog', { name: 'Delete this item?' });
await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
```

## Harness-Only Churn

Symptoms:

- a story harness sets initial state with `useState(...)`
- then a mount-only `useEffect` immediately resets the same state again
- tests become noisy or harder to reason about

Fix:

- remove the effect
- move repeated setup into a local factory function
- initialize with `useState(createInitialValue)` when helpful

## Intentional Error-Boundary Stories

Symptoms:

- a story intentionally throws
- expected crash noise pollutes the test output before the boundary renders fallback UI

Fix:

- keep the crash harness narrowly scoped to that story
- install any temporary error-log interception before the crashing child renders
- restore the original logger on unmount
- never generalize that interception to unrelated stories or global warning handling

## Never Do This

- do not mute `console.error` globally to hide warnings
- do not suppress `act(...)` warnings instead of fixing timing or teardown
- do not rely on button index order when a semantic scope can exist
- do not leave a flaky story green merely because the assertion passed once
