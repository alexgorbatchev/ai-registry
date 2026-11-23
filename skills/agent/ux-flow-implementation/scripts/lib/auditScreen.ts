import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  frameName,
  QA_THEMES,
  QA_VIEWPORTS,
  scrollStops,
  type Phase,
  type ScrollMetrics,
  type Stop,
  type Theme,
} from "./matrix";

export type Rgb = [number, number, number];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ControlKind = "action" | "field" | "toggle" | "link" | "other";

/** What lib/collectScreen.js returns from the page. Colors are opaque sRGB, already composited. */
export interface ScreenSnapshot {
  url: string;
  viewport: { width: number; height: number };
  colorScheme: "light" | "dark";
  page: { scrollWidth: number; clientWidth: number };
  texts: {
    selector: string;
    text: string;
    fontSize: number;
    fontWeight: number;
    foreground: Rgb;
    /** Null when an image, filter or blend mode lies behind the text. */
    background: Rgb | null;
  }[];
  controls: {
    selector: string;
    label: string;
    kind: ControlKind;
    rect: Box;
    /** Controls sharing a number sit in the same container; null for ungrouped kinds or lone controls. */
    group: number | null;
    disabled: boolean;
    /** A link inside running text, which the target-size rule exempts. */
    inlineText: boolean;
    /** A native checkbox, radio or range whose drawn boundary styles do not describe. */
    nativeAppearance: boolean;
    /** The control shows text (its rendered text or a button value). */
    hasText: boolean;
    /** The control draws an icon: svg, img, or a pseudo-element image. */
    hasIcon: boolean;
    /** The color around the control; null when unresolved. */
    outside: Rgb | null;
    fill: Rgb | null;
    borders: Rgb[];
  }[];
  overflowing: { selector: string; text: string; rect: Box }[];
  /** The content area density is measured in, outside persistent chrome. */
  content: {
    /** The `content` option's element, else the visible `main`, else the body without its landmarks. */
    root: { selector: string; rect: Box };
    /** The first control or heading in the root, with its top measured from the top of the page. */
    first: { selector: string; label: string; top: number } | null;
    /** Horizontal [left, right] extents of the text, media, controls and painted boxes in the root. */
    extents: [number, number][];
  };
}

/** An empty vertical band in the content root: a margin at its edge or a gutter between occupied columns. */
export interface Gap {
  kind: "margin-left" | "gutter" | "margin-right";
  left: number;
  right: number;
  width: number;
}

export interface Band {
  left: number;
  right: number;
  width: number;
  /** Width as a share of the viewport, 0 to 1. */
  share: number;
}

export interface Density {
  /** The content root measured: its selector, left edge and width. */
  root: { selector: string; left: number; width: number };
  /** Height from the top of the page to the first control or heading of the content; null when it has none. */
  firstContent: { top: number; selector: string; label: string } | null;
  /** The occupied extent of the content, and its width as a share of the viewport (0 to 1). */
  column: Band | null;
  /** The occupied columns between the gaps, left to right, each with its share of the viewport. */
  columns: Band[];
  /** Every margin and gutter, left to right. */
  gaps: Gap[];
}

interface ControlRef {
  selector: string;
  label: string;
}

export interface AlignmentIssue {
  group: number;
  /** row-height and row-center compare controls on one row; stack-left and stack-width compare a column. */
  problem: "row-height" | "row-center" | "stack-left" | "stack-width";
  spread: number;
  controls: (ControlRef & { rect: Box })[];
}

