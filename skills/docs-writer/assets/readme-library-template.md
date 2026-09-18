# Library README Template

Use this template for libraries, packages, services, and applications consumed through code. The rules it embodies are in `../references/readme.md` (shared) and `../references/readme-library.md` (library-specific). Replace every placeholder with verified project evidence; never ship placeholder text.

---

```markdown
`mylib` is a typed client for the Example API that batches writes and retries transient failures, for services that need durable delivery without managing a queue.

# What It Does

- **Batched writes**: Groups records and flushes them on a size or time threshold, whichever comes first.
- **Automatic retries**: Retries transient failures with exponential backoff and surfaces permanent ones immediately.
- **Typed responses**: Ships TypeScript types generated from the Example API schema.
- **Pluggable transport**: Accepts any `fetch`-compatible implementation for testing or proxying.

# How It Works

1. You construct a client with your credentials and options.
2. Each `write()` call adds a record to the in-memory batch and returns immediately.
3. The batch is flushed when it reaches the size threshold or the flush interval elapses.
4. Failed batches are retried; records that cannot be delivered are handed to your `onError` callback.

# How it Really Works

- The client keeps one in-memory batch per instance and is safe to share across concurrent callers; construct one per process rather than one per request.
- `write()` never touches the network. It resolves once the record is queued, so a process that exits without calling `close()` loses whatever is still buffered.
- Retries use exponential backoff starting at 200ms for `429` and `5xx` responses only. A `4xx` other than `429` fails immediately and is never retried.
- The only environment variable read is `MYLIB_API_KEY`, and it is read at construction time, not at import time.
- Nothing is written to disk and no telemetry is sent.

# Prerequisites

- [Node.js](https://nodejs.org) 20 or newer, or any runtime providing a global `fetch`.
- An Example API key with write scope.

# Installation

```bash
npm install mylib
```

# Quick Start

```typescript
import { createClient } from "mylib";

const client = createClient({ apiKey: process.env.MYLIB_API_KEY });

await client.write({ id: "42", payload: { status: "ok" } });
await client.close(); // flushes anything still buffered
```

# API

| Export | Signature | Description |
| :--- | :--- | :--- |
| `createClient` | `(options: ClientOptions) => Client` | Creates a client bound to one API key |
| `Client.write` | `(record: Record) => Promise<void>` | Queues one record; resolves once buffered |
| `Client.flush` | `() => Promise<void>` | Sends the current batch immediately |
| `Client.close` | `() => Promise<void>` | Flushes and releases the flush timer |

# Configuration

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | `$MYLIB_API_KEY` | Credential used for every request |
| `batchSize` | `number` | `100` | Records buffered before an automatic flush |
| `flushIntervalMs` | `number` | `5000` | Milliseconds before a partial batch is sent |
| `fetch` | `typeof fetch` | global `fetch` | Transport implementation to use |
| `onError` | `(error: DeliveryError) => void` | rethrows | Called for records that exhausted retries |

# Compatibility

`mylib` follows semantic versioning. A major release changes the shape of `ClientOptions` or the delivery guarantees; minor releases only add optional options.

# License

MIT License (c) 2026 Alex Gorbatchev
```
