import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { frameName, QA_THEMES, QA_VIEWPORTS, type Phase, type Theme } from "./matrix";

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
  /** Buttons with text, no icon, and no border or fill distinct from their surroundings: they read as plain text. */
  borderlessText: ControlRef[];
  /** Borderless buttons that draw an icon: check the icon is a conventional one. Not a failure. */
  borderlessIcon: ControlRef[];
  /** Text whose background could not be resolved (image, gradient, filter); check it by eye. Not a failure. */
  unresolved: ControlRef[];
}

const round = (value: number): number => Math.round(value * 100) / 100;

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

export function analyzeScreen(snapshot: ScreenSnapshot, tolerance = 1): AuditReport {
  const { textContrast, unresolved } = textContrastIssues(snapshot);
  const { controlBoundary, borderlessText, borderlessIcon } = boundaryIssues(snapshot);
  const touchTargets = touchTargetIssues(snapshot);
  const alignment = alignmentIssues(snapshot, tolerance);
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
  /** Save a full-page screenshot of every audited cell as `<dir>/<state>-<phase>-<width>-<theme>.png`. */
  shots?: { dir: string; state: string; phase: Phase };
  run?: BrowserRunner;
}

/**
 * True once no finite animation or transition is running or pending. Reading the animations flushes style, so the
 * transitions a color scheme or viewport change starts are already listed; endless animations (spinners) are ignored.
 * Measuring before this holds reads colors mid-transition, such as a dark border still close to the light background.
 */
export const SETTLED_EXPRESSION =
  'document.getAnimations().every((a) => (a.playState !== "running" && a.playState !== "pending") || a.effect?.getComputedTiming().iterations === Infinity)';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isSnapshot(value: unknown): value is ScreenSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.texts) &&
    Array.isArray(value.controls) &&
    Array.isArray(value.overflowing) &&
    isRecord(value.page) &&
    isRecord(value.viewport)
  );
}

/** Reads the snapshot out of agent-browser's `--json eval` envelope. */
function snapshotOf(output: unknown): ScreenSnapshot | null {
  if (!isRecord(output) || output.success !== true || !isRecord(output.data)) return null;
  const result: unknown = output.data.result;
  return isSnapshot(result) ? result : null;
}

const COLLECTOR = readFileSync(join(import.meta.dir, "collectScreen.js"), "utf8");
const DEFAULT_OPTIONS_CALL = "})({ ignore: [] });";

/** The collector with its default options replaced by these. */
export function collectorScript(ignore: string[], collector = COLLECTOR): string {
  const at = collector.lastIndexOf(DEFAULT_OPTIONS_CALL);
  if (at < 0) throw new Error(`collector does not end with ${DEFAULT_OPTIONS_CALL}`);
  return `${collector.slice(0, at)}})(${JSON.stringify({ ignore })});\n`;
}

/** Hides development overlays so screenshots show only product UI. */
export function hideScript(selectors: string[]): string {
  return `for (const element of document.querySelectorAll(${JSON.stringify(selectors.join(", "))})) element.style.setProperty("visibility", "hidden", "important");\n`;
}

/**
 * Audits the page at every viewport and color scheme: sets each, lets the layout settle, collects the page in the
 * browser and analyses it, saving a screenshot of each cell when asked. Returns one report per cell.
 */
export async function auditScreen(options: AuditOptions): Promise<AuditReport[]> {
  if (Boolean(options.url) === Boolean(options.session)) throw new Error("pass exactly one of url or session");
  const run = options.run ?? runAgentBrowser;
  const session = options.session ?? `audit-screen-${process.pid}-${Date.now()}`;
  const at = ["--session", session];
  const ignore = options.ignore ?? [];
  const script = collectorScript(ignore);
  const reports: AuditReport[] = [];
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
        await run([...at, "wait", "--fn", SETTLED_EXPRESSION]);
        const output: unknown = JSON.parse(await run([...at, "--json", "eval", "--stdin"], script));
        const snapshot = snapshotOf(output);
        if (!snapshot) throw new Error(`page evaluation failed: ${JSON.stringify(output).slice(0, 500)}`);
        reports.push(analyzeScreen(snapshot, options.tolerance));
        if (options.shots) {
          if (ignore.length > 0) await run([...at, "eval", "--stdin"], hideScript(ignore));
          const { dir, state, phase } = options.shots;
          await run([...at, "screenshot", "--full", join(dir, frameName(state, phase, viewport.width, scheme))]);
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
