#!/usr/bin/env bun
// Prints the unit brief for one implementation unit, filled from the project's config. Usage:
//   bun render-brief.ts --config <state>/implementation/config.json [--unit <key>] <ticket>...
//   bun render-brief.ts --config <state>/implementation/config.json --check
// The unit key defaults to impl-<first ticket>. --check validates the config and prints OK. Exits 1 on an invalid
// config or template, 2 on bad usage.
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { renderBrief } from "./lib/brief";
import { loadConfig } from "./lib/config";

const USAGE =
  "usage: bun render-brief.ts --config <config.json> [--unit <key>] <ticket>...\n       bun render-brief.ts --config <config.json> --check";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        config: { type: "string" },
        unit: { type: "string" },
        check: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const { values, positionals } = parse();
const tickets = positionals.map(Number);
const usable =
  values.config && (values.check ? positionals.length === 0 : tickets.length > 0 && tickets.every(Number.isInteger));
if (values.help || !usable) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

try {
  const loaded = loadConfig(values.config ?? "");
  if (values.check) {
    console.log(`OK: ${loaded.path}`);
    process.exit(0);
  }
  const skill = dirname(import.meta.dir);
  console.log(renderBrief({ loaded, unit: values.unit ?? `impl-${tickets[0]}`, tickets, skill }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
