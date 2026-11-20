/** The visual QA matrix: every screen is captured and audited at each viewport in each theme. */
export const QA_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

export const QA_THEMES = ["light", "dark"] as const;

export type Theme = (typeof QA_THEMES)[number];
export type Phase = "before" | "after";

/** The most viewport frames one cell may have; stop numbers are two digits. */
export const MAX_STOPS = 99;

/**
 * Which image of a cell a frame is: the viewport frame at scroll stop `index` of `count` (1 is the top, `count` the
 * bottom), or the whole page with sticky and fixed elements laid out in place (`full-static`).
 */
export type Stop = { index: number; count: number } | "full-static";

const two = (value: number): string => String(value).padStart(2, "0");

/** `01of03` or `full-static`: the stop's part of a frame name. */
export function stopLabel(stop: Stop): string {
  return stop === "full-static" ? stop : `${two(stop.index)}of${two(stop.count)}`;
}

/**
 * `<state>-<phase>-<width>-<theme>-<NN>of<NN>.png` for a viewport frame and `...-full-static.png` for a full-page
 * image: the evidence file name every step of the skill reads.
 */
export function frameName(state: string, phase: Phase, width: number, theme: Theme, stop: Stop): string {
  return `${state}-${phase}-${width}-${theme}-${stopLabel(stop)}.png`;
}

export interface FrameName {
  state: string;
  phase: Phase;
  width: number;
  theme: Theme;
  stop: Stop;
}

export function parseFrameName(file: string): FrameName | null {
  const match = /^(.+)-(before|after)-(\d+)-(light|dark)-(?:(\d{2})of(\d{2})|(full-static))\.png$/.exec(file);
  if (!match) return null;
  const [, state, phase, width, theme, index, count, full] = match;
  const stop: Stop = full ? "full-static" : { index: Number(index), count: Number(count) };
  if (stop !== "full-static" && (stop.index < 1 || stop.index > stop.count)) return null;
  return {
    state,
    phase: phase === "before" ? "before" : "after",
    width: Number(width),
    theme: theme === "dark" ? "dark" : "light",
    stop,
  };
}

/** A state slug safe in file names: lowercase letters, digits and single hyphens. */
export const isStateSlug = (state: string): boolean => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(state);

export interface ScrollMetrics {
  /** The document's scroll height. */
  scrollHeight: number;
  /** The visible height of the scrolling element. */
  viewportHeight: number;
  /** Height covered by fixed or sticky elements stuck to the top edge. */
  topCover: number;
  /** Height covered by fixed or sticky elements stuck to the bottom edge. */
  bottomCover: number;
}

/**
 * Scroll positions for viewport frames: the top, one per screenful, and the bottom. Each step advances by the height
 * left visible between top and bottom bars (at least half the viewport), so content a bar covers in one frame shows
 * uncovered in the next.
 */
export function scrollStops({ scrollHeight, viewportHeight, topCover, bottomCover }: ScrollMetrics): number[] {
  const bottom = Math.max(0, Math.ceil(scrollHeight - viewportHeight));
  const step = Math.max(Math.floor(viewportHeight - topCover - bottomCover), Math.ceil(viewportHeight / 2), 1);
  const stops = [0];
  while (stops[stops.length - 1] < bottom) stops.push(Math.min(stops[stops.length - 1] + step, bottom));
  if (stops.length > MAX_STOPS)
    throw new Error(
      `the page needs ${stops.length} viewport frames, more than ${MAX_STOPS}; capture its parts as separate states`,
    );
  return stops;
}
