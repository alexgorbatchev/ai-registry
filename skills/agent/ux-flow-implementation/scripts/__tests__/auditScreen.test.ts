import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  analyzeScreen,
  auditScreen,
  collectorScript,
  contrast,
  DEFAULT_GAP_LIMIT,
  measureDensity,
  failed,
  hex,
  hideScript,
  isLargeText,
  pinScript,
  scrollMetricsScript,
  scrollToScript,
  UNMARK_SCROLLER_SCRIPT,
  SETTLE_MS,
  settledExpression,
  UNPIN_SCRIPT,
  type BrowserRunner,
  type ScreenSnapshot,
} from "../lib/auditScreen";
import { QA_THEMES, QA_VIEWPORTS } from "../lib/matrix";
import {
  AUDIT_FIXTURE_PAGE,
  DENSITY_PAGE,
  PINNED_BARS_PAGE,
  APP_SHELL_PAGE,
  SIDE_PANEL_PAGE,
  PINNED_PAGE,
  SCRIPTED_THEME_PAGE,
  SCROLL_ANIMATION_PAGE,
  WIDE_GUTTER_PAGE,
} from "./auditScreenPage";
import { factory_testDirectory, SCRIPTS } from "./fixtures";
import { readPng, rowsOfColor } from "./png";

type Control = ScreenSnapshot["controls"][number];

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

function control(selector: string, overrides: Partial<Control> = {}): Control {
  return {
    selector,
    label: selector,
    kind: "action",
    rect: { x: 0, y: 0, width: 80, height: 32 },
    group: null,
    disabled: false,
    inlineText: false,
    nativeAppearance: false,
    hasText: true,
    hasIcon: false,
    outside: WHITE,
    fill: null,
    borders: [[118, 118, 118]],
    ...overrides,
  };
}

function snapshot(overrides: Partial<ScreenSnapshot> = {}): ScreenSnapshot {
  return {
    url: "http://127.0.0.1/",
    viewport: { width: 390, height: 800 },
    colorScheme: "light",
    page: { scrollWidth: 390, clientWidth: 390 },
    texts: [],
    controls: [],
    overflowing: [],
    content: { root: { selector: "body", rect: { x: 0, y: 0, width: 390, height: 800 } }, first: null, extents: [] },
    ...overrides,
  };
}

/** A content root 1000 px wide from x 200, holding the given extents. */
function content(extents: [number, number][], first: ScreenSnapshot["content"]["first"] = null) {
  return { root: { selector: "main", rect: { x: 200, y: 0, width: 1000, height: 900 } }, first, extents };
}

describe("contrast math", () => {
  test("matches the WCAG reference values", () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21, 5);
    expect(contrast([118, 118, 118], WHITE)).toBeCloseTo(4.54, 2);
    expect(contrast([119, 119, 119], WHITE)).toBeLessThan(4.5);
    expect(hex([10, 255, 0])).toBe("#0aff00");
  });

  test("treats 24 px, or 18.66 px bold, as large text", () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 600)).toBe(false);
    expect(isLargeText(16, 900)).toBe(false);
  });
});

