# React Compiler with Bun

Bun natively integrates the upstream Rust port of the React Compiler into its bundler engine (Bun 1.4+). It automatically optimizes components and hooks with memo caches without Babel, `@babel/core`, or `babel-plugin-react-compiler`.

---

## 1. Production Bundling (`Bun.build` & CLI)

### CLI
```bash
bun build ./index.html --outdir ./dist --react-compiler
```

### Programmatic API (`Bun.build`)
Pass `reactCompiler: true` to compile with native memoization:

```ts
const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  reactCompiler: true,
});

for (const log of result.logs) {
  const loc = log.position ? `${log.position.file}:${log.position.line}:${log.position.column}: ` : "";
  if (log.level === "error") console.error(`${loc}${log.message}`);
  else if (log.level === "warning") console.warn(`${loc}${log.message}`);
  else console.info(`${loc}${log.message}`);
}

if (!result.success) {
  process.exitCode = 1;
}
```

### Compiler Target & Output Mode
- When `target: "browser"` is set, Bun defaults to client memoization mode (`reactCompilerOutputMode: "client"`).
- When `target: "bun"` or `target: "node"` is set, Bun defaults to SSR mode (`reactCompilerOutputMode: "ssr"`), which omits the memo cache (`useMemoCache`).
- Explicitly override when needed via `reactCompilerOutputMode: "client" | "ssr"`.

---

## 2. Dev Server Static Routing (`Bun.serve`)

When serving static frontend routes with `Bun.serve({ routes: { "/": page } })`, Bun's HTML router does not natively apply `reactCompiler: true` by default.

To prevent dev/prod parity bugs (such as `useEffect` re-run loops, referential instability, or scene thrashing that occur when components lack manual `useMemo`/`useCallback`), compile components through a bundler plugin in `bunfig.toml`.

### Step 1: Configure `bunfig.toml`
```toml
[serve.static]
plugins = ["./src/server/reactCompilerPlugin.ts"]
env = "disable"
```

### Step 2: Create the Plugin (`reactCompilerPlugin.ts`)
The plugin runs Bun's native compiler transform per file and falls back gracefully on syntax or compiler errors so the dev server remains active:

```ts
import type { BunPlugin } from "bun";

function isBuildMessage(item: unknown): item is BuildMessage | ResolveMessage {
  return typeof item === "object" && item !== null && "message" in item && "level" in item;
}

function printBuildLog(log: BuildMessage | ResolveMessage): void {
  const loc = log.position ? `${log.position.file}:${log.position.line}:${log.position.column}: ` : "";
  const text = `${loc}${log.message}`;
  if (log.level === "error") console.error(text);
  else if (log.level === "warning") console.warn(text);
  else console.info(text);
}

export const reactCompilerPlugin: BunPlugin = {
  name: "react-compiler",
  setup(build) {
    build.onLoad({ filter: /\.[jt]sx?$/, namespace: "file" }, async (args) => {
      if (args.path.includes("/node_modules/")) return undefined;
      try {
        const result = await Bun.build({
          entrypoints: [args.path],
          reactCompiler: true,
          target: "browser",
          external: ["*"],
        });
        for (const log of result.logs) printBuildLog(log);
        if (!result.success || !result.outputs[0]) return undefined;
        const contents = await result.outputs[0].text();
        return { contents, loader: args.path.endsWith("x") ? "tsx" : "ts" };
      } catch (error) {
        if (error instanceof AggregateError) {
          for (const item of error.errors) {
            if (isBuildMessage(item)) printBuildLog(item);
            else console.error(item instanceof Error ? item.message : String(item));
          }
        } else {
          console.error(error instanceof Error ? error.message : String(error));
        }
        // Returning undefined tells Bun to fall back to its default loader,
        // keeping the server alive and letting native error reporting handle syntax issues.
        return undefined;
      }
    });
  },
};

export default reactCompilerPlugin;
```

---

## 3. Linting and Rules of React (`oxlint`)

To catch Rules of React violations (mutating props, calling hooks conditionally, accessing refs in render) without ESLint overhead, use `oxlint`. Oxlint natively includes the 22 React Compiler validation rules under its `react` plugin.

### Install
```bash
bun add -D oxlint
```

### Configure `.oxlintrc.json`
```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript"],
  "categories": {
    "correctness": "error"
  },
  "rules": {
    "react/set-state-in-effect": "warn"
  }
}
```

---

## 4. Unified Quality Check (`bun check`)

Combine formatting (`oxfmt`), linting (`oxlint`), type checking (`tsc`), and tests into a fast, single command in `package.json`:

```json
{
  "scripts": {
    "check": "oxfmt --check && oxlint && tsc --noEmit && bun test --pass-with-no-tests",
    "fmt": "oxfmt",
    "build": "bun src/build/buildClient.ts",
    "dev": "bun --hot src/server/startServer.ts"
  }
}
```
