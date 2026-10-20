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

## 3. Required React Policy

Every React project must use **`@alexgorbatchev/typescript-ai-policy`** through its shared Oxfmt and Oxlint config factories. Installing the dependency alone does not enable the policy. Read the [package documentation](https://github.com/alexgorbatchev/typescript-ai-policy#readme) and the installed package's peer dependencies before configuring it.

### Install
```bash
bun add -D @alexgorbatchev/typescript-ai-policy oxlint oxfmt ts-unused
```

Record these as `package.json` devDependencies and commit the lockfile. Keep compatible TypeScript and Bun type dependencies installed as required by the project.

### Configure `oxlint.config.ts`
```ts
import createOxlintConfig from "@alexgorbatchev/typescript-ai-policy/oxlint-config";

export default createOxlintConfig();
```

### Configure `oxfmt.config.ts`
```ts
import createOxfmtConfig from "@alexgorbatchev/typescript-ai-policy/oxfmt-config";

export default createOxfmtConfig(() => ({}));
```

Replace superseded `.oxlintrc.json` and `.oxfmtrc.json` configurations after transferring applicable project settings through the factories. Consumer lint configuration is extension-only: do not override shared rules, replace the factories with copied rules, or use lint-disable comments to bypass policy findings. Configure only justified exclusions for generated or third-party files.

### Use the shared configs in every formatting and lint recipe

Replace the base skill's formatting and lint recipes with these; keep its `typecheck`, `unused`, and `test` recipes:

```justfile
fmt:
    bun run --bun oxfmt --config oxfmt.config.ts .

fmt-check:
    bun run --bun oxfmt --config oxfmt.config.ts --check .

lint:
    bun run --bun oxlint --config oxlint.config.ts --deny-warnings .

fix:
    bun run --bun oxlint --config oxlint.config.ts --fix .
    bun run --bun oxfmt --config oxfmt.config.ts .

verify: fmt-check lint typecheck unused test
```

Run the tools under Bun to load the TypeScript config entrypoints. The formatting and lint checks above enforce the shared policy as part of `just verify`; do not maintain a second standalone lint/format stack.

---

## 4. Development Tasks (`just verify`)

Use the quality recipes from the Bun skill's **Linting & Formatting** section with the policy-backed replacements above. Run `just verify` to validate shared-policy formatting and lint, types, unused code, and tests. Keep these tasks in `justfile`; reserve `bun check` for Bun's native type checker.

Add build and development recipes that run the project's actual entrypoints directly. For a project using `src/build/buildClient.ts` and `src/server/startServer.ts`:

```justfile
build:
    bun src/build/buildClient.ts

dev:
    bun --hot src/server/startServer.ts
```