describe("analyzeScreen", () => {
  test("applies 4.5:1 to body text and 3:1 to large text, and lists unresolved backgrounds", () => {
    const grey: [number, number, number] = [140, 140, 140];
    const report = analyzeScreen(
      snapshot({
        texts: [
          { selector: "#body", text: "Body", fontSize: 16, fontWeight: 400, foreground: grey, background: WHITE },
          { selector: "#heading", text: "Heading", fontSize: 24, fontWeight: 400, foreground: grey, background: WHITE },
          {
            selector: "#dim-heading",
            text: "Dim",
            fontSize: 24,
            fontWeight: 400,
            foreground: [200, 200, 200],
            background: WHITE,
          },
          { selector: "#photo", text: "Caption", fontSize: 16, fontWeight: 400, foreground: grey, background: null },
        ],
      }),
    );
    expect(report.textContrast.map((issue) => [issue.selector, issue.required])).toEqual([
      ["#body", 4.5],
      ["#dim-heading", 3],
    ]);
    expect(report.textContrast[0]).toMatchObject({ ratio: 3.36, foreground: "#8c8c8c", background: "#ffffff" });
    expect(report.unresolved).toEqual([{ selector: "#photo", label: "Caption" }]);
    expect(report.summary.textContrast).toBe(2);
  });

  test("takes the strongest of border and fill as a control's boundary and needs 3:1", () => {
    const faint: [number, number, number] = [230, 230, 230];
    const report = analyzeScreen(
      snapshot({
        controls: [
          control("#faint-border", { kind: "field", borders: [faint] }),
          control("#faint-border-solid-fill", { borders: [faint], fill: [40, 40, 40] }),
          control("#faint-fill", { borders: [], fill: faint }),
          control("#same-fill", { borders: [], fill: WHITE }),
          control("#close-icon", { borders: [], hasText: false, hasIcon: true }),
          control("#icon-and-text", { borders: [], hasIcon: true }),
          control("#ghost-link", { kind: "link", borders: [] }),
          control("#disabled", { borders: [faint], disabled: true }),
          control("#native-checkbox", { kind: "toggle", borders: [faint], nativeAppearance: true }),
          control("#over-image", { borders: [faint], outside: null }),
          control("#tab", { kind: "other", borders: [faint] }),
        ],
      }),
    );
    expect(report.controlBoundary.map((issue) => [issue.selector, issue.boundary])).toEqual([
      ["#faint-border", "border"],
      ["#faint-fill", "fill"],
    ]);
    expect(report.controlBoundary[0]).toMatchObject({ kind: "field", ratio: 1.25, outside: "#ffffff" });
    expect(report.borderlessText).toEqual([{ selector: "#same-fill", label: "#same-fill" }]);
    expect(report.borderlessIcon.map((item) => item.selector)).toEqual(["#close-icon", "#icon-and-text"]);
    expect(report.summary.borderlessText).toBe(1);
    expect(failed(report)).toBe(true);
  });

  test("reports undersized targets unless spacing or running text exempts them", () => {
    const report = analyzeScreen(
      snapshot({
        controls: [
          control("#crowded-a", { rect: { x: 0, y: 0, width: 16, height: 16 } }),
          control("#crowded-b", { rect: { x: 18, y: 0, width: 16, height: 16 } }),
          control("#beside-button", { rect: { x: 0, y: 100, width: 16, height: 16 } }),
          control("#button", { rect: { x: 18, y: 100, width: 80, height: 32 } }),
          control("#spaced", { rect: { x: 300, y: 300, width: 16, height: 16 } }),
          control("#inline", { kind: "link", inlineText: true, rect: { x: 18, y: 2, width: 20, height: 16 } }),
        ],
      }),
    );
    expect(report.touchTargets.map((issue) => issue.selector)).toEqual(["#crowded-a", "#crowded-b", "#beside-button"]);
    expect(report.touchTargets[0]).toMatchObject({ width: 16, height: 16 });
  });

  test("compares heights and centres on a row, and left edges and widths in a stack of one kind", () => {
    const report = analyzeScreen(
      snapshot({
        controls: [
          control("#save", { group: 1, rect: { x: 0, y: 0, width: 60, height: 40 } }),
          control("#cancel", { group: 1, rect: { x: 70, y: 0, width: 60, height: 28 } }),
          control("#first", { group: 2, rect: { x: 0, y: 100, width: 200, height: 32 } }),
          control("#second", { group: 2, rect: { x: 4, y: 140, width: 120, height: 32 } }),
          control("#field", { group: 2, kind: "field", rect: { x: 0, y: 180, width: 300, height: 32 } }),
          control("#aligned-a", { group: 3, rect: { x: 0, y: 300, width: 60, height: 32 } }),
          control("#aligned-b", { group: 3, rect: { x: 70, y: 300.5, width: 60, height: 32 } }),
          control("#elsewhere", { group: 4, rect: { x: 0, y: 400, width: 60, height: 20 } }),
        ],
      }),
    );
    expect(report.alignment.map((issue) => [issue.group, issue.problem, issue.spread])).toEqual([
      [1, "row-height", 12],
      [1, "row-center", 6],
      [2, "stack-left", 4],
      [2, "stack-width", 80],
    ]);
    expect(report.alignment[2].controls.map((item) => item.selector)).toEqual(["#first", "#second"]);
    expect(
      analyzeScreen(
        snapshot({
          controls: report.alignment[0].controls.map((item) => control(item.selector, { group: 1, rect: item.rect })),
        }),
        20,
      ).alignment,
    ).toEqual([]);
  });

  test("counts page overflow even when no single element is found", () => {
    const clean = analyzeScreen(snapshot());
    expect(clean.summary).toEqual({
      textContrast: 0,
      controlBoundary: 0,
      borderlessText: 0,
      overflow: 0,
      touchTargets: 0,
      alignment: 0,
    });
    expect(failed(clean)).toBe(false);
    expect(analyzeScreen(snapshot({ page: { scrollWidth: 420, clientWidth: 390 } })).summary.overflow).toBe(1);
    const element = { selector: "#wide", text: "", rect: { x: 0, y: 0, width: 900, height: 10 } };
    const report = analyzeScreen(
      snapshot({ page: { scrollWidth: 900, clientWidth: 390 }, overflowing: [element, element] }),
    );
    expect(report.overflow).toEqual({ scrollWidth: 900, clientWidth: 390, elements: [element, element] });
    expect(report.summary.overflow).toBe(2);
  });
});

