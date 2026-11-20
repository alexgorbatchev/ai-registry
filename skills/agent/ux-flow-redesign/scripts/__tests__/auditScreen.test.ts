import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  analyzeScreen,
  auditScreen,
  collectorScript,
  contrast,
  hex,
  isLargeText,
  type BrowserRunner,
  type ScreenSnapshot,
} from "../lib/auditScreen";
import { AUDIT_FIXTURE_PAGE } from "./auditScreenPage";
import { SCRIPTS } from "./fixtures";

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
    ...overrides,
  };
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
    expect(report.unboundedActions).toEqual([{ selector: "#same-fill", label: "#same-fill" }]);
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
    expect(clean.summary).toEqual({ textContrast: 0, controlBoundary: 0, overflow: 0, touchTargets: 0, alignment: 0 });
    expect(analyzeScreen(snapshot({ page: { scrollWidth: 420, clientWidth: 390 } })).summary.overflow).toBe(1);
    const element = { selector: "#wide", text: "", rect: { x: 0, y: 0, width: 900, height: 10 } };
    const report = analyzeScreen(
      snapshot({ page: { scrollWidth: 900, clientWidth: 390 }, overflowing: [element, element] }),
    );
    expect(report.overflow).toEqual({ scrollWidth: 900, clientWidth: 390, elements: [element, element] });
    expect(report.summary.overflow).toBe(2);
  });
});

describe("auditScreen browser steps", () => {
  const envelope = JSON.stringify({ success: true, data: { result: snapshot() } });

  function recorder(output = envelope): { calls: string[][]; scripts: string[]; run: BrowserRunner } {
    const calls: string[][] = [];
    const scripts: string[] = [];
    return {
      calls,
      scripts,
      run: async (args, stdin) => {
        calls.push(args);
        if (stdin !== undefined) scripts.push(stdin);
        return args.includes("eval") ? output : "";
      },
    };
  }

  test("opens a URL in its own session, evaluates the collector and closes only that session", async () => {
    const browser = recorder();
    const report = await auditScreen({
      url: "http://127.0.0.1:1/",
      viewport: { width: 320, height: 640 },
      colorScheme: "dark",
      ignore: [".dev-toolbar"],
      run: browser.run,
    });
    expect(report.summary.textContrast).toBe(0);
    const session = browser.calls[0][1];
    expect(session).toMatch(/^audit-screen-\d+-\d+$/);
    expect(browser.calls.map((args) => args.slice(2))).toEqual([
      ["set", "viewport", "320", "640"],
      ["set", "media", "dark"],
      ["open", "http://127.0.0.1:1/"],
      ["wait", "--load", "networkidle"],
      ["--json", "eval", "--stdin"],
      ["close"],
    ]);
    expect(browser.calls.every((args) => args[1] === session)).toBe(true);
    expect(browser.scripts[0]).toContain("((options) => {");
    expect(browser.scripts[0]).toEndWith('})({"ignore":[".dev-toolbar"]});\n');
    expect(browser.scripts[0]).not.toContain("{ ignore: [] }");
  });

  test("refuses a collector whose options call was edited away", () => {
    expect(() => collectorScript([], "(() => 1)();")).toThrow("does not end with");
  });

  test("audits an existing session in place and leaves it open", async () => {
    const browser = recorder();
    await auditScreen({ session: "review-1", viewport: { width: 1440, height: 900 }, run: browser.run });
    expect(browser.calls).toEqual([
      ["--session", "review-1", "set", "viewport", "1440", "900"],
      ["--session", "review-1", "--json", "eval", "--stdin"],
    ]);
  });

  test("rejects ambiguous input and failed evaluations, still closing its own session", async () => {
    const viewport = { width: 390, height: 800 };
    await expect(auditScreen({ viewport })).rejects.toThrow("exactly one");
    await expect(auditScreen({ url: "http://x/", session: "s", viewport })).rejects.toThrow("exactly one");
    const failing = recorder(JSON.stringify({ success: false, error: "boom" }));
    await expect(auditScreen({ url: "http://x/", viewport, run: failing.run })).rejects.toThrow(
      "page evaluation failed",
    );
    expect(failing.calls.at(-1)?.slice(2)).toEqual(["close"]);
    const malformed = recorder(JSON.stringify({ success: true, data: { result: { texts: [] } } }));
    await expect(auditScreen({ session: "s", viewport, run: malformed.run })).rejects.toThrow("page evaluation failed");
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
  expect((await cli("--url", "http://x/")).code).toBe(2);
  expect((await cli("--url", "http://x/", "--session", "s", "--viewport", "390x800")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--color-scheme", "sepia")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--tolerance=-1")).code).toBe(2);
  expect((await cli("--session", "s", "--viewport", "390x800", "--unknown")).code).toBe(2);
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
      fetch: () => new Response(AUDIT_FIXTURE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    });
  });

  afterAll(() => {
    server.stop(true);
  });

  test("the CLI finds each planted defect in both themes and exits 1", async () => {
    for (const scheme of ["light", "dark"]) {
      const run = await cli(
        "--url",
        server.url.href,
        "--viewport",
        "390x800",
        "--color-scheme",
        scheme,
        "--ignore",
        ".dev-overlay",
      );
      expect(run.code).toBe(1);
      const report = JSON.parse(run.stdout);
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
      expect(report.unboundedActions.map((issue: { selector: string }) => issue.selector)).toEqual(["#ghost"]);
    }
  }, 120000);

  test("the CLI reports a browser failure with exit 3", async () => {
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
    const url = closed.url.href;
    closed.stop(true);
    const run = await cli("--url", url, "--viewport", "390x800");
    expect(run.code).toBe(3);
    expect(run.stderr).toContain("agent-browser");
  }, 60000);
});
