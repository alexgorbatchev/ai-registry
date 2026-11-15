#!/usr/bin/env bun
// Checks wireframe pages against the shared design language. Usage:
//   bun lint-wireframes.ts [--stylesheet <name.css>] [--site-root <dir>] [--json] <file-or-directory>...
// Directories are searched recursively for .html files. Exits 1 when any error is found.
import { statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { lintWireframes } from "./lib/lintWireframes";

function collect(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    if (statSync(input).isDirectory()) {
      for (const path of new Bun.Glob("**/*.html").scanSync(input)) files.push(join(input, path));
    } else files.push(input);
  }
  return [...new Set(files)].sort();
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    stylesheet: { type: "string" },
    "site-root": { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || positionals.length === 0) {
  console.log(
    "usage: bun lint-wireframes.ts [--stylesheet <name.css>] [--site-root <dir>] [--json] <file-or-directory>...",
  );
  process.exit(values.help ? 0 : 2);
}

const files = collect(positionals);
const findings = lintWireframes(files, { stylesheet: values.stylesheet, siteRoot: values["site-root"] });
const errors = findings.filter((finding) => finding.severity === "error").length;
if (values.json) {
  console.log(JSON.stringify({ files: files.length, errors, warnings: findings.length - errors, findings }, null, 2));
} else {
  for (const finding of findings) {
    console.log(`${finding.file}:${finding.line}: ${finding.severity} ${finding.rule}: ${finding.message}`);
  }
  console.log(`${files.length} page(s), ${errors} error(s), ${findings.length - errors} warning(s)`);
}
process.exit(errors ? 1 : 0);
