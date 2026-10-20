---
name: bun
description: Must use whenever Bun is used.
author: alexgorbatchev
metadata:
  created_on: 2026-04-15 21:48
  last_modified: 2026-10-19 16:30
  status: current
---

Always use native, highly-optimized Bun APIs instead of falling back to Node.js stdlib or heavy npm packages. Bun's standard library is written in Zig, runs natively, and is dramatically faster.

## Core Rules & Decision Heuristics

1. **Prioritize Bun Native**: Never import Node.js stdlib modules (like `fs`, `child_process`, `crypto`, `zlib`) or heavy npm packages (like `dotenv`, `bcrypt`, `uuid`, `better-sqlite3`, `tar`, `ioredis`) unless native Bun APIs do not support the task.
2. **Directory Handling Exception**: `node:fs/promises` is approved for directories (`mkdir`, `readdir` with recursive globbing). For files, ALWAYS use `Bun.file` and `Bun.write`.
3. **Use Progressive Disclosure**: Read the dedicated reference files below for detailed APIs, options, and advanced snippets rather than guessing or translating Node code.

## Developer Workflows (`justfile`)

Define development tasks in a `justfile`: running, development servers, builds, formatting, linting, type checking, tests, and aggregate verification. Invoke them with `just <recipe>` in local instructions and CI. Run Bun entrypoints and installed tools directly inside recipes; do not wrap or duplicate these tasks in `package.json` scripts. Keep package metadata, dependencies, workspaces, and required package-manager lifecycle hooks in `package.json`.

