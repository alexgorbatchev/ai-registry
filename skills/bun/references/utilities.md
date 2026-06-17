# Bun Native Standard Utilities Reference

Avoid importing slow npm utility helpers (like `uuid`, `lodash.difference`, `strip-ansi`, `wrap-ansi`, `string-width`, or `safe-regex`). Bun implements highly optimized native utility APIs in Zig.

---

## 1. Fast Thread-safe sleep (`Bun.sleep` & `Bun.sleepSync`)
Do not write `new Promise(r => setTimeout(r, ms))` wrappers.
```ts
// 1. Asynchronous Sleep (non-blocking thread)
await Bun.sleep(1000); // sleep for 1 second

// Sleep until a specific Date
const triggerTime = new Date(Date.now() + 5000);
await Bun.sleep(triggerTime);

// 2. Synchronous Sleep (BLOCKS execution thread)
Bun.sleepSync(1000); // pauses thread for 1 second
```

---

## 2. High-Performance Monotonic UUID v7 (`Bun.randomUUIDv7`)
Monotonic, lexicographically sortable UUID v7s (perfect for database primary keys and sorting).
```ts
import { randomUUIDv7 } from "bun";

const id = randomUUIDv7(); // "0192ce11-26d5-7dc3-9305-1426de888c5a"

// Retrieve as a raw 16-byte Buffer to avoid string conversion overhead
const buffer = randomUUIDv7("buffer");
```

---

## 3. Synchronous Promise Status Inspection (`Bun.peek`)
Read a promise's result synchronously without invoking `await` or `.then`, avoiding extraneous microticks in performance-sensitive loops. Only works if the promise is already settled (fulfilled or rejected).
```ts
import { peek } from "bun";

const myPromise = Promise.resolve("settled data");

// Synchronously check status: "fulfilled" | "rejected" | "pending"
const status = peek.status(myPromise);

if (status === "fulfilled") {
  const result = peek(myPromise); // returns "settled data" without await!
} else if (status === "pending") {
  // If promise is pending, peek() returns the promise instance itself
  const stillPromise = peek(myPromise);
}
```

---

## 4. Deep Equality Comparison (`Bun.deepEquals`)
Recursively compares structural equivalence of two objects extremely fast (built-in Zig engine).
```ts
const foo = { a: 1, b: [10, 20] };
const bar = { a: 1, b: [10, 20] };

Bun.deepEquals(foo, bar); // true

// Pass 'true' as third argument for strict type/undefined checking
Bun.deepEquals({ a: undefined }, {}, true); // false (true in strict mode checks keys)
```

---

## 5. Console & Terminal String Formatting
Fast, native wrappers for text width, wrapping, and escaping in terminals.

### ANSI Escape Code Stripping (`Bun.stripANSI`)
Up to 6-57x faster than the `strip-ansi` npm package.
```ts
const colored = "\u001b[31mRed Text\u001b[0m";
const plain = Bun.stripANSI(colored); // "Red Text"
```

### Display Column Width Checker (`Bun.stringWidth`)
Up to 6,700x faster than npm's `string-width` for large inputs. Supports emoji, ANSI, and wide characters.
```ts
Bun.stringWidth("hello"); // 5
Bun.stringWidth("👋");    // 2 (display width on console)
```

### Display Line Wrapping (`Bun.wrapAnsi`)
Drops-in as a fast alternative to the `wrap-ansi` npm package, wrapping text while preserving ANSI formatting.
```ts
const wrapped = Bun.wrapAnsi("The quick brown fox jumps over the lazy dog", 20, {
  hard: true, // break words exceeding column limit
});
```

---

## 6. HTML Escaping (`Bun.escapeHTML`)
Extremely fast escaping optimized for large HTML input streams.
```ts
const escaped = Bun.escapeHTML("<script>alert('xss')</script>");
// "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
```

---

## 7. Find Executable path (`Bun.which`)
Natively resolve executable paths similar to typing `which` in bash, without using external packages.
```ts
const nodePath = Bun.which("node"); // e.g., "/usr/local/bin/node"
```

---

## 8. Synchronous JJS structured serialization (`bun:jsc`)
Serialize any structural-cloneable JavaScript value directly to an ArrayBuffer and back.
```ts
import { serialize, deserialize } from "bun:jsc";

const buffer = serialize({ score: [10, 20], meta: { active: true } });
const obj = deserialize(buffer); // { score: [10, 20], meta: { active: true } }
```
