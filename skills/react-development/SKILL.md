---
name: react-development
description: Must be used any time React code is touched.
author: alexgorbatchev
---

# React Development

Use existing React patterns before introducing new ones. Preserve accessibility, composability, and readable JSX.

## Workflow

1. Inspect the existing component, shared primitives, hooks, stories, and nearby tests before editing.
2. Reuse an existing component or hook when one already expresses the pattern.
3. Keep rendering in JSX. Extract helpers or hooks instead of switching to `createElement`.
4. Apply the test ID contract exactly when a tagged element is needed.
5. Continuously compare the touched UI against nearby views and pages for repeated layout, color, sizing, spacing, typography, and state styling patterns.
6. Run the narrowest relevant type and test validation first, then broader test commands.

## Non-negotiable rules

### 1. Use the test ID contract exactly

Apply these rules exactly unless the repository documents a different contract:

- Use the plain component name on the root rendered element of a component.
- Use `ComponentName--thing` for tagged child elements inside that component.
- Use kebab-case for `thing`.
- Use semantic targets, not positional names.
- Use the local helper component name when a helper component renders its own tagged root.
- Do not invent `--root` or other suffixes on the root unless the repository explicitly requires them.

Valid:

```tsx
export function PlanChat() {
  return (
    <section data-testid='PlanChat'>
      <div data-testid='PlanChat--thread-viewport' />
    </section>
  );
}
```

```tsx
function ReasoningPart() {
  return <ToolCallCard testId='ReasoningPart' />;
}
```

Invalid:

```tsx
<section data-testid='PlanChat--root' />
```

```tsx
<div data-testid='thread-viewport' />
```

```tsx
function ReasoningPart() {
  return <ToolCallCard testId='PlanChat--reasoning-card' />;
}
```

Prefer accessible queries in tests. Add `data-testid` only when the element is not reliably targetable through role, label, text, or stable semantic structure.

### 2. Keep regular React code in JSX

Do not use `createElement` or `React.createElement` in ordinary application code.

Use JSX for:

- normal component bodies
- conditional rendering
- lists and mapping
- wrapper composition
- provider trees
- tool or widget registries that can be expressed directly in JSX

Allow `createElement` only when a specific domain constraint requires it and that requirement is documented explicitly at the use site or in adjacent documentation. Typical exceptions are rare and include cases such as:

- schema-driven renderers
- AST or MDX renderers
- plugin systems that receive component types dynamically
- framework integration points that require raw element factory calls

Do not introduce `createElement` just to:

- avoid JSX syntax
- build dynamic props more mechanically
- mimic framework internals
- shorten code that JSX already expresses clearly

When an exception is truly required, isolate it, document why JSX is insufficient, and test it.

## Component design rules

- Prefer function components and hooks over class components unless the codebase already requires a class boundary.
- Keep props narrow and typed.
- Expose supported visual choices through typed props owned by the component, such as `variant`, `size`, `tone`, `density`, `layout`, or explicit state props. Do not expose `className` or `style` from app or feature components as public styling escape hatches.
- Use direct `style={...}` only for dynamic geometry that cannot be represented statically. Do not use inline styles for ordinary colors, spacing, typography, state styling, or other static presentation choices.
- Treat any file rendering a React component imported from another module or package as a consumer. Product-surface consumers must not pass `className` or `style` to imported components to change spacing, size, color, typography, layout, or state styling. Add or extend a named variant on the owning component instead.
- Use `startEnhancer` and `endEnhancer` prop names for optional leading and trailing visual slots around a component's main content. Do not invent one-off names like `leftIcon`, `rightElement`, `prefix`, `suffix`, or `actionSlot` for this shape unless the surrounding codebase already standardizes on them.
- Extract pure transforms into helpers instead of embedding large calculations in render.
- Extract repeated stateful behavior into hooks only when more than one caller needs it or the component becomes hard to read.
- Reuse shared primitives for buttons, inputs, dialogs, cards, and layout shells before adding one-off markup.
- Keep render branches explicit. Make loading, empty, error, and success states easy to read.
- Preserve accessible names and roles when refactoring structure.

