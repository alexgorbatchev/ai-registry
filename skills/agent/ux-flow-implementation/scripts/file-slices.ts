#!/usr/bin/env bun
// Files one implementation ticket per delivery slice of each redesign proposal, under one epic. Usage:
//   bun file-slices.ts --config <state>/implementation/config.json [--apply]
// Reads slices-plan.json beside the config and the proposals under the config's design.proposals. Without --apply it
// prints one line per slice (key, redesign, title, blockers) and changes nothing. With --apply it creates the epic
// once and files the unfiled slices in dependency order, recording each in slices.json as it goes, so a rerun files
// only what is missing. Exits 1 on an invalid plan, proposal or tracker failure, 2 on bad usage.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, resolvePath } from "./lib/config";
import { buildSlices, fileSlices, parsePlan, readRecord } from "./lib/slices";

const USAGE = "usage: bun file-slices.ts --config <config.json> [--apply]";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      options: {
        config: { type: "string" },
        apply: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const values = parse();
if (values.help || !values.config) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

try {
  const loaded = loadConfig(values.config);
  const dir = dirname(loaded.path);
  const planPath = join(dir, "slices-plan.json");
  const plan = parsePlan(readFileSync(planPath, "utf8"), planPath);
  const proposals = resolvePath(loaded.root, loaded.config.design.proposals);
  const slices = buildSlices(loaded, plan, (flow) => readFileSync(join(proposals, `${flow}.md`), "utf8"));
  if (!values.apply) {
    const record = readRecord(join(dir, "slices.json"));
    for (const slice of slices) {
      const filed = record.slices[slice.key] ? `#${record.slices[slice.key].number}` : "unfiled";
      console.log(
        `${slice.key}\t${filed}\t#${slice.parent}\t${slice.title}\tblocked by ${slice.blockedBy.join(", ") || "-"}`,
      );
    }
    process.exit(0);
  }
  fileSlices({ loaded, plan, dir, slices });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
