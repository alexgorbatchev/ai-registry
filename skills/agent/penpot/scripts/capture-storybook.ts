#!/usr/bin/env bun
/**
 * Captures every story of a static Storybook build as a PNG, once per globals variant, for Penpot reference boards.
 *
 * Usage (run from the project that has Playwright installed):
 *   bun <skill>/scripts/capture-storybook.ts --static <storybook-static dir> --out <dir>
 *     [--variant <name>=<globals>]... [--filter <story id regex>] [--concurrency 6] [--width 640] [--scale 2] [--settle 250]
 *
 * --variant may repeat; <globals> uses Storybook URL syntax, for example dark=theme:dark;density:comfortable.
 * Without --variant one "default" variant uses the project's initial globals.
 * Stories render their initial state: embed=true disables play functions, and the script waits for Storybook's
 * storyRendered event. Screenshots are cropped to painted content plus 16px padding; empty renders keep the full page.
 * Existing PNGs are reused, so a rerun only captures what is missing or failed.
 * Writes <out>/<variant>/<story id>.png, <out>/manifest.json, and <out>/failures.json; exits 1 when any story failed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

type Variant = { name: string; globals: Record<string, string>; query: string };
type Story = { id: string; title: string; name: string; importPath: string; type: string };

function parseArgs(argv: string[]) {
  const options = { staticDir: "", outDir: "", variants: [] as Variant[], filter: "", concurrency: 6, width: 640, scale: 2, settle: 250 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for ${flag}`);
    if (flag === "--static") options.staticDir = resolve(value);
    else if (flag === "--out") options.outDir = resolve(value);
    else if (flag === "--filter") options.filter = value;
    else if (flag === "--concurrency") options.concurrency = Number(value);
    else if (flag === "--width") options.width = Number(value);
    else if (flag === "--scale") options.scale = Number(value);
    else if (flag === "--settle") options.settle = Number(value);
    else if (flag === "--variant") {
      const separator = value.indexOf("=");
      const name = separator < 0 ? value : value.slice(0, separator);
      const query = separator < 0 ? "" : value.slice(separator + 1);
      const globals = Object.fromEntries(query.split(";").filter(Boolean).map((pair) => pair.split(":") as [string, string]));
      options.variants.push({ name, globals, query });
    } else throw new Error(`unknown flag ${flag}`);
  }
  if (!options.staticDir || !options.outDir) throw new Error("--static and --out are required");
  if (options.variants.length === 0) options.variants.push({ name: "default", globals: {}, query: "" });
  return options;
}

const options = parseArgs(process.argv.slice(2));
const projectRequire = createRequire(join(process.cwd(), "package.json"));
const { chromium } = projectRequire("playwright");

const index = JSON.parse(readFileSync(join(options.staticDir, "index.json"), "utf8"));
const filter = new RegExp(options.filter);
const stories = (Object.values(index.entries) as Story[]).filter((entry) => entry.type === "story" && filter.test(entry.id));

const contentTypes: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".txt": "text/plain" };
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(join(options.staticDir, path === "/" ? "index.html" : path));
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    return new Response(file, { headers: { "content-type": contentTypes[extname(path)] ?? "application/octet-stream" } });
  },
});
const base = `http://127.0.0.1:${server.port}`;

// Runs in the page: switches story through Storybook's channel and resolves with the terminal render event.
const RENDER = `(${String((args: { id: string; globals: Record<string, string> }) => new Promise<string>((done) => {
  const channel = (window as any).__STORYBOOK_ADDONS_CHANNEL__;
  const events = ["storyRendered", "storyErrored", "storyThrewException", "playFunctionThrewException", "storyMissing"];
  const handlers: Record<string, (payload: unknown) => void> = {};
  const timer = setTimeout(() => finish("timeout"), 20000);
  function finish(result: string) {
    clearTimeout(timer);
    for (const event of events) channel.off(event, handlers[event]);
    done(result);
  }
  for (const event of events) {
    handlers[event] = (payload) => { if (event !== "storyRendered" || payload === args.id) finish(event); };
    channel.on(event, handlers[event]);
  }
  if (Object.keys(args.globals).length > 0) channel.emit("updateGlobals", { globals: args.globals });
  channel.emit("setCurrentStory", { storyId: args.id, viewMode: "story" });
}))})`;

// Runs in the page: union of painted element and text boxes, excluding the story root and its ancestors.
const CONTENT_BOX = () => {
  const root = document.querySelector("#storybook-root") ?? document.body;
  const excluded = new Set<Element>([document.documentElement, document.body, root]);
  if (root.firstElementChild) excluded.add(root.firstElementChild);
  for (let element = root.parentElement; element; element = element.parentElement) excluded.add(element);
  const media = new Set(["IMG", "svg", "CANVAS", "INPUT", "TEXTAREA", "VIDEO", "IFRAME", "HR", "SELECT"]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (rect: DOMRect) => {
    if (rect.width <= 1 || rect.height <= 1) return;
    x0 = Math.min(x0, rect.left + scrollX); y0 = Math.min(y0, rect.top + scrollY);
    x1 = Math.max(x1, rect.right + scrollX); y1 = Math.max(y1, rect.bottom + scrollY);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      add(range.getBoundingClientRect());
      continue;
    }
    const element = node as Element;
    if (excluded.has(element)) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    const painted = style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none" || parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderBottomWidth) > 0 || style.boxShadow !== "none" || (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || media.has(element.tagName);
    if (painted) add(element.getBoundingClientRect());
  }
  if (!Number.isFinite(x0) || x1 - x0 < 1 || y1 - y0 < 1) return null;
  const pad = 16;
  const pageWidth = document.documentElement.scrollWidth, pageHeight = document.documentElement.scrollHeight;
  const x = Math.max(0, Math.floor(x0 - pad)), y = Math.max(0, Math.floor(y0 - pad));
  const width = Math.min(pageWidth, Math.ceil(x1 + pad)) - x, height = Math.min(pageHeight, Math.ceil(y1 + pad)) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
};

const browser = await chromium.launch();
const manifest: Record<string, unknown>[] = [];
const failures: { id: string; variant: string; error: string }[] = [];
const queue = options.variants.flatMap((variant) => stories.map((story) => ({ story, variant })));
let done = 0;
const started = Date.now();

async function worker() {
  const context = await browser.newContext({ viewport: { width: options.width, height: 480 }, deviceScaleFactor: options.scale, reducedMotion: "reduce" });
  let page = await context.newPage();
  let bootedVariant = "";
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { story, variant } = job;
    const directory = join(options.outDir, variant.name);
    mkdirSync(directory, { recursive: true });
    const file = join(directory, `${story.id}.png`);
    try {
      if (!existsSync(file)) {
        if (bootedVariant !== variant.name) {
          const globals = variant.query ? `&globals=${variant.query}` : "";
          await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story&embed=true${globals}`, { waitUntil: "load", timeout: 30000 });
          await page.waitForFunction(() => (window as any).__STORYBOOK_ADDONS_CHANNEL__, null, { timeout: 15000 });
          bootedVariant = variant.name;
        }
        const result = await page.evaluate(`${RENDER}(${JSON.stringify({ id: story.id, globals: variant.globals })})`);
        if (result !== "storyRendered") {
          bootedVariant = "";
          await page.close();
          page = await context.newPage();
          throw new Error(`render result ${result}`);
        }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(options.settle);
        const box = await page.evaluate(CONTENT_BOX);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled", ...(box ? { clip: box } : {}) });
      }
      const png = readFileSync(file);
      manifest.push({ id: story.id, title: story.title, name: story.name, importPath: story.importPath, variant: variant.name, file: `${variant.name}/${story.id}.png`, width: png.readUInt32BE(16) / options.scale, height: png.readUInt32BE(20) / options.scale });
    } catch (error) {
      failures.push({ id: story.id, variant: variant.name, error: String(error).split("\n")[0].slice(0, 200) });
    }
    if (++done % 100 === 0) console.error(`${done}/${options.variants.length * stories.length} done, ${failures.length} failed`);
  }
  await context.close();
}

try {
  await Promise.all(Array.from({ length: options.concurrency }, worker));
} finally {
  await browser.close();
  server.stop(true);
}
const order = new Map(stories.map((story, position) => [story.id, position]));
manifest.sort((a: any, b: any) => a.variant.localeCompare(b.variant) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
mkdirSync(options.outDir, { recursive: true });
writeFileSync(join(options.outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
writeFileSync(join(options.outDir, "failures.json"), JSON.stringify(failures, null, 1));
console.log(`captured ${manifest.length}, failed ${failures.length}, ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failures.length > 0 ? 1 : 0);
