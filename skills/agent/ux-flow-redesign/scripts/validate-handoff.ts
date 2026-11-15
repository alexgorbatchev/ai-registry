#!/usr/bin/env bun
// Validates a unit's handoff file before the unit returns. Usage:
//   bun validate-handoff.ts <findings|verdicts|audit|critique> <file.json> [--feature-pattern <regex>]
// Prints OK and exits 0 when valid; prints every problem and exits 1 otherwise. Fix and rerun, at most three times;
// a failure the environment causes is reported as an environment issue instead.
import { parseArgs } from "node:util";
import { validateHandoff, type HandoffKind } from "./lib/validateHandoff";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { "feature-pattern": { type: "string" }, help: { type: "boolean", short: "h", default: false } },
});

if (values.help || positionals.length !== 2) {
  console.log(
    "usage: bun validate-handoff.ts <findings|verdicts|audit|critique> <file.json> [--feature-pattern <regex>]",
  );
  process.exit(values.help ? 0 : 2);
}

const [kind, file] = positionals;
let data: unknown;
try {
  data = JSON.parse(await Bun.file(file).text());
} catch (error) {
  console.error(`ERR: ${file} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
const featurePattern = values["feature-pattern"] ? new RegExp(values["feature-pattern"]) : undefined;
const errors = validateHandoff(kind as HandoffKind, data, { featurePattern });
if (errors.length) {
  for (const error of errors) console.error(`ERR: ${error}`);
  process.exit(1);
}
console.log(`OK: ${file} is a valid ${kind} file`);
