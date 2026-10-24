# TypeScript 7 Update Guide

TypeScript 7 ships as a fast native binary but **does not yet include a programmatic compiler API**.

When a project has tooling dependencies (like `tsdown`, `@typescript-eslint/rule-tester`, `rolldown-plugin-dts`) that require the legacy `require("typescript")` programmatic compiler API, the project must run TypeScript 7 and TypeScript 6 side-by-side.

## Side-by-Side Installation

Follow the official TypeScript 7 side-by-side strategy:

1. Keep the standard `typescript` dependency at `6.x` (or `>=6.0.3`) in `package.json` so that the programmatic ecosystem works smoothly.
2. Install TypeScript 7 under the `@typescript/native` alias:
   ```bash
   bun add -d @typescript/native@npm:typescript@^7.0.2
   ```

This provides the blazing-fast native `tsc` executable and its Language Server Protocol (LSP) at `node_modules/@typescript/native/bin/tsc`, while preserving ecosystem API compatibility under the standard `typescript` import.

## LSP Integration

When integrating with the TypeScript 7 Language Server via standard IO (`tsc --lsp --stdio`):
- Ensure you send `sendNotification("initialized", {})` with an empty params object after the `initialize` request. Some server implementations require the empty object to correctly process the notification and proceed.