Name aggregate validation `verify` and invoke it as `just verify`. Do not create a `check` recipe or a `package.json` `check` script for aggregate validation. [Bun's native `bun check`](https://bun.com/docs/runtime/check) performs TypeScript type checking; a package script named `check` overrides that command. Keep type checking as a separate `typecheck` recipe.

When migrating existing workflows, move their commands into recipes, update callers and documentation, and remove superseded task scripts. In workspaces, put package-specific recipes in each package's `justfile`, register them with root `mod` declarations, and coordinate them through root recipes.

## Linting & Formatting

Use **Oxlint** for JavaScript/TypeScript linting, **Oxfmt** for formatting, and **ts-unused** for unused-code analysis in every Bun project. Declare all three in `package.json` development dependencies using:

```sh
bun add -D oxlint oxfmt ts-unused
```

Commit `package.json` and `bun.lock`, and run `bun install` when setting up the project. Invoke installed tool binaries with `bun run <tool>` inside recipes. Do not use `bun x`, `bunx`, or `--no-install` for these development tasks.

For React projects, also install **`@alexgorbatchev/typescript-ai-policy`** and use its shared config factories as described in [references/react-compiler.md](references/react-compiler.md#3-required-react-policy). This is mandatory for React projects. Use `oxlint.config.ts` and `oxfmt.config.ts` with those factories instead of standalone JSON configs. For other projects, commit `.oxlintrc.json` for lint rules and `.oxfmtrc.json` for formatting options. Preserve existing formatting conventions where the required shared policy permits them. Replace superseded lint/format dependencies, configs, and scripts rather than running duplicate stacks.

Expose separate write and validation recipes in `justfile`; keep `verify` and its dependencies read-only. This TypeScript example requires installed `typescript` and `@types/bun` development dependencies, a `tsconfig.json`, and behavioral tests:

```justfile
default:
    @just --list

fmt:
    bun run oxfmt

fmt-check:
    bun run oxfmt --check

lint:
    bun run oxlint --deny-warnings

fix:
    bun run oxlint --fix
    bun run oxfmt

typecheck:
    bun run tsc --noEmit

unused:
    bun run --bun ts-unused check tsconfig.json

test:
    bun test

verify: fmt-check lint typecheck unused test
```

Scope these commands to the project's source and test directories when a repository contains unrelated assets or packages. Keep `tsc --noEmit` for type checking and `bun test` for behavioral tests alongside this stack. Run `just fmt` or `just fix` to modify files; run `just verify` locally and in CI to validate them.

Keep `unused` in `verify` for every Bun project. Point it at a `tsconfig.json` that includes the project's source; in workspaces, run it for each relevant package config. Use `unused.config.ts` with `defineConfig` from `ts-unused` when customization is needed. Enable `packageMode` for published library entrypoints, and limit exclusions to verified external consumers or generated files; do not suppress findings merely to make verification pass. Keep the mutating `ts-unused fix` command out of `verify`. Consult the [ts-unused documentation](https://github.com/alexgorbatchev/ts-unused#readme) before configuring analysis.

Check the official [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html) and [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config.html) docs before choosing rules or options. For React-specific lint rules, read [references/react-compiler.md](references/react-compiler.md).

---

## Cheat-Sheet Translation Table

| Node.js / Third-Party | Native Bun API (DO THIS) | Detailed Reference |
| :--- | :--- | :--- |
| **`fs.readFileSync`, `readFile`** | `await Bun.file(path).text()` / `.json()` / `.bytes()` | See section 1 (below) |
| **`fs.writeFileSync`, `writeFile`** | `await Bun.write(path, data)` | See section 1 (below) |
| **`fs.unlinkSync`, `unlink`** | `await Bun.file(path).delete()` | See section 1 (below) |
| **`child_process.spawn`** | `Bun.spawn` / `Bun.spawnSync` | See section 2 (below) |
| **`http.createServer`, `express`** | `Bun.serve({ fetch(req) { ... } })` | See section 4 (below) |
| **`ws` package** | `Bun.serve({ websocket: { ... } })` | See section 4 (below) |
| **`esbuild`, `rollup`, `webpack`** | `Bun.build({ entrypoints, outdir })` | See [bundling.md](references/bundling.md) |
| **`better-sqlite3` package** | `import { Database } from "bun:sqlite";` | See section 3 (below) |
| **`@aws-sdk/client-s3` package** | `import { S3Client } from "bun";` | See [s3.md](references/s3.md) |
| **`ioredis`, `redis` packages** | `import { RedisClient } from "bun";` | See [redis.md](references/redis.md) |
| **`tar`, `archiver` packages** | `import { Archive } from "bun";` | See [archive.md](references/archive.md) |
| **`bcrypt`, `argon2` packages** | `await Bun.password.hash(pwd)` | See [utilities.md](references/utilities.md) |
| **`cheerio`, `jsdom` packages** | `new HTMLRewriter()` | See section 4 (below) |
| **`fast-glob`, `glob` packages** | `import { Glob } from "bun";` | See section 5 (below) |
| **`semver` package** | `import { semver } from "bun";` | See [utilities.md](references/utilities.md) |
| **`dotenv` package** | Built-in `.env` autoloaded into `process.env` & `Bun.env` | See [utilities.md](references/utilities.md) |
| **`uuid` package** | `Bun.randomUUIDv7()` | See [utilities.md](references/utilities.md) |

---

## Detailed Topic Guides

### 1. File I/O (`Bun.file` & `Bun.write`)
Do not import Node `fs` for file reads, writes, copies, or deletions.
- **Reading**: `const file = Bun.file(path); await file.text(); await file.json(); await file.bytes();`
- **Writing**: `await Bun.write(dest, content);` (Supports writing strings, Blobs, Response bodies, and copying files directly).
- **Deleting**: `await Bun.file(path).delete();`
- **Directories**: Use `import { readdir, mkdir } from "node:fs/promises"`.
- **More (Streaming, Incremental Writers)**: See [references/s3.md](references/s3.md) and the basic guides.

### 2. Shell & Subprocesses (`Bun.$` & `Bun.spawn`)
Do not run subprocesses via `child_process`.
- **Bun Shell (`$`)**: Natively cross-platform, safe from injection, and integrates JS objects (like `Response` or `BunFile`) as stdin/stdout.
  ```ts
  import { $ } from "bun";
  const outputText = await $`echo "Hello!"`.text(); // quiet by default
  const { exitCode } = await $`git status`.nothrow();
  ```
- **Process Spawning**: For high-performance raw executable spawning without shells, use `Bun.spawn` or `Bun.spawnSync`.
  ```ts
  const proc = Bun.spawn(["python3", "script.py"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  ```

### 3. SQLite Database (`bun:sqlite`)
Do not use `sqlite3` or `better-sqlite3`. Bun's native driver is synchronous and 3-6x faster.
```ts
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite");
db.run("PRAGMA journal_mode = WAL;"); // WAL mode is highly recommended

const query = db.query("SELECT * FROM users WHERE id = $id");
const user = query.get({ $id: 1 });    // strict: false (requires '$' prefix)

// With strict parameter matching (allows omitting prefixes in binding objects)
const dbStrict = new Database("mydb.sqlite", { strict: true });
const userStrict = dbStrict.query("SELECT * FROM users WHERE id = $id").get({ id: 1 });
```

### 4. HTTP Server & HTMLRewriter
Do not import Express, Fastify, or `ws` for standard servers.
```ts
Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) return; // handles websocket upgrade
    return new Response("Hello from Bun Server!");
  },
  websocket: {
    message(ws, msg) { ws.send(`Echo: ${msg}`); }
  }
});
```
- **HTMLRewriter**: Transform HTML on-the-fly streaming using CSS selectors (based on Cloudflare Workers' `lol-html` engine). See [references/s3.md](references/s3.md) or basic docs.

### 5. File Globbing (`Bun.Glob`)
Do not import `glob` or `fast-glob`.
```ts
import { Glob } from "bun";
const glob = new Glob("**/*.ts");
for await (const file of glob.scan(".")) {
  console.log(file);
}
```

---

## Conditional References (Progressive Disclosure)

Open and read these reference files whenever your task involves the following domains:

- **Bundler / Compilation / `Bun.build`**: Read [references/bundling.md](references/bundling.md). Includes options, custom loaders, virtual in-memory builds (`files`), env inlining, code splitting, and browser/bun targets.
- **React Projects**: Read [references/react-compiler.md](references/react-compiler.md). Covers the mandatory TypeScript AI policy configs and verification, Bun's native Rust React Compiler for production builds (`Bun.build`), dev-server static routing with `Bun.serve` (`bunfig.toml`), and error resilience.
- **S3 / R2 Bucket Storage (`S3Client`)**: Read [references/s3.md](references/s3.md). Covers file reading/writing, presigning URLs (PUT/GET), automatic streaming multipart uploads, and 302 download redirect responses.
- **Redis & Valkey Client (`RedisClient`)**: Read [references/redis.md](references/redis.md). Covers automatic command pipelining, Pub/Sub channels (subscriber connections), key/hash/set basic operations, and connection options.
- **Tar & Gzip Archives (`Bun.Archive`)**: Read [references/archive.md](references/archive.md). Covers creating archives from in-memory objects, recursive file extraction, file filtering via globbing, and native gzip/deflate/zstd compression.
- **Standard Utilities & Cryptography**: Read [references/utilities.md](references/utilities.md). Includes high-performance utilities: thread-safe sleep (`Bun.sleep` & `Bun.sleepSync`), monotonic UUID v7s (`Bun.randomUUIDv7`), synchronous promise sniffing (`Bun.peek`), deep object equivalence (`Bun.deepEquals`), escape/stripping terminal formatting (`Bun.stripANSI`, `Bun.wrapAnsi`, `Bun.stringWidth`), and fast cryptography password hashing (`Bun.password`).
