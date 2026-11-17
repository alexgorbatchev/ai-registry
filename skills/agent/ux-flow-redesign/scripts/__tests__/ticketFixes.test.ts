import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compareFixes, readResolvedCitations, readWireframeFixes } from "../lib/ticketFixes";
import { factory_file, factory_testDirectory, SCRIPTS } from "./fixtures";

const step = (fixes: string) =>
  `<section class="step"><div class="win">…</div><div class="cap"><h2>1. Step</h2><p class="fixes">${fixes}</p></div></section>`;
const WIREFRAME = `<main>${step("Fixes export-03, #412 · Backend: export preview returns per-file sizes (export-99)")}${step("Fixes bulk-edit-2-01 and OPS-12")}${step("Backend only: nothing to fix here")}</main>`;

const TICKET = `## Goal

Export safely.

## Covers

- Resolves: P0: #412. P1: export-03, OPS-12 (export part only; the rest: #418),
  bulk-edit-2-01.
- Related, not covered: export-07 (resolved by \`archive\`), #420 (stopgap).

## Acceptance criteria

- [ ] Export writes exactly 9 files (REV-1, export-03).
`;

describe("reading citations", () => {
  test("takes Fixes citations up to the backend note and skips lines without Fixes", () => {
    expect([...readWireframeFixes(WIREFRAME)].sort()).toEqual(["#412", "OPS-12", "bulk-edit-2-01", "export-03"]);
  });

  test("takes the Resolves entry with its continuation lines, without parenthesized notes", () => {
    expect([...(readResolvedCitations(TICKET) ?? [])].sort()).toEqual([
      "#412",
      "OPS-12",
      "bulk-edit-2-01",
      "export-03",
    ]);
    expect(readResolvedCitations("**Resolves:** #1\n\n- #2")).toEqual(new Set(["#1"]));
    expect(readResolvedCitations("## Covers\n- Related, not covered: #3")).toBeNull();
  });
});

describe("comparing", () => {
  test("accepts matching citations", () => {
    expect(compareFixes(WIREFRAME, TICKET)).toEqual([]);
  });

  test("reports citations missing on either side and a ticket without Resolves", () => {
    const drifted = WIREFRAME.replace("#412", "export-07").replace("bulk-edit-2-01 and ", "");
    expect(compareFixes(drifted, TICKET)).toEqual([
      "the wireframe's Fixes lines cite export-07, which the ticket's Resolves does not list",
      "the ticket resolves #412, which no Fixes line in the wireframe cites",
      "the ticket resolves bulk-edit-2-01, which no Fixes line in the wireframe cites",
    ]);
    expect(compareFixes(WIREFRAME, "## Covers\n")).toEqual(["the ticket body has no Resolves: entry in its covers"]);
  });
});

test("the CLI checks a wireframe against a ticket body and rejects bad usage", () => {
  const root = factory_testDirectory("ticket-fixes");
  const wireframe = factory_file(join(root, "export.html"), WIREFRAME);
  const ticket = factory_file(join(root, "ticket.md"), TICKET);
  const run = (args: string[], stdin?: string) =>
    Bun.spawnSync(["bun", join(SCRIPTS, "ticket-criteria.ts"), ...args], {
      stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
  expect(run(["fixes", wireframe, ticket]).stdout.toString()).toContain("OK:");
  expect(run(["fixes", wireframe, "-"], TICKET).exitCode).toBe(0);
  const failed = run(["fixes", wireframe, "-"], TICKET.replace("#412. ", ""));
  expect(failed.exitCode).toBe(1);
  expect(failed.stderr.toString()).toContain("ERR: the wireframe's Fixes lines cite #412");
  expect(run(["fixes", wireframe]).exitCode).toBe(2);
});
