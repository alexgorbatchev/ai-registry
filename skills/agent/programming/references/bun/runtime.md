# Bun

## Contents

- [Core Rules & Decision Heuristics](#core-rules--decision-heuristics)
- [Build storage and temporary files](#build-storage-and-temporary-files)
- [Linting & Formatting](#linting--formatting)
- [Cheat-Sheet Translation Table](#cheat-sheet-translation-table)
- [Detailed Topic Guides](#detailed-topic-guides)
- [Conditional References (Progressive Disclosure)](#conditional-references-progressive-disclosure)

Always use native, highly-optimized Bun APIs instead of falling back to Node.js stdlib or heavy npm packages. Bun's standard library is written in Zig, runs natively, and is dramatically faster.

## Core Rules & Decision Heuristics

1. **Prioritize Bun Native**: Never import Node.js stdlib modules (like `fs`, `child_process`, `crypto`, `zlib`) or heavy npm packages (like `dotenv`, `bcrypt`, `uuid`, `better-sqlite3`, `tar`, `ioredis`) unless native Bun APIs do not support the task.
2. **Directory Handling Exception**: `node:fs/promises` is approved for directories (`mkdir`, `readdir` with recursive globbing). For files, ALWAYS use `Bun.file` and `Bun.write`.
3. **Use Progressive Disclosure**: Read the dedicated reference files below for detailed APIs, options, and advanced snippets rather than guessing or translating Node code.

## Build storage and temporary files

- Keep artifacts owned by the current task at or below **5 GB (5,000,000,000 allocated bytes)** in total: task-created temporary files, build outputs, test/coverage/profiling artifacts, and caches dedicated to that task. Count these artifacts across checkout, worktrees, and external output paths; moving them does not reset the budget. Keep the same task baseline across retries, resumed sessions, and agent handoffs. Count physical storage once without adding nested totals.
- Exclude artifacts created before this task began, other tasks' outputs, shared/global build and transpiler caches, downloaded dependencies, installed tools, and runtime data such as sessions, credentials, and databases. A shared cache or output directory exceeding 5 GB does not by itself block task work or authorize cleanup.
- Inspect package scripts, output paths, and environment overrides to identify task-owned artifacts. Record a baseline for reused output directories and measure attributable task artifacts before and after artifact-producing runs; monitor long-running commands. Do not charge the entire reused directory to the task. If concurrent writes prevent reliable attribution, report that limitation and continue while actual filesystem space permits; uncertain ownership never authorizes deletion.
- At the task's limit, pause only operations that would increase its counted artifacts. Remove verified task-owned disposable files and remeasure, while continuing independent authorized work. If required task artifacts still cannot fit, preserve them and report their paths, sizes, affected operations, and the required budget or scope decision. Actual filesystem exhaustion is a separate blocker even when caused by excluded storage.
- Keep task scratch files under a dedicated project `.tmp` child. Create it before assigning its absolute path to `TMPDIR` for the command; Bun uses this location for intermediate assets. Register cleanup when creating temporary files and remove them immediately after their last consumer finishes, including on failure or cancellation. Perform a final cleanup before handing off the task; do not wait for an inactivity threshold.
- Remove task-owned completed scratch experiments, obsolete build variants, and intermediate test/coverage/profile files promptly once their results have been consumed or retained outside disposable storage. Preserve source, fixtures, manifests, lockfiles, requested deliverables, and required diagnostic evidence; count retained task-created generated files toward the task budget.
- Inspect ownership, tracked contents, symlinks, and active build/dev-server consumers before deletion. Remove exact task-owned disposable paths; do not wipe `.tmp`, `dist`, `.output`, or caches by name. Preserve other agents' artifacts and runtime data. The task budget grants no authority to delete or reconfigure shared storage.
- Reuse normal shared build/transpiler caches. Do not create a fresh cache per command, clear caches before builds, or impose the task's 5 GB limit on shared caches. Inspect their sizes or change retention only for separately authorized cache maintenance or diagnosis of actual disk pressure, coordinating their consumers first.
- Package-manager downloads and `node_modules` are dependency storage, outside the task artifact budget. Do not run `bun pm cache rm`, remove dependencies, or wipe Bun's installation directory to satisfy that budget. Preserve offline/private dependencies and installed tools. Verify any authorized cleanup's exit status and remaining task-owned allocations.

Verify installed behavior against [Bun's environment variables](https://bun.sh/docs/runtime/environment-variables), [bundler output settings](https://bun.sh/docs/bundler), and [package-cache commands](https://bun.sh/docs/pm/cli/pm) before changing paths or choosing cleanup flags.

## Linting & Formatting

Use **Oxlint** for JavaScript/TypeScript linting and **Oxfmt** for formatting in Bun projects. Install both as development dependencies:

```sh
bun add -D oxlint oxfmt
```

Commit `.oxlintrc.json` for lint rules and `.oxfmtrc.json` for formatting options. Preserve the project's existing formatting conventions when migrating. Replace superseded lint/format dependencies, configs, and scripts rather than running duplicate stacks.

Expose separate write and check commands in `package.json`; keep CI checks read-only:

```json
{
  "scripts": {
    "lint": "oxlint --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "fix": "oxlint --fix && oxfmt",
    "check": "bun run fmt:check && bun run lint && tsc --noEmit && bun test"
  }
}
```

Scope these commands to the project's source and test directories when a repository contains unrelated assets or packages. Keep `tsc --noEmit` for type checking and `bun test` for behavioral tests alongside this stack.

Check the official [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html) and [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config.html) docs before choosing rules or options. For React-specific lint rules, read [react-compiler.md](react-compiler.md).

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
| **`esbuild`, `rollup`, `webpack`** | `Bun.build({ entrypoints, outdir })` | See [bundling.md](bundling.md) |
| **`better-sqlite3` package** | `import { Database } from "bun:sqlite";` | See section 3 (below) |
| **`@aws-sdk/client-s3` package** | `import { S3Client } from "bun";` | See [s3.md](s3.md) |
| **`ioredis`, `redis` packages** | `import { RedisClient } from "bun";` | See [redis.md](redis.md) |
| **`tar`, `archiver` packages** | `import { Archive } from "bun";` | See [archive.md](archive.md) |
| **`bcrypt`, `argon2` packages** | `await Bun.password.hash(pwd)` | See [utilities.md](utilities.md) |
| **`cheerio`, `jsdom` packages** | `new HTMLRewriter()` | See section 4 (below) |
| **`fast-glob`, `glob` packages** | `import { Glob } from "bun";` | See section 5 (below) |
| **`semver` package** | `import { semver } from "bun";` | See [utilities.md](utilities.md) |
| **`dotenv` package** | Built-in `.env` autoloaded into `process.env` & `Bun.env` | See [utilities.md](utilities.md) |
| **`uuid` package** | `Bun.randomUUIDv7()` | See [utilities.md](utilities.md) |

---

## Detailed Topic Guides

### 1. File I/O (`Bun.file` & `Bun.write`)
Do not import Node `fs` for file reads, writes, copies, or deletions.
- **Reading**: `const file = Bun.file(path); await file.text(); await file.json(); await file.bytes();`
- **Writing**: `await Bun.write(dest, content);` (Supports writing strings, Blobs, Response bodies, and copying files directly).
- **Deleting**: `await Bun.file(path).delete();`
- **Directories**: Use `import { readdir, mkdir } from "node:fs/promises"`.
- **More (Streaming, Incremental Writers)**: See [s3.md](s3.md) and the basic guides.

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
- **HTMLRewriter**: Transform HTML on-the-fly streaming using CSS selectors (based on Cloudflare Workers' `lol-html` engine). See [s3.md](s3.md) or basic docs.

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

- **Bundler / Compilation / `Bun.build`**: Read [bundling.md](bundling.md). Includes options, custom loaders, virtual in-memory builds (`files`), env inlining, code splitting, and browser/bun targets.
- **React Compiler Setup**: Read [react-compiler.md](react-compiler.md). Covers configuring Bun's native Rust React Compiler for production builds (`Bun.build`), dev-server static routing with `Bun.serve` (`bunfig.toml`), error resilience, and Oxlint validation.
- **S3 / R2 Bucket Storage (`S3Client`)**: Read [s3.md](s3.md). Covers file reading/writing, presigning URLs (PUT/GET), automatic streaming multipart uploads, and 302 download redirect responses.
- **Redis & Valkey Client (`RedisClient`)**: Read [redis.md](redis.md). Covers automatic command pipelining, Pub/Sub channels (subscriber connections), key/hash/set basic operations, and connection options.
- **Tar & Gzip Archives (`Bun.Archive`)**: Read [archive.md](archive.md). Covers creating archives from in-memory objects, recursive file extraction, file filtering via globbing, and native gzip/deflate/zstd compression.
- **Standard Utilities & Cryptography**: Read [utilities.md](utilities.md). Includes high-performance utilities: thread-safe sleep (`Bun.sleep` & `Bun.sleepSync`), monotonic UUID v7s (`Bun.randomUUIDv7`), synchronous promise sniffing (`Bun.peek`), deep object equivalence (`Bun.deepEquals`), escape/stripping terminal formatting (`Bun.stripANSI`, `Bun.wrapAnsi`, `Bun.stringWidth`), and fast cryptography password hashing (`Bun.password`).
