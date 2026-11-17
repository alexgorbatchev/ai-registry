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
      `<div class="key"><div><div class="legend">How to read</div></div></div><section class="step"><div class="win"><div class="toast">Saved</div><span class="open">⋯</span><div class="popover"><i class="caret-up"></i>x</div><div class="dock"></div><div class="scrim"></div><table><tr class="sel focus flash"><td>x</td></tr></table><span class="n">1</span></div><div class="cap"><h2>1. S</h2><span class="n">1</span></div></section>`,
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

  test("requires a caret on every popover, menu and submenu, side carets included", () => {
    const step = (mockup: string) =>
      lintPage(
        `${KEY}<section class="step"><div class="win"><span class="btn open">Actions ▾</span>${mockup}</div><div class="cap"><h2>1. S</h2></div></section>`,
        { name: "patterns.html" },
      );
    const missing = step(
      '<div class="popover menu"><div class="row"><b>3 reports</b></div><div class="row open">Move to ›</div>\n<div class="popover menu sub"><div class="row">Finance</div><div class="row">Archive</div></div></div>\n<div class="menu"><div class="row">Open</div></div>',
    );
    expect(missing.map((finding) => `${finding.rule}:${finding.line}`)).toEqual([
      "popover-caret:2",
      "popover-caret:3",
      "popover-caret:4",
    ]);
    const pointed = step(
      '<div class="popover menu"><i class="caret-up"></i><div class="row"><b>3 reports</b></div><div class="row open">Move to ›</div><div class="popover menu sub"><i class="caret-lf" style="top:10px"></i><div class="row">Finance</div><div class="row">Archive</div></div></div><div class="popover"><span class="caret-rt"></span><div class="menu"><div class="row">Open</div></div></div>',
    );
    expect(pointed).toEqual([]);
    const sideOnly = lintPage(
      `${KEY}<section class="step"><div class="win"><div class="popover"><i class="caret-lf"></i>Pick a folder</div></div><div class="cap"><h2>1. S</h2></div></section>`,
      { name: "patterns.html" },
    );
    expect(rules(sideOnly)).toEqual(["error popover-trigger"]);
  });
});

describe("legend colors", () => {
  const RED = (text: string) =>
    `<div class="key"><div><div class="legend">How to read: <span><i class="k" style="background:var(--bad)"></i>${text}</span> <span class="n">1</span></div></div></div>`;
  const MOCKUP =
    '<section class="step"><div class="win"><span class="btn danger">Delete 3 reports</span><span class="chip bad">Failed</span><span class="in err">x</span><del>Q3</del> <ins>Q4</ins><div class="row" style="color:var(--bad)">Delete…</div></div><div class="cap"><h2>1. S</h2></div></section>';

  test("a red legend entry names every meaning the mockups draw in red", () => {
    const findings = lintPage(`${RED("Red: destructive action")}${MOCKUP}`, { name: "patterns.html" });
    expect(findings.map((finding) => `${finding.rule}: ${finding.message.split(",")[0]}`)).toEqual([
      "legend-color: the red legend entry does not name errors and failures",
      "legend-color: the red legend entry does not name the before side of a change",
    ]);
    expect(
      lintPage(`${RED("Red: destructive action, an error or failure, or the value before a change")}${MOCKUP}`, {
        name: "patterns.html",
      }),
    ).toEqual([]);
  });

  test("treats a swatch drawn with the palette's literal red as a red entry", () => {
    for (const red of ["#f85149", "#33161a"]) {
      const legend = RED("Red: destructive action").replace("var(--bad)", red);
      expect(rules(lintPage(`${legend}${MOCKUP}`, { name: "patterns.html" }))).toEqual([
        "error legend-color",
        "error legend-color",
      ]);
    }
  });

  test("checks only the meanings a page uses, and pages without a red entry", () => {
    const destructiveOnly =
      '<section class="step"><div class="win"><span class="btn danger">Delete</span></div><div class="cap"><h2>1. S</h2></div></section>';
    expect(lintPage(`${RED("Red: destructive action")}${destructiveOnly}`, { name: "patterns.html" })).toEqual([]);
    expect(lintPage(`${KEY}${MOCKUP}`, { name: "patterns.html" })).toEqual([]);
    const errorsOnly =
      '<section class="step"><div class="win"><span class="banner bad">Export failed</span></div><div class="cap"><h2>1. S</h2></div></section>';
    expect(rules(lintPage(`${RED("Red outline: destructive lines")}${errorsOnly}`, { name: "patterns.html" }))).toEqual(
      ["error legend-color"],
    );
  });
});

