import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { crawlSite } from "../lib/crawlSite";
import { factory_file, factory_testRoot, SCRIPTS } from "./fixtures";

// Registered at module scope so the directory lives until every test in this file finishes.
const root = factory_testRoot("crawl-root");
for (const path of ["index.md", "a.html", "b.md", "orphan.html", "sub/index.html"]) factory_file(join(root, path), "x");
let server: ReturnType<typeof Bun.serve>;

const PAGES: Record<string, string> = {
  "/": '<h1>Docs</h1><a href="a.html#top">a</a><a href="a.html#gone">gone</a><a href="missing.html">missing</a><a href="https://elsewhere.example/x">out</a><a href="../references/x.md">github only</a><a href="mailto:x@example.com">mail</a><link rel="stylesheet" href="site.css">',
  "/a.html": '<h1 id="top">A</h1><a href="/">home</a><a href="b.md">b</a><img src="shot.png">',
  "/b.md": "<h1>B</h1>",
  "/site.css": "body{}",
};

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const pathname = new URL(request.url).pathname;
      const body = PAGES[pathname];
      if (body === undefined) return new Response("Not found", { status: 404 });
      return new Response(body, {
        headers: { "Content-Type": pathname.endsWith(".css") ? "text/css" : "text/html; charset=utf-8" },
      });
    },
  });
});

afterAll(() => {
  server.stop(true);
});

test("reports broken links, missing fragments, unreached files and skipped links", async () => {
  const result = await crawlSite({ start: server.url.href, rootDir: root, ignore: [/\/references\//] });
  expect(result.started).toBe(true);
  expect(result.pages).toBe(3);
  expect(
    result.broken.map((problem) => [new URL(problem.url).pathname, problem.status, problem.referrers.length]),
  ).toEqual([
    ["/missing.html", 404, 1],
    ["/shot.png", 404, 1],
  ]);
  expect(result.missingFragments.map((problem) => new URL(problem.url).hash)).toEqual(["#gone"]);
  expect(result.orphans).toEqual(["orphan.html", "sub/index.html"]);
  expect(result.skipped).toEqual([new URL("/references/x.md", server.url).href]);
  expect(result.externalUnchecked).toBe(1);
});

test("requests external links on demand and stops when the start page fails", async () => {
  const external = await crawlSite({ start: server.url.href, external: true, timeoutMs: 2000 });
  expect(external.externalUnchecked).toBe(0);
  expect(external.broken.some((problem) => problem.url.startsWith("https://elsewhere.example"))).toBe(true);
  const failed = await crawlSite({ start: new URL("/nothing.html", server.url).href, rootDir: root });
  expect(failed).toMatchObject({ started: false, pages: 0, orphans: [] });
  expect(failed.broken[0].status).toBe(404);
});

// The CLI runs as a child process while this process serves the site, so it must not block the event loop.
async function cli(...args: string[]): Promise<{ code: number; stdout: string }> {
  const child = Bun.spawn(["bun", join(SCRIPTS, "crawl-site.ts"), ...args], { stdout: "pipe", stderr: "ignore" });
  const stdout = await new Response(child.stdout).text();
  return { code: await child.exited, stdout };
}

test("the CLI exits non-zero with a summary, and explains an unreachable start page", async () => {
  const run = await cli(server.url.href, "--ignore", "/references/");
  expect(run.code).toBe(1);
  expect(run.stdout).toContain("3 page(s)");
  expect(run.stdout).toContain("linked from");
  expect(JSON.parse((await cli("--json", server.url.href)).stdout).started).toBe(true);
  const down = await cli("http://127.0.0.1:9/");
  expect(down.code).toBe(1);
  expect(down.stdout).toContain("start page unreachable");
  expect((await cli()).code).toBe(2);
});