describe("measureDensity", () => {
  test("merges extents into columns and reports margins and gutters, listing wide ones without failing", () => {
    const first = { selector: "main > h1", label: "Choose a direction", top: 190 };
    // A 600 px column of overlapping and touching blocks, a 40 px badge, and extents spilling past the root.
    const snap = snapshot({
      viewport: { width: 1440, height: 900 },
      content: content(
        [
          [260, 500],
          [480, 700],
          [700.5, 860],
          [1100, 1140],
          [150, 180],
          [1250, 1300],
        ],
        first,
      ),
    });
    const density = measureDensity(snap);
    expect(density).toEqual({
      root: { selector: "main", left: 200, width: 1000 },
      firstContent: { top: 190, selector: "main > h1", label: "Choose a direction" },
      column: { left: 260, right: 1140, width: 880, share: 0.61 },
      columns: [
        { left: 260, right: 860, width: 600, share: 0.42 },
        { left: 1100, right: 1140, width: 40, share: 0.03 },
      ],
      gaps: [
        { kind: "margin-left", left: 200, right: 260, width: 60 },
        { kind: "gutter", left: 860, right: 1100, width: 240 },
        { kind: "margin-right", left: 1140, right: 1200, width: 60 },
      ],
    });
    const report = analyzeScreen(snap);
    expect(report.density).toEqual(density);
    expect(report.wideGaps.map((gap) => gap.kind)).toEqual(["margin-left", "gutter", "margin-right"]);
    expect(analyzeScreen(snap, 1, 100).wideGaps.map((gap) => gap.width)).toEqual([240]);
    expect(failed(report)).toBe(false);
    expect(DEFAULT_GAP_LIMIT).toBe(32);
  });

  test("reports nothing to measure for an empty root and leaves out sub-pixel gaps", () => {
    expect(measureDensity(snapshot())).toEqual({
      root: { selector: "body", left: 0, width: 390 },
      firstContent: null,
      column: null,
      columns: [],
      gaps: [],
    });
    const flush = measureDensity(
      snapshot({
        content: content([
          [200, 700],
          [700.5, 1200],
        ]),
      }),
    );
    expect(flush.gaps).toEqual([]);
    expect(flush.column).toMatchObject({ left: 200, right: 1200, width: 1000 });
  });
});

interface ISettlePage {
  scheme: "light" | "dark";
  theme: string;
  color: string;
  animating: boolean;
  now: number;
}

/** Evaluates a settle expression against a stubbed page, as `wait --fn` evaluates it on each poll. */
function factory_settleProbe(page: ISettlePage): (expression: string) => boolean {
  const window = {};
  const style = () => ({ color: page.color, backgroundColor: page.color });
  const document = {
    documentElement: { className: "", getAttribute: () => page.theme },
    body: {},
    getAnimations: () =>
      page.animating ? [{ playState: "running", effect: { getComputedTiming: () => ({ iterations: 1 }) } }] : [],
  };
  const matchMedia = (query: string) => ({ matches: query === `(prefers-color-scheme: ${page.scheme})` });
  const performance = { now: () => page.now };
  return (expression) =>
    new Function("window", "document", "getComputedStyle", "matchMedia", "performance", `return ${expression};`)(
      window,
      document,
      style,
      matchMedia,
      performance,
    );
}

describe("settledExpression", () => {
  test("holds only after the page has shown the requested scheme, still, for the settle time", () => {
    const page: ISettlePage = { scheme: "light", theme: "light", color: "#111", animating: false, now: 0 };
    const check = factory_settleProbe(page);
    // Just after a switch to dark the browser still reports light, with nothing animating: not settled.
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = 500;
    expect(check(settledExpression("dark", 1))).toBe(false);
    // The scheme applies; the app's theme follows a render later and its colors transition.
    page.scheme = "dark";
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = 520;
    page.theme = "dark";
    page.animating = true;
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = 2000;
    page.animating = false;
    page.color = "#eee";
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = 2000 + SETTLE_MS - 1;
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = 2000 + SETTLE_MS;
    expect(check(settledExpression("dark", 1))).toBe(true);
  });

  test("times each wait from its own first check", () => {
    const page: ISettlePage = { scheme: "dark", theme: "dark", color: "#eee", animating: false, now: 0 };
    const check = factory_settleProbe(page);
    expect(check(settledExpression("dark", 1))).toBe(false);
    page.now = SETTLE_MS;
    expect(check(settledExpression("dark", 1))).toBe(true);
    // A later wait on an unchanged page still waits out its own settle time.
    page.now = 10000;
    expect(check(settledExpression("dark", 2))).toBe(false);
    page.now = 10000 + SETTLE_MS;
    expect(check(settledExpression("dark", 2))).toBe(true);
  });
});

