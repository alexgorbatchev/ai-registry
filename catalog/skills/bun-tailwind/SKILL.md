---
name: bun-tailwind
description: >-
  Tailwind CSS v4 workflow for Bun projects that use Bun.serve or Bun.build,
  CSS-first configuration, shared theme.css token files, and package-consumer
  scanning via @source. Use when adding Tailwind to a Bun app, fixing missing
  utilities in Bun-built assets, defining Tailwind v4 theme tokens with @theme,
  or documenting how consumers must import and scan a Bun component library.
---

# Bun Tailwind

Preserve the current Bun + Tailwind v4 architecture: Bun owns bundling, Tailwind is configured in CSS, and shared design tokens live in an exported stylesheet instead of a JavaScript config.

## Read this first

Before changing Tailwind wiring, read `references/setup.md`. It captures the exact pattern already used in the Bun project this skill was derived from.

## Workflow

1. **Identify the build path first.**
   - **`Bun.serve()` static/HTML routes:** configure `bun-plugin-tailwind` in `bunfig.toml` under `[serve.static].plugins`.
   - **Manual `Bun.build()` calls:** import `bun-plugin-tailwind` in the build script and pass `plugins: [tailwindPlugin]`.
   - **Published library consumption:** export the library theme stylesheet and document the consumer-side `@source` requirement.

2. **Keep Tailwind configuration CSS-first.**
   - Start the entry stylesheet with `@import "tailwindcss";`.
   - Use `@theme` for design tokens and `@source` for scan roots that Tailwind will not reliably discover automatically.
   - Do **not** introduce `tailwind.config.*` unless forced by a legacy integration that cannot be expressed with Tailwind v4 CSS directives.

3. **Separate theme tokens from app/demo entry CSS.**
   - Put reusable semantic tokens in a standalone file such as `src/theme.css`.
   - Use `@theme inline` when mapping Tailwind theme tokens to CSS custom properties.
   - Import that theme file from app/demo stylesheets and from package consumer examples.

4. **Handle scanning explicitly when code lives outside the immediate entrypoint tree.**
   - Add `@source` lines for component source directories, demo directories, or published package output directories.
   - This is mandatory for libraries: consumer apps will miss packaged utility classes unless their stylesheet scans the installed package.

5. **Author components with utility classes, not bespoke CSS layers.**
   - Keep styling in JSX/TSX class strings where practical.
   - For conditional class composition, prefer a helper built from `clsx` + `tailwind-merge`.
   - Keep raw CSS for tokens, resets, and exceptional cases where utilities are the wrong tool.

6. **Validate the entire pipeline after every Tailwind change.**
   - Run the repo's dev or build command.
   - Confirm a CSS asset is emitted for Bun-built frontend assets.
   - Verify classes used in components and demos are present in the output.
   - If the package is consumable by other apps, verify the README or install docs still show the correct `@import` + `@source` instructions.

## Default decisions

- Prefer **Tailwind v4 CSS directives** over JavaScript config.
- Prefer **explicit `@source`** over hoping auto-detection finds non-local files.
- Prefer a **shared exported `theme.css`** for libraries that expose Tailwind-styled components.
- Prefer **duplicating plugin registration intentionally** when the repo uses both `bunfig.toml` and manual `Bun.build()` paths; they cover different bundling entrypoints.

## Red flags

- Tailwind classes exist in TSX but disappear from the built CSS.
- `bunfig.toml` is configured, but a manual `Bun.build()` path forgot `plugins: [tailwindPlugin]`.
- Theme tokens are hard-coded directly into components instead of routed through semantic CSS variables.
- A library README tells consumers to import the package but forgets to tell them to scan the package output with `@source`.
- A new `tailwind.config.js` appears even though Tailwind v4 CSS directives already cover the requirement.

## Output expectations

When you update a Bun + Tailwind project, report:

- which bundling path you changed (`bunfig.toml`, manual `Bun.build()`, or both)
- which stylesheet owns Tailwind import and sources
- where theme tokens live
- how consumers must wire the package if this is a library
