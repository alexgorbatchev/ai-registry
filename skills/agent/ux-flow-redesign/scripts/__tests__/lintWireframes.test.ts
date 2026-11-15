import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lintWireframes, type Finding } from "../lib/lintWireframes";
import {
  factory_file,
  factory_page,
  factory_testDirectory,
  factory_wireframeSet,
  SCRIPTS,
  TEMPLATES,
} from "./fixtures";

const rules = (findings: Finding[]) => findings.map((finding) => `${finding.severity} ${finding.rule}`).sort();

/** A wireframes directory with the shared stylesheet and one page holding `body`. */
function lintPage(body: string, options: { head?: string; name?: string } = {}): Finding[] {
  const root = factory_testDirectory("lint-page");
  copyFileSync(join(TEMPLATES, "wireframe.css"), join(root, "wireframe.css"));
  const page = factory_file(join(root, options.name ?? "page.html"), factory_page(body, options.head));
  return lintWireframes([page]);
}

const KEY =
  '<div class="key"><div><div class="legend">How to read: toast, popover or menu, panel, backdrop, selected, changed, cursor <span class="n">1</span></div></div></div>';

test("the filled flow, index and pattern templates lint clean", () => {
  const { pages } = factory_wireframeSet(factory_testDirectory("lint-clean"));
  expect(lintWireframes(pages)).toEqual([]);
});

describe("shared stylesheet", () => {
  test("requires the link, and flags copied blocks, redefined tokens, other fonts and a capped layout", () => {
    const root = factory_testDirectory("lint-sheet");
    copyFileSync(join(TEMPLATES, "wireframe.css"), join(root, "wireframe.css"));
    const unlinked = factory_file(
      join(root, "a.html"),
      "<!doctype html><html><head></head><body><h1>A</h1></body></html>",
    );
    const styled = factory_file(
      join(root, "b.html"),
      factory_page(
        '<p style="font-family:Arial">x</p>',
        "<style>/* wireframe-css v3 */\n:root{--ink:#000;--key-h:4rem}\nmain{max-width:80rem;font:12px/1 system-ui,sans-serif}\nkbd{font:11px var(--font)}button{font:inherit}</style>",
      ),
    );
    const findings = lintWireframes([unlinked, styled]);
    expect(rules(findings)).toEqual([
      "error copied-block",
      "error font-family",
      "error font-family",
      "error layout-cap",
      "error stylesheet",
      "error token-redefined",
    ]);
    expect(findings.find((finding) => finding.rule === "token-redefined")?.line).toBe(2);
  });

  test("checks the stylesheet itself and warns when pages link different copies", () => {
    const root = factory_testDirectory("lint-copies");
    factory_file(join(root, "one/wireframe.css"), ":root{--ink:#000}\nbody{font:14px system-ui}");
    factory_file(join(root, "two/wireframe.css"), ":root{--font:monospace}");
    const first = factory_file(join(root, "one/a.html"), factory_page(""));
    const second = factory_file(join(root, "two/b.html"), factory_page(""));
    expect(rules(lintWireframes([first, second]))).toEqual([
      "error font-family",
      "error font-token",
      "warning stylesheet",
    ]);
  });
});

describe("mockup steps", () => {
  test("pairs callouts in the mockup with the caption both ways and rejects duplicates", () => {
    const findings = lintPage(
      `${KEY}<section class="step"><div class="win"><span class="n">1</span><span class="n">2</span></div><div class="cap"><h2>1. Step</h2><ol><li><span class="n">1</span> a</li><li><span class="n">1</span> b</li><li><span class="n">3</span> c</li></ol></div></section>`,
      { name: "patterns.html" },
    );
    expect(findings.map((finding) => finding.message)).toEqual([
      "callout 1 is explained twice in this caption",
      "callout 2 in the mockup is not explained in its caption",
      "caption explains callout 3, which the mockup does not show",
    ]);
  });

  test("requires a captioned mockup and the legend inside the sticky key", () => {
    const findings = lintPage(
      '<div class="legend">How to read</div><section class="step"><div class="win"></div></section>',
      { name: "patterns.html" },
    );
    expect(rules(findings)).toEqual(["error legend", "error legend", "error step"]);
  });

  test("requires a legend entry for every convention the mockups use", () => {
    const findings = lintPage(
      `<div class="key"><div><div class="legend">How to read</div></div></div><section class="step"><div class="win"><div class="toast">Saved</div><div class="popover">x</div><div class="dock"></div><div class="scrim"></div><table><tr class="sel focus flash"><td>x</td></tr></table><span class="n">1</span></div><div class="cap"><h2>1. S</h2><span class="n">1</span></div></section>`,
      { name: "patterns.html" },
    );
    expect(findings.map((finding) => finding.message.replace(/^the mockups use (the )?/, ""))).toEqual([
      "toast convention but the legend does not explain it",
      "popover or menu convention but the legend does not explain it",
      "docked panel convention but the legend does not explain it",
      "dimmed backdrop convention but the legend does not explain it",
      "selected rows convention but the legend does not explain it",
      "just-changed tint convention but the legend does not explain it",
      "row cursor convention but the legend does not explain it",
      "numbered callouts but the legend does not explain them",
    ]);
  });
});

