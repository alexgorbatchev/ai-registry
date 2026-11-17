#!/usr/bin/env bun
// Minimal local documentation server: serves HTML pages as they are and renders Markdown (front matter stripped,
// title from the first H1). Copy it into the project (for example scripts/serveDocs.ts) and run:
//   DOCS_DIR=docs/internal PORT=3000 bun scripts/serveDocs.ts
// Requires a Bun version with the built-in Bun.markdown API. Binds to loopback only; GET and HEAD only; serves only
// files found under DOCS_DIR, so encoded "../" paths get 404.
import { extname } from "node:path";

const STYLE =
  ':root{color-scheme:dark;--font:"Maple Mono Normal NF","Maple Mono Normal","Maple Mono NF","Maple Mono",ui-monospace,monospace}' +
  "code,pre,samp,kbd{font-family:inherit}" +
  "body{font:14px/1.55 var(--font);max-width:80rem;margin:2rem auto;padding:0 1rem;color:#e6edf3;background:#0d1117}a{color:#4493f8}" +
  "th,td{text-align:left;padding:.35rem .8rem}table{border-collapse:collapse}tr{border-bottom:1px solid #3d444d}code{font-size:.9em}";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function renderMarkdown(source: string, fallbackTitle: string): Promise<string> {
  const markdown = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  const title = escapeHtml(/^# (.+)$/m.exec(markdown)?.[1] ?? fallbackTitle);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${STYLE}</style></head><body>${Bun.markdown.html(markdown)}</body></html>`;
}

export function createDocsServer(directory: string, port: number, title = "Documentation") {
  const pages = new Bun.Glob("**/*.{html,md,css,svg,png}");
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      const pathname = new URL(request.url).pathname;
      let requested: string;
      try {
        requested = decodeURIComponent(pathname.slice(1));
      } catch {
        return new Response("Not found", { status: 404 });
      }
      if (requested === "" || requested.endsWith("/")) requested += "index.md";
      const candidates = requested.endsWith("index.md")
        ? [requested, requested.replace(/index\.md$/, "index.html")]
        : [requested];
      const files = new Set(pages.scanSync(directory));
      const match = candidates.find((candidate) => files.has(candidate));
      if (!match) return new Response("Not found", { status: 404 });
      const headers = { "Cache-Control": "no-cache" };
      if (match.endsWith(".md")) {
        const html = await renderMarkdown(await Bun.file(`${directory}/${match}`).text(), title);
        return new Response(html, { headers: { ...headers, "Content-Type": TYPES[".html"] } });
      }
      return new Response(Bun.file(`${directory}/${match}`), {
        headers: { ...headers, "Content-Type": TYPES[extname(match)] },
      });
    },
  });
}

if (import.meta.main) {
  const server = createDocsServer(
    process.env.DOCS_DIR ?? "docs",
    Number(process.env.PORT ?? 3000),
    process.env.DOCS_TITLE,
  );
  console.log(`serving ${process.env.DOCS_DIR ?? "docs"} at ${server.url}`);
}
