# Bun Bundling & Compiling Reference (`Bun.build`)

Use Bun's fast native bundler via the `Bun.build()` JavaScript/TypeScript API instead of importing heavy, complex bundlers (like webpack, rollup, or esbuild) or falling back to external compilation scripts.

---

## 1. Basic Build API
```ts
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",               // generates files on disk
  target: "browser",              // "browser" (default) | "bun" | "node"
  format: "esm",                  // "esm" (default) | "cjs" (experimental)
  minify: true,                   // enables whitespace, identifier, and syntax minification
  splitting: true,                // enables code splitting for shared code chunks
  sourcemap: "linked",            // "none" (default) | "linked" | "inline" | "external"
});

if (result.success) {
  console.log("Built successfully!");
  for (const artifact of result.outputs) {
    console.log(`Created: ${artifact.path} (${artifact.size} bytes)`);
  }
} else {
  console.error("Build failed:", result.logs);
}
```

---

## 2. In-Memory Bundling & Virtual Files (`files` map)
You can bundle code without touching disk by passing a virtual file map, or use it to override specific files during the build (e.g., injecting config constants or mocking modules).
```ts
const result = await Bun.build({
  entrypoints: ["/app/index.ts"],
  files: {
    "/app/index.ts": `
      import { greet } from "./greet.ts";
      console.log(greet("World"));
    `,
    "/app/greet.ts": `
      export function greet(name: string) {
        return "Hello, " + name + "!";
      }
    `,
  },
});

// Access bundled code as text without writing to disk
const bundledCode = await result.outputs[0].text();
console.log(bundledCode);
```

---

## 3. Advanced Naming Templates
Customize file structures for entries, chunks, and copied assets.
```ts
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  naming: {
    entry: "assets/[dir]/[name]-[hash].[ext]",
    chunk: "chunks/[name]-[hash].[ext]",
    asset: "static/[name]-[hash].[ext]",
  },
});
```

---

## 4. Compile-time Definitions (`define`) & Env Inlining
Avoid using complex run-time checks or importing `dotenv` packages inside bundled code.
```ts
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  // 1. Inline env variables automatically (converts process.env.URL to literal string)
  env: "inline", // Or "disable" | prefix like "ACME_PUBLIC_*"
  
  // 2. Define global identifiers to replace at build time
  define: {
    PRODUCTION: "true",
    VERSION: JSON.stringify("1.0.0"),
    "config.debugMode": "false",
  },
});
```

---

## 5. Handling External Dependencies
Exclude packages from the bundle so they are resolved at runtime.
```ts
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  // Mark specific modules as external
  external: ["lodash", "react"],
  // OR mark all node_modules/packages as external
  packages: "external",
});
```

---

## 6. Build Plugins (Universal Plugin API)
Universal plugins work with both the Bun runtime (`Bun.plugin()`) and the bundler (`Bun.build()`).
```ts
import { plugin } from "bun";

const myPlugin = {
  name: "custom-loader-plugin",
  setup(build) {
    // Resolve imports
    build.onResolve({ filter: /\.xyz$/ }, (args) => {
      return { path: args.path };
    });

    // Load file contents
    build.onLoad({ filter: /\.xyz$/ }, async (args) => {
      const rawText = await Bun.file(args.path).text();
      return {
        contents: `export default ${JSON.stringify(rawText)};`,
        loader: "js",
      };
    });
  },
};

// Use in bundler
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [myPlugin],
});
```
