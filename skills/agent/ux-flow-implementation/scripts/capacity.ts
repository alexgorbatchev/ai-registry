#!/usr/bin/env bun
// Measures whether the machine has room to start another heavy unit. Usage:
//   bun capacity.ts --path <dir> [--floor-gib <n>] [--memory-floor <percent>]
// --path is a directory on the volume holding worktrees, dependency stores and build output. Prints JSON with the
// 1-minute load, core count, free memory, swap in use and free disk, and the limits it breaks. Exits 0 when the
// load is below the core count, free memory is at or above --memory-floor (default 15%) and free disk is at or above
// --floor-gib (default 8); 1 when any limit is broken; 2 on bad usage.
import { parseArgs } from "node:util";
import { judge, readCapacity } from "./lib/capacity";

const USAGE = "usage: bun capacity.ts --path <dir> [--floor-gib <n>] [--memory-floor <percent>]";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      options: {
        path: { type: "string" },
        "floor-gib": { type: "string", default: "8" },
        "memory-floor": { type: "string", default: "15" },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const values = parse();
const floor = Number(values["floor-gib"]);
const memoryFloor = Number(values["memory-floor"]);
if (values.help || !values.path || !(floor >= 0) || !(memoryFloor >= 0 && memoryFloor <= 100)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

try {
  const verdict = judge(readCapacity(values.path), values.path, floor, memoryFloor);
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(verdict.room ? 0 : 1);
} catch (error) {
  console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  process.exit(2);
}
