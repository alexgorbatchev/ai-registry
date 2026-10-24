# Bun Redis & Valkey Client Reference (`Bun.RedisClient` / `Bun.redis`)

Do not import heavy external npm packages (like `ioredis` or `redis`) for connecting to Redis databases. Bun provides highly optimized native bindings for Redis and Valkey databases (version 7.2+) utilizing RESP3 with connection management, automatic pipelining, Pub/Sub, and TLS support.

---

## 1. Connection Configuration
`Bun.redis` is a global client singleton that automatically reads environment credentials:
- **Environment variables checked**: `REDIS_URL` (or `VALKEY_URL`). If not set, defaults to `"redis://localhost:6379"`.

To construct a custom client with explicit options:
```ts
import { RedisClient } from "bun";

const client = new RedisClient("redis://username:password@localhost:6379", {
  connectionTimeout: 5000,   // connection timeout in ms (default: 10000)
  idleTimeout: 30000,         // idle timeout in ms (default: 0 = no timeout)
  autoReconnect: true,        // auto-reconnect on disconnection (default: true)
  maxRetries: 10,             // maximum reconnection attempts (default: 10)
  enableOfflineQueue: true,   // queue commands when disconnected (default: true)
  enableAutoPipelining: true, // auto-pipeline commands (default: true)
  tls: true,                  // enable TLS (or pass custom options)
});
```

---

## 2. Connection Lifecycle
No connection is made until a command is executed.
```ts
const client = new RedisClient();

// First command initiates connection in the background
await client.set("key", "value");

// Explicitly close connection when done (stops background processes)
client.close();
```

---

## 3. Basic Redis Operations

### String & Expiry Operations
```ts
await redis.set("user:123", "Alice");
const name = await redis.get("user:123");

// Fetch as raw binary
const buffer = await redis.getBuffer("user:123"); // Uint8Array

// Delete and check existence (returns boolean)
const exists = await redis.exists("user:123");
await redis.del("user:123");

// TTL operations
await redis.set("session:abc", "active");
await redis.expire("session:abc", 3600); // 1 hour expiration
const ttl = await redis.ttl("session:abc");   // returns seconds
```

### Numeric Operations
```ts
await redis.set("counter", "0");
await redis.incr("counter"); // increments to 1
await redis.decr("counter"); // decrements back to 0
```

### Hash Operations
```ts
// Write fields
await redis.hmset("user:123", ["name", "Alice", "email", "alice@example.com", "visits", "0"]);

// Read multiple fields (returns Array of values)
const fields = await redis.hmget("user:123", ["name", "email"]); // ["Alice", "alice@example.com"]

// Read single field
const name = await redis.hget("user:123", "name"); // "Alice"

// Numeric increments on hash fields
await redis.hincrby("user:123", "visits", 1);
```

### Set Operations
```ts
await redis.sadd("tags", "javascript");
await redis.sadd("tags", "typescript");

// Check membership (returns boolean)
const isMember = await redis.sismember("tags", "javascript");

// Get all elements (returns array)
const tags = await redis.smembers("tags");

// Pop elements
const item = await redis.spop("tags");
```

---

## 4. Native Pub/Sub Subscriptions
**Important restriction**: Once a connection subscribes to a channel, that client instance can only perform subscription commands. To perform standard writes/reads, use `.duplicate()` to clone the connection.

```ts
import { RedisClient } from "bun";

const redis = new RedisClient();
await redis.connect();

// Duplicate the connection for subscriber role
const subscriber = await redis.duplicate();

// Subscribe to a channel
await subscriber.subscribe("updates", (message, channel) => {
  console.log(`Received on ${channel}: ${message}`);
});

// Publish using the standard connection
await redis.publish("updates", "Systems online");

// Unsubscribe
await subscriber.unsubscribe("updates");
```

---

## 5. Automatic Pipelining & Raw Commands
By default, `Bun.redis` automatically pipelines concurrent promises to send them to the server in a single batch, drastically increasing performance.
```ts
// Automatically pipelined and sent as a single network package!
const [name, email] = await Promise.all([
  redis.get("user:1:name"),
  redis.get("user:2:email")
]);
```

### Send Raw Commands
For Redis commands that do not have helper methods (e.g., lists, transactions, sorted sets), use the raw `.send()` interface:
```ts
// LPUSH to a list
await redis.send("LPUSH", ["mylist", "value1", "value2"]);

// LRANGE from a list
const list = await redis.send("LRANGE", ["mylist", "0", "-1"]);
```