describe("auditScreen browser steps", () => {
  const envelope = JSON.stringify({ success: true, data: { result: snapshot() } });
  const page = { scrollHeight: 2000, viewportHeight: 844, topCover: 0, bottomCover: 64, scrollTop: 120 };
  const metrics = JSON.stringify({ success: true, data: { result: page } });

  function recorder(output = envelope, scroll = metrics): { calls: string[][]; scripts: string[]; run: BrowserRunner } {
    const calls: string[][] = [];
    const scripts: string[] = [];
    return {
      calls,
      scripts,
      run: async (args, stdin) => {
        calls.push(args);
        if (stdin !== undefined) scripts.push(stdin);
        if (!args.includes("eval")) return "";
        return stdin?.includes("bottomCover") ? scroll : output;
      },
    };
  }

  test("opens a URL once in its own session, audits each cell and closes only that session", async () => {
    const browser = recorder();
    const reports = await auditScreen({
      url: "http://127.0.0.1:1/",
      viewports: [{ width: 320, height: 640 }],
      ignore: [".dev-toolbar"],
      run: browser.run,
    });
    expect(reports).toHaveLength(2);
    const session = browser.calls[0][1];
    expect(session).toMatch(/^audit-screen-\d+-\d+$/);
    expect(browser.calls.map((args) => args.slice(2))).toEqual([
      ["set", "viewport", "320", "640"],
      ["set", "media", "light"],
      ["open", "http://127.0.0.1:1/"],
      ["wait", "--load", "networkidle"],
      ["wait", "--fn", settledExpression("light", 1)],
      ["--json", "eval", "--stdin"],
      ["set", "viewport", "320", "640"],
      ["set", "media", "dark"],
      ["wait", "--fn", settledExpression("dark", 2)],
      ["--json", "eval", "--stdin"],
      ["close"],
    ]);
    expect(browser.calls.every((args) => args[1] === session)).toBe(true);
    expect(browser.scripts[0]).toContain("((options) => {");
    expect(browser.scripts[0]).toEndWith('})({"ignore":[".dev-toolbar"]});\n');
    expect(browser.scripts[0]).not.toContain("{ ignore: [] }");
  });

  test("defaults to the whole QA matrix", async () => {
    const browser = recorder();
    const reports = await auditScreen({ session: "s", run: browser.run });
    expect(reports).toHaveLength(QA_VIEWPORTS.length * QA_THEMES.length);
    const cells = browser.calls.filter((args) => args[2] === "set").map((args) => args.slice(4).join(" "));
    expect(cells).toEqual([
      "320 640",
      "light",
      "320 640",
      "dark",
      "390 844",
      "light",
      "390 844",
      "dark",
      "1440 900",
      "light",
      "1440 900",
      "dark",
    ]);
    expect(browser.calls.filter((args) => args[2] === "wait")).toHaveLength(6);
  });

  test("saves numbered viewport frames at each scroll stop, with overlays hidden, and restores the scroll", async () => {
    const dir = join(factory_testDirectory("audit-shots"), "unit");
    const browser = recorder();
    const ignore = ["#dev-toolbar", ".badge"];
    const [report] = await auditScreen({
      session: "impl-1-after",
      viewports: [{ width: 390, height: 844 }],
      colorSchemes: ["dark"],
      ignore,
      shots: { dir, state: "comments-panel", phase: "after" },
      run: browser.run,
    });
    expect(report.frames).toEqual({ scroller: "document", stops: 3, fullPage: false });
    expect(existsSync(dir)).toBe(true);
    const frame = (stop: string) => join(dir, `comments-panel-after-390-dark-${stop}.png`);
    // 2000 px tall, 844 visible with a 64 px bottom bar: steps of 780 to the bottom at 1156.
    expect(browser.calls.slice(4).map((args) => args.slice(2))).toEqual([
      ["eval", "--stdin"],
      ["--json", "eval", "--stdin"],
      ["eval", "--stdin"],
      ["wait", "--fn", settledExpression("dark", 2)],
      ["screenshot", frame("01of03")],
      ["eval", "--stdin"],
      ["wait", "--fn", settledExpression("dark", 3)],
      ["screenshot", frame("02of03")],
      ["eval", "--stdin"],
      ["wait", "--fn", settledExpression("dark", 4)],
      ["screenshot", frame("03of03")],
      ["eval", "--stdin"],
    ]);
    expect(browser.scripts.slice(1)).toEqual([
      hideScript(ignore),
      scrollMetricsScript(ignore),
      scrollToScript(0),
      scrollToScript(780),
      scrollToScript(1156),
      `${scrollToScript(120)}${UNMARK_SCROLLER_SCRIPT}`,
    ]);
    expect(hideScript(["#a"])).toContain('document.querySelectorAll("#a")');
    expect(scrollMetricsScript([], "#doc")).toContain('document.querySelector("#doc")');
    expect(scrollMetricsScript(ignore)).toContain('element.closest("#dev-toolbar, .badge")');

    const full = recorder(
      envelope,
      JSON.stringify({ success: true, data: { result: { ...page, scrollHeight: 500 } } }),
    );
    await auditScreen({
      session: "s",
      viewports: [{ width: 390, height: 844 }],
      colorSchemes: ["light"],
      shots: { dir, state: "home", phase: "before", fullPage: true },
      run: full.run,
    });
    expect(full.calls.filter((args) => args.includes("screenshot")).map((args) => args.slice(3))).toEqual([
      [join(dir, "home-before-390-light-01of01.png")],
      ["--full", join(dir, "home-before-390-light-full-static.png")],
    ]);

    // Content that scrolls inside a container never reaches a full-page image, so none is taken.
    const shell = recorder(
      envelope,
      JSON.stringify({ success: true, data: { result: { ...page, scrollHeight: 500, scroller: "main.shell" } } }),
    );
    const [shellReport] = await auditScreen({
      session: "s",
      viewports: [{ width: 390, height: 844 }],
      colorSchemes: ["light"],
      shots: { dir, state: "shell", phase: "before", fullPage: true },
      run: shell.run,
    });
    expect(shellReport.frames).toEqual({ scroller: "main.shell", stops: 1, fullPage: false });
    expect(shell.calls.filter((args) => args.includes("screenshot")).map((args) => args.slice(3))).toEqual([
      [join(dir, "shell-before-390-light-01of01.png")],
    ]);
    expect(full.scripts.slice(1)).toEqual([
      scrollMetricsScript([]),
      scrollToScript(0),
      `${scrollToScript(0)}${pinScript([])}`,
      UNPIN_SCRIPT,
      `${scrollToScript(120)}${UNMARK_SCROLLER_SCRIPT}`,
    ]);
  });

  test("unpins the page when the full-page screenshot fails, and rejects a failed scroll measurement", async () => {
    const dir = factory_testDirectory("audit-shots-fail");
    const shots = { dir, state: "home", phase: "after" as const, fullPage: true };
    const viewports = [{ width: 390, height: 844 }];
    const scripts: string[] = [];
    const failing: BrowserRunner = async (args, stdin) => {
      if (stdin !== undefined) scripts.push(stdin);
      if (args.includes("--full")) throw new Error("screenshot failed");
      if (!args.includes("eval")) return "";
      return stdin?.includes("bottomCover") ? metrics : envelope;
    };
    await expect(
      auditScreen({ session: "s", viewports, colorSchemes: ["light"], shots, run: failing }),
    ).rejects.toThrow("screenshot failed");
    expect(scripts.at(-1)).toBe(UNPIN_SCRIPT);
    const unmeasured = recorder(envelope, JSON.stringify({ success: true, data: { result: { scrollHeight: "x" } } }));
    await expect(
      auditScreen({ session: "s", viewports, colorSchemes: ["light"], shots, run: unmeasured.run }),
    ).rejects.toThrow("page scroll measurement failed");
  });

  test("refuses a collector whose options call was edited away", () => {
    expect(() => collectorScript([], "(() => 1)();")).toThrow("does not end with");
  });

  test("passes the content selector to the collector and the gap limit to the analysis", async () => {
    const wide = snapshot({ content: content([[260, 500]]) });
    const browser = recorder(JSON.stringify({ success: true, data: { result: wide } }));
    const [report] = await auditScreen({
      session: "s",
      viewports: [{ width: 390, height: 800 }],
      colorSchemes: ["light"],
      content: "main.app",
      gapLimit: 100,
      run: browser.run,
    });
    expect(browser.scripts[0]).toEndWith('})({"ignore":[],"content":"main.app"});\n');
    expect(report.wideGaps).toEqual([{ kind: "margin-right", left: 500, right: 1200, width: 700 }]);
  });

  test("audits an existing session in place and leaves it open", async () => {
    const browser = recorder();
    await auditScreen({
      session: "review-1",
      viewports: [{ width: 1440, height: 900 }],
      colorSchemes: ["light"],
      run: browser.run,
    });
    expect(browser.calls).toEqual([
      ["--session", "review-1", "set", "viewport", "1440", "900"],
      ["--session", "review-1", "set", "media", "light"],
      ["--session", "review-1", "wait", "--fn", settledExpression("light", 1)],
      ["--session", "review-1", "--json", "eval", "--stdin"],
    ]);
  });

  test("rejects ambiguous input and failed evaluations, still closing its own session", async () => {
    const viewports = [{ width: 390, height: 800 }];
    await expect(auditScreen({ viewports })).rejects.toThrow("exactly one");
    await expect(auditScreen({ url: "http://x/", session: "s", viewports })).rejects.toThrow("exactly one");
    const failing = recorder(JSON.stringify({ success: false, error: "boom" }));
    await expect(auditScreen({ url: "http://x/", viewports, run: failing.run })).rejects.toThrow(
      "page evaluation failed",
    );
    expect(failing.calls.at(-1)?.slice(2)).toEqual(["close"]);
    const malformed = recorder(JSON.stringify({ success: true, data: { result: { texts: [] } } }));
    await expect(auditScreen({ session: "s", viewports, run: malformed.run })).rejects.toThrow(
      "page evaluation failed",
    );
  });
});

