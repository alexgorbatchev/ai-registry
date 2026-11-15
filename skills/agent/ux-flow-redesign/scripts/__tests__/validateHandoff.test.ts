import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateHandoff } from "../lib/validateHandoff";
import { factory_file, factory_testDirectory, SCRIPTS } from "./fixtures";

function findings(shot: string) {
  return {
    area: "export",
    coverage: [{ flow: "Export a report", exercised: true, notes: "" }],
    findings: [
      {
        id: "export-01",
        title: "Export starts without a preview",
        featureIds: ["F101"],
        category: "workflow",
        severity: "P1",
        observed: "Enter starts the export",
        impact: "Wrong files every week",
        reproSteps: ["Open Export", "Press Enter"],
        suggestion: "Enter previews",
        acceptanceCriteria: ["Enter never writes"],
        screenshots: [{ path: shot, caption: "1. Enter writes" }],
        codeRefs: ["src/export.ts:12"],
        needsBackend: false,
        existingTicket: null,
        confidence: "high",
      },
    ],
  };
}

describe("findings", () => {
  test("accepts a complete file and names every missing field", () => {
    const shot = factory_file(join(factory_testDirectory("handoff"), "01.png"), "png");
    expect(validateHandoff("findings", findings(shot), { featurePattern: /^F\d{3}$/ })).toEqual([]);
    const broken = findings("relative.png");
    Object.assign(broken.findings[0], {
      id: "other-01",
      severity: "P9",
      category: "vibes",
      featureIds: ["X"],
      needsBackend: "no",
      confidence: "sure",
      existingTicket: "12",
    });
    broken.findings.push({ ...broken.findings[0] });
    expect(validateHandoff("findings", broken, { featurePattern: /^F\d{3}$/ })).toEqual(
      expect.arrayContaining([
        'findings[0] (other-01): id must start with "export-"',
        "findings[1] (other-01): duplicate id",
        "findings[0] (other-01): bad feature id X",
        "findings[0] (other-01): screenshot path must be absolute and exist: relative.png",
        "findings[0] (other-01): needsBackend must be true or false",
        "findings[0] (other-01): existingTicket must be null or a ticket number",
      ]),
    );
    const filed = findings(shot);
    Object.assign(filed.findings[0], { existingTicket: 412 });
    expect(validateHandoff("findings", filed)).toEqual([]);
    for (const existingTicket of ["export-03", 0, 4.5]) {
      Object.assign(filed.findings[0], { existingTicket });
      expect(validateHandoff("findings", filed)).toEqual([
        "findings[0] (export-01): existingTicket must be null or a ticket number",
      ]);
    }
    expect(validateHandoff("findings", {})).toEqual([
      "area must be a non-empty string",
      "coverage must be an array of {flow, exercised, notes}",
      "findings must be a non-empty array",
    ]);
  });
});

test("verdicts, audits and critiques", () => {
  expect(
    validateHandoff("verdicts", {
      area: "a",
      verdicts: [{ id: "a-01", verdict: "duplicate", severity: "P2", notes: "same as a-02" }],
    }),
  ).toEqual(["verdicts[0] (a-01): a duplicate needs duplicateOf or existingTicket"]);
  const audit = {
    dimension: "selection",
    coverageGaps: [],
    decisions: [
      {
        id: "selection-01",
        topic: "Row click",
        question: "What does a click on a row do?",
        conflict: true,
        currentApp: { behavior: "Click loads", evidence: ["src/grid.ts:4"] },
        positions: [{ flows: ["export"], position: "Click selects", evidence: "export.md step 2" }],
        silentFlows: [],
      },
    ],
  };
  expect(validateHandoff("audit", audit)).toEqual([]);
  expect(
    validateHandoff("audit", { ...audit, decisions: [{ ...audit.decisions[0], id: "row-1", positions: [{}] }] }),
  ).toEqual([
    "decisions[0] (row-1): id must look like selection-01",
    "decisions[0] (row-1): each position needs flows, position and evidence",
  ]);
  expect(
    validateHandoff("critique", {
      lens: "accessibility",
      issues: [{ severity: "blocker", section: "2.1", problem: "p", evidence: "e", fix: "f" }],
    }),
  ).toEqual([]);
  expect(validateHandoff("critique", { lens: "a", issues: [{ severity: "huge" }] })).toHaveLength(5);
  expect(validateHandoff("plan" as never, {})).toEqual([
    "unknown kind plan; use findings, verdicts, audit or critique",
  ]);
});

test("the CLI prints OK or every error", () => {
  const root = factory_testDirectory("handoff-cli");
  const good = join(root, "critique.json");
  writeFileSync(good, JSON.stringify({ lens: "a11y", issues: [] }));
  const ok = Bun.spawnSync(["bun", join(SCRIPTS, "validate-handoff.ts"), "critique", good], { stdout: "pipe" });
  expect(ok.exitCode).toBe(0);
  expect(ok.stdout.toString()).toContain("OK:");
  const bad = join(root, "bad.json");
  writeFileSync(bad, "{not json");
  expect(Bun.spawnSync(["bun", join(SCRIPTS, "validate-handoff.ts"), "audit", bad], { stderr: "pipe" }).exitCode).toBe(
    1,
  );
  writeFileSync(bad, "{}");
  const invalid = Bun.spawnSync(
    ["bun", join(SCRIPTS, "validate-handoff.ts"), "findings", bad, "--feature-pattern", "^F"],
    { stderr: "pipe" },
  );
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stderr.toString()).toContain("ERR: area must be a non-empty string");
  expect(Bun.spawnSync(["bun", join(SCRIPTS, "validate-handoff.ts")], { stdout: "pipe" }).exitCode).toBe(2);
});
