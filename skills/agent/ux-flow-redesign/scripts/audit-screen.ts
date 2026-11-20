#!/usr/bin/env bun
// Audits one rendered screen in a real browser through agent-browser. Usage:
//   bun audit-screen.ts (--url <url> | --session <name>) --viewport <width>x<height>
//     [--color-scheme light|dark] [--ignore <selector>]... [--tolerance <px>]
// --url opens the page in a disposable session and closes it; --session audits that session's current page and
// leaves it open (it keeps the viewport and color scheme set here). Prints a JSON report: text contrast
// (4.5:1, 3:1 large), control boundary contrast (3:1), horizontal overflow, touch targets under 24 px, and
// sibling controls whose heights, centres, left edges or widths differ. Exits 1 when any of those is found,
// 2 on bad usage, 3 when the browser step fails.
import { parseArgs } from "node:util";
import { auditScreen } from "./lib/auditScreen";

const USAGE =
  "usage: bun audit-screen.ts (--url <url> | --session <name>) --viewport <width>x<height> [--color-scheme light|dark] [--ignore <selector>]... [--tolerance <px>]";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      options: {
        url: { type: "string" },
        session: { type: "string" },
        viewport: { type: "string" },
        "color-scheme": { type: "string" },
        ignore: { type: "string", multiple: true, default: [] },
        tolerance: { type: "string", default: "1" },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const values = parse();

const viewport = /^(\d+)x(\d+)$/.exec(values.viewport ?? "");
const scheme = values["color-scheme"];
const colorScheme = scheme === "light" || scheme === "dark" ? scheme : undefined;
const tolerance = Number(values.tolerance);
if (
  values.help ||
  !viewport ||
  Boolean(values.url) === Boolean(values.session) ||
  (scheme !== undefined && colorScheme === undefined) ||
  !Number.isFinite(tolerance) ||
  tolerance < 0
) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

try {
  const report = await auditScreen({
    url: values.url,
    session: values.session,
    viewport: { width: Number(viewport[1]), height: Number(viewport[2]) },
    colorScheme,
    ignore: values.ignore,
    tolerance,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(Object.values(report.summary).some((count) => count > 0) ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(3);
}