export interface AuditReport {
  url: string;
  viewport: { width: number; height: number };
  colorScheme: "light" | "dark";
  /** Counts of the failing categories; the CLI exits 1 when any is non-zero. */
  summary: {
    textContrast: number;
    controlBoundary: number;
    borderlessText: number;
    overflow: number;
    touchTargets: number;
    alignment: number;
  };
  textContrast: (ControlRef & { ratio: number; required: number; foreground: string; background: string })[];
  controlBoundary: (ControlRef & { kind: ControlKind; ratio: number; boundary: "border" | "fill"; outside: string })[];
  overflow: { scrollWidth: number; clientWidth: number; elements: ScreenSnapshot["overflowing"] };
  touchTargets: (ControlRef & { width: number; height: number })[];
  alignment: AlignmentIssue[];
  /** Whitespace measurements for the density checklist item. Not a failure. */
  density: Density;
  /** Margins and gutters wider than the gap limit: check each is not wider than its content needs. Not a failure. */
  wideGaps: Gap[];
  /** Buttons with text, no icon, and no border or fill distinct from their surroundings: they read as plain text. */
  borderlessText: ControlRef[];
  /** Borderless buttons that draw an icon: check the icon is a conventional one. Not a failure. */
  borderlessIcon: ControlRef[];
  /** Text whose background could not be resolved (image, gradient, filter); check it by eye. Not a failure. */
  unresolved: ControlRef[];
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Margins and gutters wider than this many CSS px are listed for the density check. */
export const DEFAULT_GAP_LIMIT = 32;

export function hex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG 2 relative luminance of an sRGB color. */
export function luminance(color: Rgb): number {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Large text: at least 24 CSS px, or 18.66 px (14 pt) bold. */
export function isLargeText(fontSize: number, fontWeight: number): boolean {
  return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
}

const ref = (item: { selector: string; label?: string; text?: string }): ControlRef => ({
  selector: item.selector,
  label: item.label ?? item.text ?? "",
});

function textContrastIssues(snapshot: ScreenSnapshot): Pick<AuditReport, "textContrast" | "unresolved"> {
  const textContrast: AuditReport["textContrast"] = [];
  const unresolved: ControlRef[] = [];
  for (const text of snapshot.texts) {
    if (!text.background) {
      unresolved.push(ref(text));
      continue;
    }
    const required = isLargeText(text.fontSize, text.fontWeight) ? 3 : 4.5;
    const ratio = contrast(text.foreground, text.background);
    if (ratio < required) {
      textContrast.push({
        ...ref(text),
        ratio: round(ratio),
        required,
        foreground: hex(text.foreground),
        background: hex(text.background),
      });
    }
  }
  return { textContrast, unresolved };
}

function boundaryIssues(
  snapshot: ScreenSnapshot,
): Pick<AuditReport, "controlBoundary" | "borderlessText" | "borderlessIcon"> {
  const controlBoundary: AuditReport["controlBoundary"] = [];
  const borderlessText: ControlRef[] = [];
  const borderlessIcon: ControlRef[] = [];
  for (const control of snapshot.controls) {
    if (!["action", "field", "toggle"].includes(control.kind) || control.disabled || control.nativeAppearance) continue;
    if (!control.outside) continue;
    const outside = control.outside;
    // A fill or border painted in the surrounding color draws no boundary at all.
    const candidates: { boundary: "border" | "fill"; ratio: number }[] = [
      ...control.borders.map((border) => ({ boundary: "border" as const, ratio: contrast(border, outside) })),
      ...(control.fill ? [{ boundary: "fill" as const, ratio: contrast(control.fill, outside) }] : []),
    ].filter((candidate) => candidate.ratio > 1.02);
    if (candidates.length === 0) {
      if (control.kind === "action") (control.hasIcon ? borderlessIcon : borderlessText).push(ref(control));
      continue;
    }
    const best = candidates.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    if (best.ratio < 3) {
      controlBoundary.push({
        ...ref(control),
        kind: control.kind,
        ratio: round(best.ratio),
        boundary: best.boundary,
        outside: hex(outside),
      });
    }
  }
  return { controlBoundary, borderlessText, borderlessIcon };
}

const center = (rect: Box): [number, number] => [rect.x + rect.width / 2, rect.y + rect.height / 2];

function distanceToBox([x, y]: [number, number], rect: Box): number {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/**
 * Targets under 24x24 CSS px, unless the WCAG 2.2 spacing exception holds: a 24 px circle centred on the target
 * meets no other target and no other undersized target's circle. Links in running text are exempt.
 */
function touchTargetIssues(snapshot: ScreenSnapshot): AuditReport["touchTargets"] {
  const targets = snapshot.controls.filter((control) => !control.disabled && !control.inlineText);
  const small = (rect: Box) => rect.width < 24 || rect.height < 24;
  return targets
    .filter((target) => small(target.rect))
    .filter((target) => {
      const middle = center(target.rect);
      return targets.some((other) => {
        if (other === target) return false;
        if (small(other.rect)) return Math.hypot(...center(other.rect).map((value, i) => value - middle[i])) < 24;
        return distanceToBox(middle, other.rect) < 12;
      });
    })
    .map((target) => ({ ...ref(target), width: target.rect.width, height: target.rect.height }));
}

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/** Splits items into connected clusters under `linked`. */
function clusters<T>(items: T[], linked: (a: T, b: T) => boolean): T[][] {
  const seen = new Set<T>();
  const result: T[][] = [];
  for (const start of items) {
    if (seen.has(start)) continue;
    const cluster = [start];
    seen.add(start);
    for (let i = 0; i < cluster.length; i++) {
      for (const other of items) {
        if (!seen.has(other) && linked(cluster[i], other)) {
          seen.add(other);
          cluster.push(other);
        }
      }
    }
    result.push(cluster);
  }
  return result;
}

/**
 * Compares sibling controls in one container: controls on one row should share height and vertical centre;
 * controls of one kind stacked in a column should share left edge and width.
 */
function alignmentIssues(snapshot: ScreenSnapshot, tolerance: number): AlignmentIssue[] {
  type Control = ScreenSnapshot["controls"][number];
  const issues: AlignmentIssue[] = [];
  const groups = new Map<number, Control[]>();
  for (const control of snapshot.controls) {
    if (control.group === null) continue;
    groups.set(control.group, [...(groups.get(control.group) ?? []), control]);
  }
  const check = (
    group: number,
    members: Control[],
    problem: AlignmentIssue["problem"],
    measure: (rect: Box) => number,
  ) => {
    const values = members.map((member) => measure(member.rect));
    const spread = round(Math.max(...values) - Math.min(...values));
    if (spread > tolerance) {
      issues.push({
        group,
        problem,
        spread,
        controls: members.map((member) => ({ ...ref(member), rect: member.rect })),
      });
    }
  };
  for (const [group, members] of groups) {
    const rows = clusters(members, (a, b) =>
      overlaps(a.rect.y, a.rect.y + a.rect.height, b.rect.y, b.rect.y + b.rect.height),
    );
    for (const row of rows.filter((cluster) => cluster.length > 1)) {
      check(group, row, "row-height", (rect) => rect.height);
      check(group, row, "row-center", (rect) => rect.y + rect.height / 2);
    }
    for (const kind of ["action", "field"] as const) {
      const ofKind = members.filter((member) => member.kind === kind);
      const stacks = clusters(
        ofKind,
        (a, b) =>
          overlaps(a.rect.x, a.rect.x + a.rect.width, b.rect.x, b.rect.x + b.rect.width) &&
          !overlaps(a.rect.y, a.rect.y + a.rect.height, b.rect.y, b.rect.y + b.rect.height),
      );
      for (const stack of stacks.filter((cluster) => cluster.length > 1)) {
        check(group, stack, "stack-left", (rect) => rect.x);
        check(group, stack, "stack-width", (rect) => rect.width);
      }
    }
  }
  return issues;
}

/**
 * Measures the content's whitespace: where its first control or heading starts, how much of the viewport its occupied
 * extent spans, and the empty vertical bands (margins at the root's edges, gutters between occupied columns) found by
 * merging the horizontal extents of everything it paints.
 */
export function measureDensity(snapshot: ScreenSnapshot): Density {
  const { root, first, extents } = snapshot.content;
  const left = root.rect.x;
  const right = root.rect.x + root.rect.width;
  const merged: [number, number][] = [];
  for (const [start, end] of extents
    .map(([start, end]): [number, number] => [Math.max(start, left), Math.min(end, right)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const gaps: Gap[] = [];
  const gap = (kind: Gap["kind"], from: number, to: number) => {
    if (to - from >= 1) gaps.push({ kind, left: round(from), right: round(to), width: round(to - from) });
  };
  if (merged.length > 0) {
    gap("margin-left", left, merged[0][0]);
    for (let i = 1; i < merged.length; i++) gap("gutter", merged[i - 1][1], merged[i][0]);
    gap("margin-right", merged[merged.length - 1][1], right);
  }
  const band = (from: number, to: number): Band => ({
    left: round(from),
    right: round(to),
    width: round(to - from),
    share: round((to - from) / snapshot.viewport.width),
  });
  return {
    root: { selector: root.selector, left: round(left), width: round(root.rect.width) },
    firstContent: first ? { top: first.top, selector: first.selector, label: first.label } : null,
    column: merged.length > 0 ? band(merged[0][0], merged[merged.length - 1][1]) : null,
    columns: merged.map(([from, to]) => band(from, to)),
    gaps,
  };
}

export function analyzeScreen(snapshot: ScreenSnapshot, tolerance = 1, gapLimit = DEFAULT_GAP_LIMIT): AuditReport {
  const { textContrast, unresolved } = textContrastIssues(snapshot);
  const { controlBoundary, borderlessText, borderlessIcon } = boundaryIssues(snapshot);
  const touchTargets = touchTargetIssues(snapshot);
  const alignment = alignmentIssues(snapshot, tolerance);
  const density = measureDensity(snapshot);
  const pageOverflows = snapshot.page.scrollWidth > snapshot.page.clientWidth + 1;
  const overflow = {
    scrollWidth: snapshot.page.scrollWidth,
    clientWidth: snapshot.page.clientWidth,
    elements: snapshot.overflowing,
  };
  return {
    url: snapshot.url,
    viewport: snapshot.viewport,
    colorScheme: snapshot.colorScheme,
    summary: {
      textContrast: textContrast.length,
      controlBoundary: controlBoundary.length,
      borderlessText: borderlessText.length,
      overflow: pageOverflows || snapshot.overflowing.length > 0 ? Math.max(1, snapshot.overflowing.length) : 0,
      touchTargets: touchTargets.length,
      alignment: alignment.length,
    },
    textContrast,
    controlBoundary,
    overflow,
    touchTargets,
    alignment,
    density,
    wideGaps: density.gaps.filter((item) => item.width > gapLimit),
    borderlessText,
    borderlessIcon,
    unresolved,
  };
}

/** Runs one agent-browser command and returns its stdout; throws on a non-zero exit. */
export type BrowserRunner = (args: string[], stdin?: string) => Promise<string>;

export const runAgentBrowser: BrowserRunner = async (args, stdin) => {
  const child = Bun.spawn(["agent-browser", ...args], {
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`agent-browser ${args.join(" ")} failed (${code}): ${(stderr || stdout).trim()}`);
  return stdout;
};

export interface AuditOptions {
  /** Open this URL in a disposable browser session, closed afterwards. */
  url?: string;
  /** Audit the current page of an existing agent-browser session, left open. */
  session?: string;
  /** Viewports to audit; defaults to the QA matrix's. */
  viewports?: { width: number; height: number }[];
  /** Color schemes to audit at each viewport; defaults to both. */
  colorSchemes?: Theme[];
  /** Elements inside these selectors (development overlays) are left out, and hidden in screenshots. */
  ignore?: string[];
  /** Pixels two aligned edges or sizes may differ by. */
  tolerance?: number;
  /** Selector of the content area density is measured in; defaults to the visible `main`, else the body without its landmarks. */
  content?: string;
  /** Margins and gutters wider than this many CSS px are listed in `wideGaps`. */
  gapLimit?: number;
  /**
   * Save viewport frames of every audited cell at its scroll stops (top, one per screenful, bottom) as
   * `<dir>/<state>-<phase>-<width>-<theme>-<NN>of<NN>.png`; with `fullPage`, also the whole page with sticky and fixed
   * elements made static, as `...-full-static.png`.
   */
  shots?: { dir: string; state: string; phase: Phase; fullPage?: boolean };
  run?: BrowserRunner;
}

/** How long the page must hold still, in milliseconds, before a cell is measured or a frame saved. */
export const SETTLE_MS = 200;

/**
 * A `wait --fn` expression that holds once the page shows `scheme` and has stood still for `SETTLE_MS`: the media
 * query matches, no finite animation or transition is running or pending (endless ones, such as spinners, are
 * ignored), and the root's and body's colors and theme attributes have not changed. The browser applies an emulated
 * color scheme a moment after the switch, and apps that follow it from script (a `data-theme` set from a media query
 * listener and a render) change later still, so the animations alone can read as settled before the switch has
 * started; measuring then reads the other theme's colors, or colors mid-transition. `wait` numbers this wait, so its
 * stillness is timed from its own first check and never carried over from an earlier wait.
 */
export function settledExpression(scheme: Theme, wait: number): string {
  return `(() => {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  const bodyStyle = document.body ? getComputedStyle(document.body) : rootStyle;
  const sample = [root.className, root.getAttribute("data-theme"), rootStyle.color, rootStyle.backgroundColor, bodyStyle.color, bodyStyle.backgroundColor].join("|");
  const still =
    matchMedia("(prefers-color-scheme: ${scheme})").matches &&
    document.getAnimations().every((a) => (a.playState !== "running" && a.playState !== "pending") || a.effect?.getComputedTiming().iterations === Infinity);
  const now = performance.now();
  const last = window.__auditScreenSettle;
  if (!still || !last || last.wait !== ${wait} || last.sample !== sample) {
    window.__auditScreenSettle = { wait: ${wait}, sample, since: still ? now : Infinity };
    return false;
  }
  if (last.since === Infinity) last.since = now;
  return now - last.since >= ${SETTLE_MS};
})()`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isSnapshot(value: unknown): value is ScreenSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.texts) &&
    Array.isArray(value.controls) &&
    Array.isArray(value.overflowing) &&
    isRecord(value.content) &&
    Array.isArray(value.content.extents) &&
    isRecord(value.page) &&
    isRecord(value.viewport)
  );
}

/** Reads the evaluated value out of agent-browser's `--json eval` envelope. */
function resultOf(output: unknown): unknown {
  return isRecord(output) && output.success === true && isRecord(output.data) ? output.data.result : undefined;
}

function snapshotOf(output: unknown): ScreenSnapshot | null {
  const result = resultOf(output);
  return isSnapshot(result) ? result : null;
}

interface PageScroll extends ScrollMetrics {
  /** Where the page was scrolled before the frames, restored after them. */
  scrollTop: number;
}

function scrollOf(output: unknown): PageScroll | null {
  const result = resultOf(output);
  if (!isRecord(result)) return null;
  const fields = ["scrollHeight", "viewportHeight", "topCover", "bottomCover", "scrollTop"] as const;
  if (!fields.every((field) => typeof result[field] === "number" && Number.isFinite(result[field]))) return null;
  const [scrollHeight, viewportHeight, topCover, bottomCover, scrollTop] = fields.map((field) => Number(result[field]));
  return { scrollHeight, viewportHeight, topCover, bottomCover, scrollTop };
}

/** In-page loop over visible fixed and sticky elements, skipping development overlays. */
const pinnedLoop = (ignore: string[], body: string): string =>
  `for (const element of document.querySelectorAll("body *")) {
  const style = getComputedStyle(element);
  if (style.position !== "fixed" && style.position !== "sticky") continue;
  if (${JSON.stringify(ignore.join(", "))} && element.closest(${JSON.stringify(ignore.join(", "))})) continue;
  ${body}
}`;

/**
 * Measures the document's scroll height, the visible height, and the bands that bars stuck to the top and bottom
 * edges cover. Elements taller than half the viewport (side panels, app shells) are not bars.
 */
export function scrollMetricsScript(ignore: string[]): string {
  return `(() => {
const root = document.scrollingElement ?? document.documentElement;
const height = root.clientHeight;
let topCover = 0;
let bottomCover = 0;
${pinnedLoop(
  ignore,
  `if (style.visibility === "hidden" || style.display === "none") continue;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.height > height / 2 || rect.bottom <= 0 || rect.top >= height) continue;
  if (rect.top <= 1) topCover = Math.max(topCover, rect.bottom);
  else if (rect.bottom >= height - 1) bottomCover = Math.max(bottomCover, height - rect.top);`,
)}
return { scrollHeight: root.scrollHeight, viewportHeight: height, topCover, bottomCover, scrollTop: root.scrollTop };
})();
`;
}

export function scrollToScript(top: number): string {
  return `(document.scrollingElement ?? document.documentElement).scrollTo({ top: ${top}, left: 0, behavior: "instant" });\n`;
}

/** Lays fixed and sticky elements out in place, keeping their inline position for `unpinScript` to restore. */
export function pinScript(ignore: string[]): string {
  return `${pinnedLoop(
    ignore,
    `element.dataset.auditScreenPosition = element.style.getPropertyValue("position") + "|" + element.style.getPropertyPriority("position");
  element.style.setProperty("position", "static", "important");`,
  )}\n`;
}

/** Restores what `pinScript` changed. */
export const UNPIN_SCRIPT = `for (const element of document.querySelectorAll("[data-audit-screen-position]")) {
  const [value, priority] = element.dataset.auditScreenPosition.split("|");
  if (value) element.style.setProperty("position", value, priority);
  else element.style.removeProperty("position");
  delete element.dataset.auditScreenPosition;
}
`;

const COLLECTOR = readFileSync(join(import.meta.dir, "collectScreen.js"), "utf8");
const DEFAULT_OPTIONS_CALL = "})({ ignore: [] });";

/** The collector with its default options replaced by these. */
export function collectorScript(ignore: string[], collector = COLLECTOR, content?: string): string {
  const at = collector.lastIndexOf(DEFAULT_OPTIONS_CALL);
  if (at < 0) throw new Error(`collector does not end with ${DEFAULT_OPTIONS_CALL}`);
  return `${collector.slice(0, at)}})(${JSON.stringify({ ignore, content })});\n`;
}

/** Hides development overlays so screenshots show only product UI. */
export function hideScript(selectors: string[]): string {
  return `for (const element of document.querySelectorAll(${JSON.stringify(selectors.join(", "))})) element.style.setProperty("visibility", "hidden", "important");\n`;
}

/**
 * Saves one cell's frames: a viewport screenshot at each scroll stop, so sticky and fixed bars appear where a reader
 * sees them, then optionally the full page with those bars laid out in place. A full-page screenshot of the live page
 * would paint them at their first-viewport position, over unrelated content halfway down a tall page. Restores the
 * page's scroll position afterwards.
 */
async function captureFrames(
  run: BrowserRunner,
  at: string[],
  ignore: string[],
  shots: NonNullable<AuditOptions["shots"]>,
  width: number,
  scheme: Theme,
  nextWait: () => number,
): Promise<void> {
  const output: unknown = JSON.parse(await run([...at, "--json", "eval", "--stdin"], scrollMetricsScript(ignore)));
  const page = scrollOf(output);
  if (!page) throw new Error(`page scroll measurement failed: ${JSON.stringify(output).slice(0, 500)}`);
  const stops = scrollStops(page);
  const path = (stop: Stop) => join(shots.dir, frameName(shots.state, shots.phase, width, scheme, stop));
  for (const [i, top] of stops.entries()) {
    await run([...at, "eval", "--stdin"], scrollToScript(top));
    await run([...at, "wait", "--fn", settledExpression(scheme, nextWait())]);
    await run([...at, "screenshot", path({ index: i + 1, count: stops.length })]);
  }
  if (shots.fullPage) {
    await run([...at, "eval", "--stdin"], `${scrollToScript(0)}${pinScript(ignore)}`);
    await run([...at, "wait", "--fn", settledExpression(scheme, nextWait())]);
    try {
      await run([...at, "screenshot", "--full", path("full-static")]);
    } finally {
      await run([...at, "eval", "--stdin"], UNPIN_SCRIPT);
    }
  }
  await run([...at, "eval", "--stdin"], scrollToScript(page.scrollTop));
}

/**
 * Audits the page at every viewport and color scheme: sets each, lets the layout settle, collects the page in the
 * browser and analyses it, saving each cell's frames when asked. Returns one report per cell.
 */
export async function auditScreen(options: AuditOptions): Promise<AuditReport[]> {
  if (Boolean(options.url) === Boolean(options.session)) throw new Error("pass exactly one of url or session");
  const run = options.run ?? runAgentBrowser;
  const session = options.session ?? `audit-screen-${process.pid}-${Date.now()}`;
  const at = ["--session", session];
  const ignore = options.ignore ?? [];
  const script = collectorScript(ignore, COLLECTOR, options.content);
  const reports: AuditReport[] = [];
  let waits = 0;
  const nextWait = () => ++waits;
  let opened = !options.url;
  if (options.shots) mkdirSync(options.shots.dir, { recursive: true });
  try {
    for (const viewport of options.viewports ?? QA_VIEWPORTS) {
      for (const scheme of options.colorSchemes ?? QA_THEMES) {
        await run([...at, "set", "viewport", String(viewport.width), String(viewport.height)]);
        await run([...at, "set", "media", scheme]);
        if (!opened && options.url) {
          await run([...at, "open", options.url]);
          await run([...at, "wait", "--load", "networkidle"]);
          opened = true;
        }
        await run([...at, "wait", "--fn", settledExpression(scheme, nextWait())]);
        const output: unknown = JSON.parse(await run([...at, "--json", "eval", "--stdin"], script));
        const snapshot = snapshotOf(output);
        if (!snapshot) throw new Error(`page evaluation failed: ${JSON.stringify(output).slice(0, 500)}`);
        reports.push(analyzeScreen(snapshot, options.tolerance, options.gapLimit));
        if (options.shots) {
          if (ignore.length > 0) await run([...at, "eval", "--stdin"], hideScript(ignore));
          await captureFrames(run, at, ignore, options.shots, viewport.width, scheme, nextWait);
        }
      }
    }
    return reports;
  } finally {
    if (options.url) await run([...at, "close"]).catch(() => undefined);
  }
}

/** True when the report found anything the CLI fails on. */
export const failed = (report: AuditReport): boolean => Object.values(report.summary).some((count) => count > 0);
