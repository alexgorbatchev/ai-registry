import { describe, expect, it } from "bun:test";

import { checkCoverage } from "../checkCoverage";

const LCOV = [
  "TN:",
  "SF:src/lib/a.ts",
  "FNF:4",
  "FNH:4",
  "LF:10",
  "LH:9",
  "end_of_record",
  "SF:src/lib/b.ts",
  "FNF:1",
  "FNH:1",
  "LF:10",
  "LH:10",
  "end_of_record",
  "",
].join("\n");

describe("checkCoverage", () => {
  it("passes when every file is loaded and both metrics meet the threshold", () => {
    expect(checkCoverage(LCOV, [
      { path: "src/lib/a.ts", transpiledCode: "" },
      { path: "src/lib/b.ts", transpiledCode: "" },
    ], 90)).toEqual({
      totals: { linesFound: 20, linesHit: 19, functionsFound: 5, functionsHit: 5 },
      unloadedFiles: [],
      linePercent: 95,
      functionPercent: 100,
      isPassing: true,
    });
  });

  it("counts a file no test loaded as entirely uncovered", () => {
    const unloadedCode = "export function run() {\n  return [1].map((value) => value);\n}\n\n";

    expect(checkCoverage(LCOV, [
      { path: "src/lib/a.ts", transpiledCode: "" },
      { path: "src/lib/b.ts", transpiledCode: "" },
      { path: "src/bin/run.ts", transpiledCode: unloadedCode },
    ], 90)).toEqual({
      totals: { linesFound: 23, linesHit: 19, functionsFound: 7, functionsHit: 5 },
      unloadedFiles: ["src/bin/run.ts"],
      linePercent: (19 / 23) * 100,
      functionPercent: (5 / 7) * 100,
      isPassing: false,
    });
  });

  it("ignores type-only modules that compile to no runtime code", () => {
    expect(checkCoverage(LCOV, [
      { path: "src/lib/a.ts", transpiledCode: "" },
      { path: "src/lib/types.ts", transpiledCode: "\n" },
    ], 90)).toEqual({
      totals: { linesFound: 10, linesHit: 9, functionsFound: 4, functionsHit: 4 },
      unloadedFiles: [],
      linePercent: 90,
      functionPercent: 100,
      isPassing: true,
    });
  });

  it("treats a package without runtime code as fully covered", () => {
    expect(checkCoverage("", [], 90)).toEqual({
      totals: { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
      unloadedFiles: [],
      linePercent: 100,
      functionPercent: 100,
      isPassing: true,
    });
  });
});