describe("menu headings in any markup", () => {
  /** One mockup step whose window holds the opener (outlined as .open) and `menu`, on a page without flow nav. */
  const lintMenu = (menu: string) =>
    lintPage(
      `${KEY}<section class="step"><div class="win"><span class="btn open">Actions ▾</span>${menu}</div><div class="cap"><h2>1. S</h2></div></section>`,
      { name: "patterns.html" },
    );
  const headings = (findings: Finding[]) =>
    findings.filter((finding) => finding.rule === "menu-heading").map((finding) => finding.message.split(";")[0]);

  test("flags a muted row heading a single item in a menu drawn with page-local classes", () => {
    const findings = lintMenu(
      '<div class="box menu"><i class="caret-dn" style="right:38px"></i>\n<div class="mi muted">Share · 12 reports</div>\n<div class="mi"><b>Export to archive (12)</b><span class="sp"></span><kbd>E</kbd></div>\n<div class="mi muted">The folder menu offers the same item</div>\n</div>',
    );
    expect(rules(findings)).toEqual(["error menu-heading"]);
    expect(headings(findings)).toEqual(['menu heading "Share · 12 reports" labels 1 item(s)']);
    expect(findings[0].line).toBe(3);
  });

  test("flags group headings drawn as ARIA lists, heading elements, emphasized rows and nested sections", () => {
    const aria = lintMenu(
      '<ul class="dropdown" role="menu"><li role="presentation" class="group-title">Arrange</li><li role="menuitem">Sort by name</li><li role="separator"></li><li role="menuitem" class="danger">Delete folder…</li></ul>',
    );
    expect(headings(aria)).toEqual(['menu heading "Arrange" labels 1 item(s)']);
    const sections = lintMenu(
      "<menu><section><h4>History</h4><button>Show history…</button></section><section><h4>Open</h4><button>Open</button><button>Open in new window</button></section></menu>",
    );
    expect(headings(sections)).toEqual(['menu heading "History" labels 1 item(s)']);
    const emphasized = lintMenu(
      '<div class="popover"><span class="caret-up"></span><div class="from">From ⋯</div><div><b>3 reports</b></div><hr><div><strong>Share</strong></div><div>Email a link…</div><hr><div style="color:var(--bad)">Delete 3 reports…</div></div>',
    );
    expect(headings(emphasized)).toEqual(['menu heading "Share" labels 1 item(s)']);
    const wrapped = lintMenu(
      '<div class="menu"><div class="list"><div class="muted">Recent</div><div>Show history…</div></div></div>',
    );
    expect(headings(wrapped)).toEqual(['menu heading "Recent" labels 1 item(s)']);
  });

  test("checks surfaces drawn with a caret or opener line, whatever their class", () => {
    const flyout = lintMenu(
      '<div class="flyout"><i class="caret-dn"></i><div class="lbl">History</div><div class="row">Show history</div><div class="sep"></div><div class="row">Rename</div><div class="row">Move</div></div>',
    );
    expect(headings(flyout)).toEqual(['menu heading "History" labels 1 item(s)']);
  });

  test("suggests a missing reason when a muted row heads a group", () => {
    const findings = lintMenu(
      '<div class="menu"><i class="caret-up"></i><div class="row"><b>3 reports</b></div><div class="sep"></div><div class="row muted">Archive</div><div class="row">Export…</div></div>',
    );
    expect(findings.map((finding) => finding.message)).toEqual([
      'menu heading "Archive" labels 1 item(s); a heading labels two or more, so fold a lone item into its closest group or drop the heading; if this row is a disabled item, add its reason after .sp',
    ]);
  });

  test("leaves bold target headers and titled form, confirmation and picker popovers alone", () => {
    const clean = [
      '<div class="popover menu"><span class="caret-up"></span><div class="from">From ⋯</div><div class="row"><b>Report Q3</b></div><div class="row">Open<span class="sp"></span><kbd>Enter</kbd></div><div class="sep"></div><div class="row" style="color:var(--bad)">Delete…</div></div>',
      '<div class="menu"><div class="row"><b>budget.xlsx</b></div><div class="row">Open</div><div class="sep"></div><div class="row" style="color:var(--bad)">Delete…</div></div>',
      '<div class="popover"><span class="caret-dn"></span><div class="row"><b>Filter items</b></div><div class="fld"><span>Bin</span><span class="in">A-03</span></div><div class="sep"></div><div class="row"><span class="sp"></span><span class="btn">Clear</span><span class="btn pri">Apply</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><h3>Rename report</h3><div class="row"><span class="in">Q3 summary</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><div class="title">Delete 3 reports?</div><div class="row"><span class="sp"></span><span class="btn">Cancel</span><span class="btn danger">Delete</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><div class="header">Share link</div><div class="row">reports.example/q3<span class="sp"></span><span class="btn">Copy link</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><h4>Owner</h4><div>◉ Me</div><div class="sep"></div><div class="row"><span class="sp"></span><span class="btn pri">Apply</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><h3>Share report</h3><div class="row">Copy link…</div></div>',
    ];
    for (const menu of clean) expect(headings(lintMenu(menu))).toEqual([]);
  });

  test("leaves target headers, dimmed items, notes, disabled items, pickers and bars outside menus alone", () => {
    const clean = [
      '<div class="menu"><b>Quarterly ⋯</b><div class="muted">Rename</div><div class="hl">Export report…</div><div class="muted">Remove</div></div>',
      '<div class="menu"><b>Folder ⋯</b> <span class="chip">shared</span><div class="muted">New subfolder</div><div class="hl">Import into this folder…</div></div>',
      '<div class="menu"><div class="muted">Running</div><div class="row small">Export · 12 reports<span class="sp"></span><span class="btn">Cancel</span></div><div class="row small">Import · 3 files<span class="sp"></span><span class="btn">Cancel</span></div><div class="row small">Checked folder health · 2 issues</div></div>',
      '<div class="menu"><div class="row"><b>Report 7</b></div><div class="sep"></div><div class="row" style="color:var(--bad)">Delete…</div></div>',
      '<div class="menu"><div class="row"><b>3 reports</b></div><div class="row">Open</div><div class="row">Export…</div></div>',
      '<div class="menu"><div class="lbl">Open</div><ul><li>Open</li><li class="muted">Open in new tab<span class="sp"></span>Blocked by policy</li></ul><div class="muted">Right-click opens the same menu</div></div>',
      '<div class="popover"><span class="caret-dn"></span><div class="muted small">New name</div><div class="row"><span class="in">Q3 summary</span></div></div>',
      '<div class="popover"><span class="caret-dn"></span><div class="muted">Destination</div><div>◉ Finance</div><div>○ Archive</div></div>',
      '<div class="selbar"><span class="muted">Filter</span><span class="btn">Apply</span></div>',
    ];
    for (const menu of clean) expect(headings(lintMenu(menu))).toEqual([]);
  });
});

