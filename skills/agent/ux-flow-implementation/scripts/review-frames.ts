#!/usr/bin/env bun
// Prepares and checks a blind screenshot review. Usage:
//   bun review-frames.ts manifest --out <manifest.json> <shots-dir>...
//   bun review-frames.ts check <manifest.json> <review.json> [--triaged]
// manifest lists every after frame named <state>-after-<width>-<theme>.png in the directories, with neutral IDs,
// and exits 1 when a captured state lacks a cell of the 320/390/1440 x light/dark matrix (the manifest is still
// written). check exits 1 unless the review accounts for every frame, each with findings or a note per checklist
// item, and with --triaged unless every finding has a disposition. Exit 2 on bad usage.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildManifest, checkReview, type Manifest } from "./lib/reviewFrames";

const USAGE =
  "usage: bun review-frames.ts manifest --out <manifest.json> <shots-dir>...\n       bun review-frames.ts check <manifest.json> <review.json> [--triaged]";

function parse() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        out: { type: "string" },
        triaged: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
}

const { values, positionals } = parse();
const [command, ...rest] = positionals;
const usable =
  (command === "manifest" && values.out !== undefined && rest.length > 0) || (command === "check" && rest.length === 2);
if (values.help || !usable) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

const isManifest = (value: unknown): value is Manifest =>
  typeof value === "object" && value !== null && "frames" in value && Array.isArray(value.frames);

try {
  if (command === "manifest") {
    const manifest = buildManifest(rest);
    writeFileSync(values.out ?? "", `${JSON.stringify(manifest, null, 2)}\n`);
    for (const path of manifest.unnamed)
      console.log(`WARN: left out, not named <state>-<phase>-<width>-<theme>.png: ${path}`);
    for (const cell of manifest.missing) console.log(`ERR: missing frame: ${cell}`);
    console.log(`${manifest.missing.length ? "ERR" : "OK"}: ${manifest.frames.length} frames in ${values.out}`);
    process.exit(manifest.missing.length || manifest.frames.length === 0 ? 1 : 0);
  }
  const manifest: unknown = JSON.parse(readFileSync(rest[0], "utf8"));
  if (!isManifest(manifest)) throw new Error(`${rest[0]} is not a manifest`);
  const result = checkReview(manifest, JSON.parse(readFileSync(rest[1], "utf8")), values.triaged);
  for (const problem of result.problems) console.log(`ERR: ${problem}`);
  const counts = `${result.frames} frames, ${result.findings} findings${values.triaged ? `, ${result.untriaged} untriaged` : ""}`;
  console.log(result.problems.length ? `ERR: ${result.problems.length} problems; ${counts}` : `OK: ${counts}`);
  process.exit(result.problems.length ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
