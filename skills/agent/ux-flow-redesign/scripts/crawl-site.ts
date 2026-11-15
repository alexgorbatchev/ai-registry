#!/usr/bin/env bun
// Crawls a locally served documentation site from its start page. Usage:
//   bun crawl-site.ts <start-url> [--root-dir <dir>] [--insecure] [--external] [--ignore <regex>]... [--max-pages <n>] [--json]
// Reports broken same-origin links, missing #fragments, and (with --root-dir) .html/.md files no page links.
// Exits 1 when anything is broken, missing or unreached.
import { parseArgs } from "node:util";
import { crawlSite } from "./lib/crawlSite";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    "root-dir": { type: "string" },
    insecure: { type: "boolean", default: false },
    external: { type: "boolean", default: false },
    ignore: { type: "string", multiple: true, default: [] },
    "max-pages": { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || positionals.length !== 1) {
  console.log(
    "usage: bun crawl-site.ts <start-url> [--root-dir <dir>] [--insecure] [--external] [--ignore <regex>]... [--max-pages <n>] [--json]",
  );
  process.exit(values.help ? 0 : 2);
}

const result = await crawlSite({
  start: positionals[0],
  rootDir: values["root-dir"],
  insecure: values.insecure,
  external: values.external,
  ignore: values.ignore.map((pattern) => new RegExp(pattern)),
  maxPages: values["max-pages"] ? Number(values["max-pages"]) : undefined,
});

if (!result.started) {
  console.log(`start page unreachable: ${result.broken[0]?.status} ${positionals[0]}`);
  console.log("For a locally issued certificate, run with `bun --use-system-ca`, or pass --insecure.");
  process.exit(1);
}
const failed = result.broken.length + result.missingFragments.length + result.orphans.length;
if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const problem of [...result.broken, ...result.missingFragments]) {
    console.log(`${problem.status} ${problem.url}`);
    for (const referrer of problem.referrers) console.log(`    linked from ${referrer}`);
  }
  for (const orphan of result.orphans) console.log(`unlinked file ${orphan}`);
  for (const url of result.skipped) console.log(`skipped ${url}`);
  console.log(
    `${result.pages} page(s), ${result.requested} request(s), ${result.broken.length} broken, ${result.missingFragments.length} missing fragment(s), ${result.orphans.length} unlinked file(s), ${result.skipped.length} skipped, ${result.externalUnchecked} external link(s) not checked`,
  );
}
process.exit(failed ? 1 : 0);
