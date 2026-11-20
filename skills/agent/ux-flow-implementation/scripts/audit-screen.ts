#!/usr/bin/env bun
// Audits one rendered screen in a real browser through agent-browser, across the QA matrix. Usage:
//   bun audit-screen.ts (--url <url> | --session <name>) [--viewport <width>x<height>]...
//     [--color-scheme light|dark|both] [--ignore <selector>]... [--tolerance <px>]
//     [--shots <dir> --state <slug> [--phase before|after] [--full-page]]
// Without --viewport it audits 320x640, 390x844 and 1440x900; --color-scheme defaults to both. --url opens the page
// in a disposable session and closes it; --session audits that session's current page and leaves it open, at the
// last viewport and color scheme audited. --shots also saves viewport frames of every cell at its scroll stops (top,
// one per screenful, bottom) as <dir>/<state>-<phase>-<width>-<theme>-<NN>of<NN>.png, so sticky and fixed bars sit
// where a reader sees them, with the --ignore elements hidden; --full-page adds the whole page with sticky and fixed
// elements laid out in place, as ...-full-static.png. Each cell is measured once no finite
// animation or transition is running, so theme switches are not read mid-transition. Prints JSON with one report per cell:
// text contrast (4.5:1, 3:1 large), control boundary contrast (3:1), text-only buttons with no boundary, horizontal
// overflow, touch targets under 24 px, and sibling controls whose heights, centres, left edges or widths differ.
// Exits 1 when any cell has any of those, 2 on bad usage, 3 when the browser step fails.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { auditScreen, failed } from "./lib/auditScreen";
import { isStateSlug, QA_THEMES, type Theme } from "./lib/matrix";

const USAGE =
  "usage: bun audit-screen.ts (--url <url> | --session <name>) [--viewport <width>x<height>]... [--color-scheme light|dark|both] [--ignore <selector>]... [--tolerance <px>] [--shots <dir> --state <slug> [--phase before|after] [--full-page]]";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      options: {
        url: { type: "string" },
        session: { type: "string" },
        viewport: { type: "string", multiple: true, default: [] },
        "color-scheme": { type: "string", default: "both" },
        ignore: { type: "string", multiple: true, default: [] },
        tolerance: { type: "string", default: "1" },
        shots: { type: "string" },
        state: { type: "string" },
        phase: { type: "string", default: "after" },
        "full-page": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const values = parse();

const viewports = values.viewport.map((value) => /^(\d+)x(\d+)$/.exec(value));
const scheme = values["color-scheme"];
const colorSchemes: Theme[] | undefined =
  scheme === "both" ? [...QA_THEMES] : scheme === "light" || scheme === "dark" ? [scheme] : undefined;
const tolerance = Number(values.tolerance);
const phase = values.phase === "before" || values.phase === "after" ? values.phase : undefined;
const shotsValid =
  values.shots === undefined
    ? values.state === undefined && !values["full-page"]
    : values.state !== undefined && isStateSlug(values.state);
if (
  values.help ||
  viewports.some((match) => match === null) ||
  Boolean(values.url) === Boolean(values.session) ||
  colorSchemes === undefined ||
  !Number.isFinite(tolerance) ||
  tolerance < 0 ||
  phase === undefined ||
  !shotsValid
) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

try {
  const reports = await auditScreen({
    url: values.url,
    session: values.session,
    viewports: viewports.length
      ? viewports.map((match) => ({ width: Number(match?.[1]), height: Number(match?.[2]) }))
      : undefined,
    colorSchemes,
    ignore: values.ignore,
    tolerance,
    shots:
      values.shots && values.state
        ? { dir: resolve(values.shots), state: values.state, phase, fullPage: values["full-page"] }
        : undefined,
  });
  const failing = reports.filter(failed).length;
  console.log(JSON.stringify({ failing, screens: reports }, null, 2));
  process.exit(failing > 0 ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(3);
}