Use this pattern for buttons, inputs, list rows, menu items, cards, and other components with symmetric leading or trailing adornments:

```tsx
interface ActionButtonProps {
  children: React.ReactNode;
  startEnhancer?: React.ReactNode;
  endEnhancer?: React.ReactNode;
}

export function ActionButton({ children, startEnhancer, endEnhancer }: ActionButtonProps) {
  return (
    <button type='button' data-testid='ActionButton'>
      {startEnhancer ? <span data-testid='ActionButton--start-enhancer'>{startEnhancer}</span> : null}
      <span data-testid='ActionButton--label'>{children}</span>
      {endEnhancer ? <span data-testid='ActionButton--end-enhancer'>{endEnhancer}</span> : null}
    </button>
  );
}
```

Keep enhancers presentation-oriented. If the trailing element is the component's primary action, expose a named command prop such as `onRemove` or compose a separate action component instead of hiding behavior inside `endEnhancer`.

## Code organization rules

- Organize code by feature or domain folders.
- Name component files in PascalCase or kebab-case, matching the exported component name when the file primarily defines one component.
- Name hook files in camelCase or kebab-case, matching the exported hook name when the file primarily defines one hook.
- Keep each component story under a sibling `stories/` directory with a matching basename when the repo uses Storybook coverage.
- Keep hook tests in a sibling `__tests__/` directory with a matching basename.
- Keep raw intrinsic JSX and direct styling props inside component ownership files when the repository separates component-owned TSX from consumer TSX.
- Do not dump unrelated modules into broad `lib/` directories.
- When `lib/` is necessary, keep it for shared infrastructure and move feature-specific code into named subfolders such as `lib/githubExtraction/` or `lib/youtubeExtraction/`.

## Continuous UI consistency

Treat UI consistency as an ongoing process while working in React code, not as a final one-time cleanup pass.

- Review touched app and feature components for inline `style`, consumer-side `className`, repeated wrapper markup, and duplicated layout or visual constants.
- Compare related views and pages for consistency in layout structure, colors, spacing, sizing, typography, density, border treatment, and loading, empty, error, hover, active, and selected states.
- When the same visual or structural pattern appears in more than one place, extract it into a shared component, shared primitive variant, or component-owned prop before adding another one-off implementation.
- Prefer existing shared primitives for common surfaces such as buttons, inputs, dialogs, cards, menus, lists, toolbars, page shells, and layout regions.
- Extend shared primitives through named variants or explicit props when product needs diverge in a supported way; do not fork near-identical components or push design differences into call-site styling.

## Review checklist

Before finishing a React change, verify all of the following:

- root test IDs use the plain component name
- child test IDs use `ComponentName--thing`
- helper components with their own tagged roots use their own names
- visual design choices use typed component-owned props, not app or feature component `className` or `style` escape hatches
- direct `style={...}` is limited to dynamic geometry that cannot be represented statically
- product-surface consumers do not pass `className` or `style` to imported components for spacing, size, color, typography, layout, or state styling
- optional leading and trailing visual slots use `startEnhancer` and `endEnhancer`
- feature-specific modules live in named feature or domain folders instead of a broad unrelated `lib/` dump
- component files match the exported component name and hook files match the exported hook name
- repeated inline styles, consumer-side class names, wrapper markup, and visual constants were evaluated for extraction into shared components or variants
- touched views and pages remain consistent in layout, colors, spacing, sizing, typography, and component states
- no new `createElement` usage was introduced without an explicit documented exception
- shared primitives were reused where appropriate
- accessible queries remain possible for user-facing controls
- relevant stories, type checks, and tests were run

## Companion skills

Use related skills when the task goes deeper in those areas:

- `react-testing` for Storybook stories, play functions, and interaction coverage
- `typescript-code-quality` when TypeScript structure and type-safety rules matter heavily