describe("navigation and links", () => {
  test("requires the flow nav links and reports a missing ticket as a warning", () => {
    const findings = lintPage(
      `${KEY}<nav class="top"><a href="page.html">self</a></nav><section class="step"><div class="win"></div><div class="cap"><h2>1. S</h2></div></section>`,
    );
    expect(rules(findings)).toEqual(["error nav", "error nav", "error nav", "error nav", "warning nav-ticket"]);
    const relative = lintPage(
      `${KEY}<nav class="top"><a href="../tickets/redesign.md">ticket</a></nav><section class="step"><div class="win"></div><div class="cap"><h2>1. S</h2></div></section>`,
    );
    expect(relative.filter((finding) => finding.rule === "nav-ticket").map((finding) => finding.message)).toEqual([
      "nav.top lacks a link to the redesign ticket (its URL)",
    ]);
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
  writeFileSync(
    flowPage,
    readFileSync(flowPage, "utf8").replace('<a>Show</a></div><span class="n">2</span>', "<a>Show</a></div>"),
  );
  const failed = Bun.spawnSync(["bun", join(SCRIPTS, "lint-wireframes.ts"), "--json", flowPage], { stdout: "pipe" });
  expect(failed.exitCode).toBe(1);
  expect(JSON.parse(failed.stdout.toString()).findings[0]).toMatchObject({ rule: "callout", severity: "error" });
  expect(Bun.spawnSync(["bun", join(SCRIPTS, "lint-wireframes.ts")], { stdout: "pipe" }).exitCode).toBe(2);
});
