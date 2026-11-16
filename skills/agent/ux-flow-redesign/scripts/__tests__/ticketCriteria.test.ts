import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compareCriteria, printableCriteria, readCriteria } from "../lib/ticketCriteria";
import { factory_file, factory_testDirectory, SCRIPTS } from "./fixtures";

const PROPOSAL = `# Export: proposed experience

## Acceptance criteria

- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files
  and the folder lists them in report order (REV-1, export-03).
- [ ] Pressing Enter in the query starts \`export.plan\`, never \`export.run\` (KEY-2).

Tests: a state-machine test covers plan → write → receipt.

## Backend and contract changes

- [ ] Not a criterion.
`;

const criteria = (lines: string) =>
  `## Goal\n\nExport safely.\n\n## Acceptance criteria\n\n${lines}\n\n## Covers\n\n- export-03\n`;
const VERBATIM = criteria(
  "- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files\n  and the folder lists them in report order (REV-1, export-03).\n- [ ] Pressing Enter in the query starts `export.plan`, never `export.run` (KEY-2).\n\nTests: a state-machine test covers plan → write → receipt.",
);

describe("reading the section", () => {
  test("reads list items with their continuation lines and closing paragraph, up to the next heading", () => {
    expect(readCriteria(PROPOSAL)?.entries).toEqual([
      "- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files and the folder lists them in report order (REV-1, export-03).",
      "- [ ] Pressing Enter in the query starts `export.plan`, never `export.run` (KEY-2).",
      "Tests: a state-machine test covers plan → write → receipt.",
    ]);
  });

  test("accepts a bold label, ignores headings inside code fences and returns null without a section", () => {
    const labelled = "**Acceptance criteria:**\n\n- [x] One\n```\n# not a heading\n```\n**Covers**\n- two";
    expect(readCriteria(labelled)?.entries).toEqual(["- [ ] One ``` # not a heading ```"]);
    expect(readCriteria("### Acceptance Criteria\n- [ ] Last\r\n")?.text).toBe("- [ ] Last");
    expect(readCriteria("## Goal\n- [ ] x")).toBeNull();
  });
});

describe("printing for the ticket", () => {
  test("prints the section as written and refuses missing, empty or unfilled criteria", () => {
    expect(printableCriteria(PROPOSAL)).toEqual({
      text: "- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files\n  and the folder lists them in report order (REV-1, export-03).\n- [ ] Pressing Enter in the query starts `export.plan`, never `export.run` (KEY-2).\n\nTests: a state-machine test covers plan → write → receipt.",
      problems: [],
    });
    expect(printableCriteria("# P\n").problems).toEqual(["the proposal has no Acceptance criteria section"]);
    expect(printableCriteria("## Acceptance criteria\n\n## Next\n").problems).toEqual([
      "the proposal's Acceptance criteria section is empty",
    ]);
    expect(printableCriteria("## Acceptance criteria\n- [ ] {{OBSERVABLE_BEHAVIOR}}\n").problems).toEqual([
      "the proposal's acceptance criteria still hold template placeholders; fill them first",
    ]);
  });
});

describe("checking a ticket", () => {
  test("accepts a verbatim copy, rewrapped lines and ticked boxes", () => {
    expect(compareCriteria(PROPOSAL, VERBATIM)).toEqual([]);
    const rewrapped = VERBATIM.replace("9 files\n  and", "9 files and").replaceAll("- [ ] Pressing", "- [x] Pressing");
    expect(compareCriteria(PROPOSAL, rewrapped)).toEqual([]);
  });

  test("reports dropped, added, changed and reordered criteria", () => {
    const condensed = criteria(
      "- [ ] Export writes only the selected reports (REV-1).\n- [ ] Pressing Enter in the query starts `export.plan`, never `export.run` (KEY-2).\n- [ ] The toast offers Undo (UNDO-1).",
    );
    expect(compareCriteria(PROPOSAL, condensed)).toEqual([
      'missing from the ticket: "- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files and the folder lists t…"',
      'missing from the ticket: "Tests: a state-machine test covers plan → write → receipt."',
      'not in the proposal: "- [ ] Export writes only the selected reports (REV-1)."',
      'not in the proposal: "- [ ] The toast offers Undo (UNDO-1)."',
    ]);
    const swapped = VERBATIM.replace("(KEY-2)", "(KEY-3)");
    expect(compareCriteria(PROPOSAL, swapped)).toHaveLength(2);
    const reordered = criteria(
      "- [ ] Pressing Enter in the query starts `export.plan`, never `export.run` (KEY-2).\n- [ ] With 12 reports of which 9 are selected, Export writes exactly 9 files and the folder lists them in report order (REV-1, export-03).\n\nTests: a state-machine test covers plan → write → receipt.",
    );
    expect(compareCriteria(PROPOSAL, reordered)).toEqual([
      "the ticket lists the proposal's criteria in a different order",
    ]);
  });

  test("reports a ticket without the section and a proposal that cannot be printed", () => {
    expect(compareCriteria(PROPOSAL, "## Goal\nExport.")).toEqual([
      "the ticket body has no Acceptance criteria section; paste the proposal's",
    ]);
    expect(compareCriteria("# P", VERBATIM)).toEqual(["the proposal has no Acceptance criteria section"]);
  });
});

test("the CLI prints, checks files and standard input, and rejects bad usage", () => {
  const root = factory_testDirectory("ticket-criteria");
  const proposal = factory_file(join(root, "export.md"), PROPOSAL);
  const good = factory_file(join(root, "ticket.md"), VERBATIM);
  const bad = factory_file(join(root, "bad.md"), criteria("- [ ] Something else."));
  const run = (args: string[], stdin?: string) =>
    Bun.spawnSync(["bun", join(SCRIPTS, "ticket-criteria.ts"), ...args], {
      stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
  const printed = run(["print", proposal]);
  expect(printed.exitCode).toBe(0);
  expect(printed.stdout.toString()).toBe(`${printableCriteria(PROPOSAL).text}\n`);
  expect(run(["check", proposal, good]).stdout.toString()).toContain("OK:");
  const piped = run(["check", proposal, "-"], VERBATIM);
  expect(piped.exitCode).toBe(0);
  const failed = run(["check", proposal, bad]);
  expect(failed.exitCode).toBe(1);
  expect(failed.stderr.toString()).toContain('ERR: not in the proposal: "- [ ] Something else."');
  expect(run(["print", join(root, "missing.md")]).exitCode).toBe(1);
  const sectionless = factory_file(join(root, "goal.md"), "## Goal\n");
  expect(run(["print", sectionless]).stderr.toString()).toContain("no Acceptance criteria section");
  expect(run(["check", proposal]).exitCode).toBe(2);
  expect(run(["lint", proposal]).exitCode).toBe(2);
  expect(run(["--help"]).exitCode).toBe(0);
});
