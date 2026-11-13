#!/usr/bin/env bun
/**
 * Serves a local directory on loopback so Penpot plugin code running in the browser can fetch it.
 *
 * Usage:
 *   bun <skill>/scripts/serve-assets.ts <dir> [port=47831]
 *
 * Every response carries CORS and Private Network Access headers. Plugin fetch responses expose only text() and
 * json(), so a request for <path>.b64 returns the file at <path> as base64 text; decode it in the plugin and pass
 * the bytes to penpot.uploadMediaData. JSON files can be fetched as-is. Paths cannot escape <dir>.
 * Each request is logged to stdout so a hanging plugin fetch can be told apart from one that never arrived.
 */
import { join, normalize, resolve, sep } from "node:path";

const [dirArgument, portArgument = "47831"] = process.argv.slice(2);
if (!dirArgument) {
  console.error("usage: bun serve-assets.ts <dir> [port]");
  process.exit(1);
}
const root = resolve(dirArgument);
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-allow-private-network": "true",
};
const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", json: "application/json" };

function resolveInside(pathname: string): string | null {
  const target = normalize(join(root, decodeURIComponent(pathname)));
  return target === root || target.startsWith(root + sep) ? target : null;
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(portArgument),
  async fetch(request) {
    const { pathname } = new URL(request.url);
    console.log(new Date().toISOString(), request.method, pathname, request.headers.get("origin") ?? "-");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const base64 = pathname.endsWith(".b64");
    const target = resolveInside(base64 ? pathname.slice(0, -4) : pathname);
    const file = target ? Bun.file(target) : null;
    if (!file || !(await file.exists())) return new Response("not found", { status: 404, headers: cors });
    if (base64) return new Response(Buffer.from(await file.arrayBuffer()).toString("base64"), { headers: { ...cors, "content-type": "text/plain" } });
    const extension = target!.split(".").pop()?.toLowerCase() ?? "";
    return new Response(file, { headers: { ...cors, "content-type": types[extension] ?? "application/octet-stream" } });
  },
});
console.log(`serving ${root} on http://127.0.0.1:${server.port}`);
