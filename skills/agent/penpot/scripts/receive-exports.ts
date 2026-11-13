#!/usr/bin/env bun
/**
 * Receives PNG exports POSTed by Penpot plugin code and writes them to a local directory for inspection.
 *
 * Usage:
 *   bun <skill>/scripts/receive-exports.ts <dir> [port=47832]
 *
 * Plugin code exports a shape with `shape.export({ type: "png", scale })`, base64-encodes the bytes, and POSTs
 * `b64:<base64>` to `http://127.0.0.1:<port>/?name=<file>.png`. The file name is reduced to its basename, so
 * writes cannot escape <dir>. Responses carry CORS and Private Network Access headers.
 */
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [dirArgument, portArgument = "47832"] = process.argv.slice(2);
if (!dirArgument) {
  console.error("usage: bun receive-exports.ts <dir> [port]");
  process.exit(1);
}
const root = resolve(dirArgument);
mkdirSync(root, { recursive: true });
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-allow-private-network": "true",
};

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(portArgument),
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
    const name = basename(new URL(request.url).searchParams.get("name") ?? "");
    const body = await request.text();
    if (!name || name === "." || name === ".." || !body.startsWith("b64:")) {
      return new Response("expected ?name=<file> and a b64:<base64> body", { status: 400, headers: cors });
    }
    const bytes = Buffer.from(body.slice(4), "base64");
    await Bun.write(join(root, name), bytes);
    console.log(new Date().toISOString(), name, bytes.length);
    return new Response("ok", { headers: cors });
  },
});
console.log(`receiving into ${root} on http://127.0.0.1:${server.port}`);
