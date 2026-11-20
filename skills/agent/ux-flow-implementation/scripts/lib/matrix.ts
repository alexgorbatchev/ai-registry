/** The visual QA matrix: every screen is captured and audited at each viewport in each theme. */
export const QA_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

export const QA_THEMES = ["light", "dark"] as const;

export type Theme = (typeof QA_THEMES)[number];
export type Phase = "before" | "after";

/** `<state>-<phase>-<width>-<theme>.png`, the evidence file name every step of the skill reads. */
export function frameName(state: string, phase: Phase, width: number, theme: Theme): string {
  return `${state}-${phase}-${width}-${theme}.png`;
}

export interface FrameName {
  state: string;
  phase: Phase;
  width: number;
  theme: Theme;
}

export function parseFrameName(file: string): FrameName | null {
  const match = /^(.+)-(before|after)-(\d+)-(light|dark)\.png$/.exec(file);
  if (!match) return null;
  const [, state, phase, width, theme] = match;
  return {
    state,
    phase: phase === "before" ? "before" : "after",
    width: Number(width),
    theme: theme === "dark" ? "dark" : "light",
  };
}

/** A state slug safe in file names: lowercase letters, digits and single hyphens. */
export const isStateSlug = (state: string): boolean => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(state);
