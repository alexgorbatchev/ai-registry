# Bun + Tailwind v4 reference pattern

This reference captures the exact Tailwind setup used in the Bun project the skill was derived from.

## File map

- `package.json`
  - Depends on `tailwindcss@^4` and `bun-plugin-tailwind`
  - Uses `tailwind-merge` for class conflict resolution
- `bunfig.toml`
  - Registers `bun-plugin-tailwind` for Bun static-route bundling:
    ```toml
    [serve.static]
    plugins = ["bun-plugin-tailwind"]
    ```
- `server/buildChatDemoAssets.ts`
  - Imports `bun-plugin-tailwind`
  - Passes `plugins: [tailwindPlugin]` to `Bun.build(...)`
  - This is required because the repo has a manual build path in addition to `Bun.serve()`
- `dev/chat/styles.css`
  - Owns the Tailwind entrypoint for the demo app:
    ```css
    @import "tailwindcss";
    @import "../../src/theme.css";
    @source "../../src";
    @source "./";
    ```
- `src/theme.css`
  - Defines reusable semantic tokens via `@theme inline`
  - Maps Tailwind token names such as `--color-background` to CSS variables like `--background`
  - Sets default token values in `:root`
- `README.md`
  - Tells downstream consumers to:
    ```css
    @import "tailwindcss";
    @import "tool-ui-link-preview-example/theme.css";
    @source "../node_modules/tool-ui-link-preview-example/dist";
    ```

## What this architecture means

### 1. Tailwind is configured in CSS, not JavaScript

Tailwind v4 supports `@import`, `@theme`, and `@source` directly in CSS. That matches the current repo. Do not add a JS config file unless a legacy plugin/config requirement makes it unavoidable.

### 2. Bun has two separate Tailwind integration points

Use the right one for the build path you are touching:

- `bunfig.toml` covers Bun static-route / HTML bundling.
- `plugins: [tailwindPlugin]` inside `Bun.build(...)` covers explicit build scripts.

If the repo uses both paths, keep both paths wired.

### 3. Shared theme tokens belong in an exported stylesheet

`src/theme.css` is not demo-only styling. It is part of the package contract. Components use semantic utilities like `bg-card`, `text-foreground`, and `border-border`; those utilities only make sense because the theme file defines the underlying token mapping.

### 4. `@source` is part of the contract

Use `@source` whenever classes live outside the obvious local tree:

- local component source from a demo stylesheet
- demo files from a nested entrypoint
- published package output consumed from `node_modules`

If you skip this for a library, the consumer can import the package successfully and still ship missing styles.

### 5. `tailwind-merge` is used because utilities are composed dynamically

The repo exposes a `cn(...inputs)` helper that wraps `clsx` with `tailwind-merge`. Preserve that pattern when class strings can collide.

## Safe modification rules

1. Keep `@import "tailwindcss";` at the top of the entry stylesheet.
2. Keep reusable tokens in `theme.css`, not scattered across components.
3. Add or update `@source` lines whenever you move components, demos, or distribution output.
4. If you change package output layout, update consumer-facing `@source` instructions in docs.
5. After changes, run the repo build and verify Bun emitted a CSS asset for the frontend bundle.

## When to deviate

Only deviate from this pattern when you have a hard requirement the current setup cannot satisfy, and state that reason explicitly in your final report.