async function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(["bun", join(SCRIPTS, "audit-screen.ts"), ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, stdout, stderr };
}

test("the CLI rejects bad usage", async () => {
  expect((await cli("--viewport", "390x800")).code).toBe(2);
  expect((await cli("--url", "http://x/", "--viewport", "390")).code).toBe(2);
  expect((await cli("--url", "http://x/", "--session", "s", "--viewport", "390x800")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--color-scheme", "sepia")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--tolerance=-1")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--unknown")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--gap-limit=-1")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--gap-limit", "wide")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--content=")).code).toBe(2);
  expect((await cli("--session", "s", "--shots", "/tmp/x")).code).toBe(2);
  expect((await cli("--session", "s", "--shots", "/tmp/x", "--state", "Bad State")).code).toBe(2);
  expect((await cli("--session", "s", "--state", "home")).code).toBe(2);
  expect((await cli("--session", "s", "--shots", "/tmp/x", "--state", "home", "--phase", "during")).code).toBe(2);
  const help = await cli("--help");
  expect(help.code).toBe(0);
  expect(help.stdout).toContain("usage:");
});

// Drives a real browser: the collector's compositing and layout reads have no meaning outside one.
describe.skipIf(!Bun.which("agent-browser"))("in a real browser", () => {
  let server: ReturnType<typeof Bun.serve>;

  beforeAll(() => {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => {
        const path = new URL(request.url).pathname;
        const page =
          path === "/pinned"
            ? PINNED_BARS_PAGE
            : path === "/shell"
              ? APP_SHELL_PAGE
              : path === "/side-panel"
                ? SIDE_PANEL_PAGE
                : path === "/density"
                  ? WIDE_GUTTER_PAGE
                  : path === "/scripted-theme"
                    ? SCRIPTED_THEME_PAGE
                    : path === "/scroll-animation"
                      ? SCROLL_ANIMATION_PAGE
                      : AUDIT_FIXTURE_PAGE;
        return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    });
  });

  afterAll(() => {
    server.stop(true);
  });

  // The page's colors transition for 1.5 s and the dark cell is measured right after switching from light, so a
  // measurement taken before the transitions end reports the wrong defects in dark.
  test("the CLI waits out theme transitions, finds each planted defect in both themes, saves the frames and exits 1", async () => {
    const shots = factory_testDirectory("audit-real");
    const run = await cli(
      "--url",
      server.url.href,
      "--viewport",
      "390x800",
      "--ignore",
      ".dev-overlay",
      "--shots",
      shots,
      "--state",
      "fixture",
    );
    expect(run.code).toBe(1);
    const output = JSON.parse(run.stdout);
    expect(output.failing).toBe(2);
    expect(readdirSync(shots).sort()).toEqual([
      "fixture-after-390-dark-01of01.png",
      "fixture-after-390-light-01of01.png",
    ]);
    for (const [index, scheme] of ["light", "dark"].entries()) {
      const report = output.screens[index];
      expect(report.colorScheme).toBe(scheme);
      expect(report.textContrast.map((issue: { selector: string }) => issue.selector)).toEqual(
        scheme === "light" ? ["#faint"] : [],
      );
      expect(report.controlBoundary.map((issue: { selector: string }) => issue.selector)).toEqual(
        scheme === "dark" ? ["#name"] : [],
      );
      expect(report.overflow.elements.map((element: { selector: string }) => element.selector)).toEqual(["#wide"]);
      expect(report.touchTargets.map((issue: { selector: string }) => issue.selector)).toEqual(["#tiny-a", "#tiny-b"]);
      expect(report.alignment.map((issue: { problem: string }) => issue.problem)).toEqual([
        "row-height",
        "stack-width",
      ]);
      expect(report.borderlessText.map((issue: { selector: string }) => issue.selector)).toEqual(["#ghost"]);
      expect(report.borderlessIcon.map((issue: { selector: string }) => issue.selector)).toEqual(["#close", "#masked"]);
    }
  }, 120000);

  // The page's theme flips from script 100 ms after each scheme switch, so right after a switch nothing animates yet
  // and the old theme still shows. Measured then, a dark cell reports the light theme's faint text and a light cell
  // misses it; across two viewports the cells run light, dark, light, dark.
  test("the CLI measures every cell in its own theme when the page follows the scheme from script", async () => {
    const run = await cli(
      "--url",
      new URL("/scripted-theme", server.url).href,
      "--viewport",
      "390x800",
      "--viewport",
      "400x800",
    );
    const output = JSON.parse(run.stdout);
    expect(output.screens.map((report: { colorScheme: string }) => report.colorScheme)).toEqual([
      "light",
      "dark",
      "light",
      "dark",
    ]);
    for (const report of output.screens) {
      expect(report.textContrast.map((issue: { selector: string }) => issue.selector)).toEqual(
        report.colorScheme === "light" ? ["#faint"] : [],
      );
    }
  }, 120000);

  // A scroll-driven animation runs as long as the page is open, so a wait for every running animation to end never holds.
  test("the CLI settles on a page with a scroll-driven animation", async () => {
    const url = new URL("/scroll-animation", server.url).href;
    const run = await cli("--url", url, "--viewport", "390x844", "--color-scheme", "light");
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout).screens).toHaveLength(1);
  }, 120000);

  // Viewport 390x844 over a page 48 + 2100 + 40 + 64 = 2252 px tall: the visible band between the 48 px header and
  // the 64 px footer is 732 px, so the stops are 0, 732 and the bottom at 1408.
  test("the CLI shows a sticky footer at the bottom of each viewport frame, reaches the page end only in the bottom frame, and lays it out at the end of the full-page image", async () => {
    const shots = factory_testDirectory("audit-pinned");
    const run = await cli(
      "--url",
      new URL("/pinned", server.url).href,
      "--viewport",
      "390x844",
      "--color-scheme",
      "light",
      "--shots",
      shots,
      "--state",
      "pinned",
      "--full-page",
    );
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const frames = ["01of03", "02of03", "03of03"].map((stop) => `pinned-after-390-light-${stop}.png`);
    expect(readdirSync(shots).sort()).toEqual([...frames, "pinned-after-390-light-full-static.png"]);
    const BLUE: [number, number, number] = [0, 0, 255];
    const CYAN: [number, number, number] = [0, 255, 255];
    const MAGENTA: [number, number, number] = [255, 0, 255];
    const near = (actual: number | undefined, expected: number) => expect(actual).toBeCloseTo(expected, 2);
    const { header, content, end, footer } = PINNED_PAGE;

    for (const [index, name] of frames.entries()) {
      const png = readPng(join(shots, name));
      const bar = rowsOfColor(png, MAGENTA);
      near(bar?.first, (844 - footer) / 844);
      near(bar?.last, 1);
      near(rowsOfColor(png, BLUE)?.first, 0);
      near(rowsOfColor(png, BLUE)?.last, header / 844);
      const pageEnd = rowsOfColor(png, CYAN);
      if (index < 2) expect(pageEnd).toBeNull();
      else {
        near(pageEnd?.first, (844 - footer - end) / 844);
        near(pageEnd?.last, (844 - footer) / 844);
      }
    }

    // Laid out in place, the footer follows the page end instead of covering the content halfway down, and the
    // header adds its height to the flow.
    const full = readPng(join(shots, "pinned-after-390-light-full-static.png"));
    const height = 2 * header + content + end + footer;
    near(rowsOfColor(full, MAGENTA)?.first, (height - footer) / height);
    near(rowsOfColor(full, MAGENTA)?.last, 1);
    near(rowsOfColor(full, CYAN)?.first, (height - footer - end) / height);
    near(rowsOfColor(full, BLUE)?.last, (2 * header) / height);
  }, 120000);

  // Viewport 390x844 with a 48 px fixed header above a main that scrolls inside the remaining 796 px: the band between
  // the header and main's 64 px sticky footer is 732 px, so main's stops are 0, 732 and its bottom at 1408 (2204 - 796).
  test("the CLI captures frames at the stops of a container that scrolls the content when the document does not scroll", async () => {
    const shots = factory_testDirectory("audit-shell");
    const run = await cli(
      "--url",
      new URL("/shell", server.url).href,
      "--viewport",
      "390x844",
      "--color-scheme",
      "light",
      "--shots",
      shots,
      "--state",
      "shell",
      "--full-page",
    );
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const frames = ["01of03", "02of03", "03of03"].map((stop) => `shell-after-390-light-${stop}.png`);
    expect(readdirSync(shots).sort()).toEqual(frames);
    expect(JSON.parse(run.stdout).screens[0].frames).toEqual({ scroller: "main.shell", stops: 3, fullPage: false });
    const CYAN: [number, number, number] = [0, 255, 255];
    const MAGENTA: [number, number, number] = [255, 0, 255];
    const near = (actual: number | undefined, expected: number) => expect(actual).toBeCloseTo(expected, 2);
    const { end, footer } = PINNED_PAGE;
    for (const [index, name] of frames.entries()) {
      const png = readPng(join(shots, name));
      near(rowsOfColor(png, MAGENTA)?.first, (844 - footer) / 844);
      const pageEnd = rowsOfColor(png, CYAN);
      if (index < 2) expect(pageEnd).toBeNull();
      else near(pageEnd?.first, (844 - footer - end) / 844);
    }
  }, 120000);

  // With no main, the wide column's 2100 px scroll in 844 visible px: stops 0, 844 and its bottom at 1256. The narrow
  // side panel scrolls further but is not the content.
  test("the CLI scrolls the widest container when nothing marks the content and the document does not scroll", async () => {
    const shots = factory_testDirectory("audit-side-panel");
    const url = new URL("/side-panel", server.url).href;
    const args = ["--url", url, "--viewport", "390x844", "--color-scheme", "light"];
    const run = await cli(...args, "--shots", shots, "--state", "side");
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout).screens[0].frames).toEqual({ scroller: "section.column", stops: 3, fullPage: false });
  }, 120000);

  // main spans 240-1440 with 24 px padding: the column takes 264-864 and the badge 1376-1416, leaving a 512 px gutter.
  test("the CLI reports the density of the content, flagging a wide empty gutter beside a narrow column", async () => {
    const { nav, padding, column, columnTop, badge } = DENSITY_PAGE;
    const url = new URL("/density", server.url).href;
    const args = ["--url", url, "--viewport", "1440x900", "--color-scheme", "light"];
    const run = await cli(...args);
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const report = JSON.parse(run.stdout).screens[0];
    const columnLeft = nav + padding;
    const badgeLeft = 1440 - padding - badge;
    expect(report.density).toEqual({
      root: { selector: "html > body > main", left: nav, width: 1440 - nav },
      firstContent: { top: padding + 1 + columnTop, selector: "#column > h1", label: "Choose a direction" },
      column: { left: columnLeft, right: 1440 - padding, width: 1440 - padding - columnLeft, share: 0.8 },
      columns: [
        { left: columnLeft, right: columnLeft + column, width: column, share: 0.42 },
        { left: badgeLeft, right: badgeLeft + badge, width: badge, share: 0.03 },
      ],
      gaps: [
        { kind: "margin-left", left: nav, right: columnLeft, width: padding },
        { kind: "gutter", left: columnLeft + column, right: badgeLeft, width: badgeLeft - columnLeft - column },
        { kind: "margin-right", left: 1440 - padding, right: 1440, width: padding },
      ],
    });
    expect(report.wideGaps).toEqual([{ kind: "gutter", left: columnLeft + column, right: badgeLeft, width: 512 }]);

    // Measured inside the column instead, the border and padding make its margins.
    const inside = JSON.parse((await cli(...args, "--content", "#column", "--gap-limit", "16")).stdout).screens[0];
    expect(inside.density.root).toEqual({ selector: "#column", left: columnLeft, width: column });
    expect(inside.density.gaps[0]).toEqual({
      kind: "margin-left",
      left: columnLeft,
      right: columnLeft + 17,
      width: 17,
    });
    expect(inside.wideGaps.map((gap: { kind: string }) => gap.kind)).toEqual(["margin-left", "margin-right"]);
  }, 120000);

  test("the CLI reports a browser failure with exit 3", async () => {
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
    const url = closed.url.href;
    closed.stop(true);
    const run = await cli("--url", url, "--viewport", "390x800", "--color-scheme", "light");
    expect(run.code).toBe(3);
    expect(run.stderr).toContain("agent-browser");
  }, 60000);
});