describe("surfaces", () => {
  test("rejects single-item menu headings, untriggered popovers and decisions in toasts", () => {
    const findings = lintPage(
      `${KEY}<section class="step"><div class="win"><div class="popover menu"><i class="caret-up"></i><div class="from">From ⋯</div><div class="lbl">Edit</div><div class="row">Rename</div><div class="lbl">History</div><div class="row">History…</div><div class="sep"></div><div class="row">Delete…</div></div><div class="toast">Saved <span class="btn">Apply</span></div></div><div class="cap"><h2>1. S</h2></div></section>`,
      { name: "patterns.html" },
    );
    expect(rules(findings)).toEqual([
      "error menu-heading",
      "error menu-heading",
      "error popover-trigger",
      "error toast-action",
    ]);
  });
});

describe("navigation and links", () => {
  test("requires the flow nav links and reports a missing ticket as a warning", () => {
    const findings = lintPage(
      `${KEY}<nav class="top"><a href="page.html">self</a></nav><section class="step"><div class="win"></div><div class="cap"><h2>1. S</h2></div></section>`,
    );
    expect(rules(findings)).toEqual(["error nav", "error nav", "error nav", "error nav", "warning nav-ticket"]);
  });

  test("resolves files, directories, fragments and root links", () => {
    const root = factory_testDirectory("lint-links");
    copyFileSync(join(TEMPLATES, "wireframe.css"), join(root, "wireframe.css"));
    factory_file(join(root, "other.html"), '<h1 id="there">Other</h1>');
    factory_file(join(root, "docs/index.md"), "# Docs");
    mkdirSync(join(root, "empty"));
    const page = factory_file(
      join(root, "page.html"),
      factory_page(
        '<a href="#here" id="here">ok</a><a href="#nowhere">x</a><a href="other.html#there">ok</a><a href="other.html#gone">x</a><a href="missing.html">x</a><a href="empty/">x</a><a href="docs/">ok</a><a href="/other.html">ok</a><a href="/nope.html">x</a><a href="https://example.com/">ok</a><a href="%E0%A4%A">x</a>',
      ),
    );
    const findings = lintWireframes([page], { siteRoot: root });
    expect(findings.map((finding) => finding.message.split(" (")[0])).toEqual([
      "#nowhere matches no id on this page",
      "other.html#gone: #gone matches no id in other.html",
      "missing.html does not exist",
      "empty/ is a directory without an index page; link a page instead",
      "/nope.html does not exist",
      "%E0%A4%A is not a valid URL path",
    ]);
    expect(lintWireframes([page]).filter((finding) => finding.message.startsWith("/nope"))).toEqual([]);
  });
});

test("flags unfilled placeholders, h1 count and duplicate ids", () => {
  const root = factory_testDirectory("lint-document");
  copyFileSync(join(TEMPLATES, "wireframe.css"), join(root, "wireframe.css"));
  const page = factory_file(
    join(root, "page.html"),
    '<link rel="stylesheet" href="wireframe.css"><h1>A</h1><h1 id="x">{{TITLE}}</h1><p id="x"></p>',
  );
  expect(rules(lintWireframes([page]))).toEqual(["error duplicate-id", "error h1", "error placeholder"]);
});

test("the CLI prints findings, writes JSON and exits non-zero on errors", async () => {
  const { flowPage, wireframes } = factory_wireframeSet(factory_testDirectory("lint-cli"));
  const clean = Bun.spawnSync(["bun", join(SCRIPTS, "lint-wireframes.ts"), wireframes], { stdout: "pipe" });
  expect(clean.exitCode).toBe(0);
  expect(clean.stdout.toString()).toContain("3 page(s), 0 error(s), 0 warning(s)");
  writeFileSync(flowPage, readFileSync(flowPage, "utf8").replace('<span class="n">3</span></div>', "</div>"));
  const failed = Bun.spawnSync(["bun", join(SCRIPTS, "lint-wireframes.ts"), "--json", flowPage], { stdout: "pipe" });
  expect(failed.exitCode).toBe(1);
  expect(JSON.parse(failed.stdout.toString()).findings[0]).toMatchObject({ rule: "callout", severity: "error" });
  expect(Bun.spawnSync(["bun", join(SCRIPTS, "lint-wireframes.ts")], { stdout: "pipe" }).exitCode).toBe(2);
});
