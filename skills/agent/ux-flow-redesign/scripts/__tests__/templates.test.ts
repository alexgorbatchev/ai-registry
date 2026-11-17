import { afterAll, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDocsServer } from "../../assets/templates/serve-docs";
import { readCssRules, rootTokens } from "../lib/css";
import { factory_file, factory_testDirectory, TEMPLATES } from "./fixtures";

const servers: { stop: (force?: boolean) => void }[] = [];
afterAll(() => {
  for (const server of servers) server.stop(true);
});

test("every HTML template links the shared stylesheet and defines none of its tokens", () => {
  const tokens = rootTokens(readCssRules(readFileSync(join(TEMPLATES, "wireframe.css"), "utf8")));
  expect([...tokens]).toContain("--font");
  const pages = readdirSync(TEMPLATES).filter((name) => name.endsWith(".html"));
  expect(pages.sort()).toEqual(["flow-wireframe.html", "patterns.html", "wireframes-index.html"]);
  for (const page of pages) {
    const html = readFileSync(join(TEMPLATES, page), "utf8");
    expect(html).toContain('<link rel="stylesheet" href="wireframe.css">');
    expect(html).not.toContain("wireframe-css");
    for (const token of tokens) expect(html).not.toContain(`${token}:`);
  }
});

test("the stylesheet uses the full window width and one font token", () => {
  const rules = readCssRules(readFileSync(join(TEMPLATES, "wireframe.css"), "utf8"));
  const main = rules.find((rule) => rule.selector === "main");
  expect(main?.declarations.some((declaration) => declaration.property === "max-width")).toBe(false);
  const step = rules.find((rule) => rule.selector === ".step" && !rule.atRules.length);
  expect(step?.declarations.find((declaration) => declaration.property === "grid-template-columns")?.value).toBe(
    "minmax(0, 1fr) clamp(15rem, 40%, 48rem)",
  );
  const families = rules
    .flatMap((rule) => rule.declarations)
    .filter((declaration) => ["font", "font-family"].includes(declaration.property));
  expect(families.map((declaration) => declaration.value)).toEqual([
    "inherit",
    "14px/1.45 var(--font)",
    "11px var(--font)",
  ]);
});

test("the stylesheet keeps the focus ring on an edited field and draws carets on all four sides", () => {
  const rules = readCssRules(readFileSync(join(TEMPLATES, "wireframe.css"), "utf8"));
  const shadow = (selector: string) =>
    rules
      .find((rule) => rule.selector === selector)
      ?.declarations.find((declaration) => declaration.property === "box-shadow")
      ?.value.replace(/\s+/g, " ");
  const ring = shadow(".focusring");
  const edited = shadow(".in.changed");
  expect(ring).toBe("0 0 0 2px var(--acc)");
  expect(edited).toBe("inset 3px 0 var(--acc)");
  // `.in.changed` outranks `.focusring`, so the combination must carry both shadows.
  expect(shadow(".in.changed.focusring")).toBe(`${edited}, ${ring}`);
  const carets = rules.find((rule) => rule.selector.includes(".caret-dn"))?.selector.split(/\s*,\s*/);
  expect(carets).toEqual([".caret-dn", ".caret-up", ".caret-lf", ".caret-rt"]);
  for (const side of [".caret-lf", ".caret-rt"]) expect(rules.some((rule) => rule.selector === side)).toBe(true);
});

test("the docs server renders Markdown, serves HTML and CSS, and refuses anything else", async () => {
  const root = factory_testDirectory("serve-docs");
  factory_file(
    join(root, "index.md"),
    "---\ncreated_on: 2026-01-01 00:00\n---\n\n# Home <b>\n\n[page](sub/page.html)\n",
  );
  factory_file(join(root, "sub/page.html"), "<h1>Page</h1>");
  factory_file(join(root, "sub/wireframe.css"), "body{}");
  factory_file(join(root, "secret.txt"), "no");
  const server = createDocsServer(root, 0);
  servers.push(server);
  const home = await fetch(server.url);
  const html = await home.text();
  expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(html).toContain("<title>Home &lt;b&gt;</title>");
  expect(html).toContain("var(--font)");
  expect(html).not.toContain("created_on");
  expect((await fetch(new URL("sub/wireframe.css", server.url))).headers.get("content-type")).toBe(
    "text/css; charset=utf-8",
  );
  expect((await fetch(new URL("sub/page.html", server.url))).status).toBe(200);
  for (const path of ["secret.txt", "..%2fsecret.txt", "sub/..%2f..%2fetc", "%E0%A4%A"]) {
    expect((await fetch(new URL(path, server.url))).status).toBe(404);
  }
  expect((await fetch(server.url, { method: "POST" })).status).toBe(405);
});

test("the pattern page scopes its full-width section rules to section.full, so .app.full mockups keep the stylesheet spacing", () => {
  const html = readFileSync(join(TEMPLATES, "patterns.html"), "utf8");
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const selectors = readCssRules(style).flatMap((rule) => rule.selector.split(/\s*,\s*/));
  // A compound that starts with `.full` also matches the stylesheet's `.app.full` mockups.
  expect(selectors.filter((selector) => /(^|[\s>+~(])\.full\b/.test(selector))).toEqual([]);
  expect(selectors.filter((selector) => /^section\.full\b/.test(selector)).length).toBeGreaterThanOrEqual(2);
});
