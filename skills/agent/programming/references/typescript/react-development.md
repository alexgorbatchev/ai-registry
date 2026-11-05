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
- Treat a file rendering an imported styled product component as its consumer. Do not pass `className` or `style` to that component to change spacing, size, color, typography, layout, or state styling. Add or extend a named variant on the owning component instead. A runtime component implementation may establish its own styling through a verified unstyled native primitive under the contract below.
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

### Native primitive styling ownership

When the repository uses the shared TypeScript policy, style a Base UI native primitive only inside a runtime component ownership file under `components/`, `templates/`, or `layouts/`. Story, test, hook, fixture, and other support files do not gain this allowance; existing raw DOM styling allowances remain separate.

- Verify the installed `@base-ui/react` version is **1.9.0** and the import names an exact public primitive or part reviewed by the shared policy. Do not assume every package export is a native primitive or infer ownership from a familiar JSX name. Unsupported versions and symbols require shared-policy work, not a consumer allowlist or lint suppression.
- Preserve import provenance and lexical scope. Named and renamed imports qualify when they resolve to a reviewed export; default imports, type-only imports, local wrapper aliases, shadowed bindings, and product component re-exports do not. Recognition of namespace imports in the policy does not relax the TypeScript conventions against introducing them.
- Use Base UI's documented [`className` and `style` APIs](https://base-ui.com/react/handbook/styling), including state callbacks. Keep ordinary presentation in classes and reserve direct `style` for dynamic geometry as required above.
- When explicit styling accompanies a [`render` prop](https://base-ui.com/react/handbook/composition), require every visible render link to end in an intrinsic element or another verified native primitive. JSX and resolvable const element aliases can establish that terminal. Do not style a product component through a native wrapper or assume an unknown callback, props-supplied target, or unknown later spread establishes ownership. Composition without explicit styling remains available.
- If package identity, symbol provenance, or the render terminal cannot be verified, keep the styling restriction and resolve the missing contract. Do not rename imports, relocate product code into support roles, or add wrappers to evade it.

## Code organization rules

For general TypeScript file naming, export patterns, and ownership-location rules (including custom hook directories and test/story reserved directories), follow [TypeScript conventions](conventions.md). Apply these React-specific rules:

- Organize code by feature or domain folders.
- Keep component ownership `.tsx` files under canonical `components/`, `templates/`, or `layouts/` directories.
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
- consumers do not pass `className` or `style` to imported styled product components for spacing, size, color, typography, layout, or state styling
- native primitive styling has a verified supported package, symbol, runtime owner, and intrinsic or native render terminal
- optional leading and trailing visual slots use `startEnhancer` and `endEnhancer`
- feature-specific modules live in named feature or domain folders instead of a broad unrelated `lib/` dump
- component files and hook files match the exported names in the repo's configured filename style
- repeated inline styles, consumer-side class names, wrapper markup, and visual constants were evaluated for extraction into shared components or variants
- touched views and pages remain consistent in layout, colors, spacing, sizing, typography, and component states
- no new `createElement` usage was introduced without an explicit documented exception
- shared primitives were reused where appropriate
- accessible queries remain possible for user-facing controls
- relevant stories, type checks, and tests were run
