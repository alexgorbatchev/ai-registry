#!/usr/bin/env bun
// Creates UX flow-redesign files from the bundled templates without overwriting anything. Usage:
//   bun scaffold-flow.ts --docs <ux-flows-dir> --init [--product <name>] [--docs-index <index.md>]
//   bun scaffold-flow.ts --docs <ux-flows-dir> --key <flow-key> --title <title> [--product <name>]
//       [--ticket-url <url> --ticket-label <label>] [--repo-root <dir>] [--docs-index <index.md>]
// Prints created, kept and linked files, then every placeholder still to fill. Fill them all; the wireframe linter
// fails on any left in an HTML page.
import { parseArgs } from "node:util";
import { scaffold } from "./lib/scaffold";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    docs: { type: "string" },
    init: { type: "boolean", default: false },
    key: { type: "string" },
    title: { type: "string" },
    product: { type: "string" },
    "ticket-url": { type: "string" },
    "ticket-label": { type: "string" },
    "repo-root": { type: "string" },
    "docs-index": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !values.docs) {
  console.log(
    "usage: bun scaffold-flow.ts --docs <ux-flows-dir> [--init] [--key <flow-key> --title <title>] [--product <name>] [--ticket-url <url> --ticket-label <label>] [--repo-root <dir>] [--docs-index <index.md>]",
  );
  process.exit(values.help ? 0 : 2);
}

try {
  const result = scaffold({
    docsDir: values.docs,
    init: values.init,
    key: values.key,
    title: values.title,
    product: values.product,
    ticketUrl: values["ticket-url"],
    ticketLabel: values["ticket-label"],
    repoRoot: values["repo-root"],
    docsIndex: values["docs-index"],
  });
  for (const path of result.created) console.log(`created ${path}`);
  for (const path of result.kept) console.log(`kept ${path} (already exists)`);
  for (const path of result.linked) console.log(`linked ${path}`);
  for (const [path, names] of Object.entries(result.todo)) console.log(`todo ${path}: ${names.join(", ")}`);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
