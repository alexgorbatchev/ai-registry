#!/usr/bin/env bun
import { Glob } from "bun";

import { checkCoverage, type ISourceFile } from "../lib/checkCoverage";
import { getErrorMessage } from "../lib/getErrorMessage";

const COVERAGE_THRESHOLD_PERCENT = 90;
const DEFAULT_SOURCE_PATTERN = "src/**/*.ts";
const EXCLUDED_PATH_PATTERN = /(^|\/)(__tests__|scripts)\//;

// Gates `bun test --coverage --coverage-reporter=lcov` output for a package:
// at least 90% of lines and functions across all non-test source, counting files
// no test loaded as uncovered. Run from the package root with the lcov path and,
// for packages without a `src/` tree, a source glob relative to that root.
async function main(): Promise<void> {
  const [lcovPath, sourcePattern = DEFAULT_SOURCE_PATTERN] = process.argv.slice(2);
  if (lcovPath === undefined) {
    throw new Error("Usage: check-coverage <lcov.info> [source-glob]");
  }

  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const sourceFiles: ISourceFile[] = [];
  for await (const path of new Glob(sourcePattern).scan(".")) {
    if (EXCLUDED_PATH_PATTERN.test(path)) {
      continue;
    }
    sourceFiles.push({ path, transpiledCode: transpiler.transformSync(await Bun.file(path).text()) });
  }

  const report = checkCoverage(await Bun.file(lcovPath).text(), sourceFiles, COVERAGE_THRESHOLD_PERCENT);
  for (const unloadedFile of report.unloadedFiles) {
    console.log(`not loaded by any test (counted as uncovered): ${unloadedFile}`);
  }
  console.log(
    `lines ${report.totals.linesHit}/${report.totals.linesFound} (${report.linePercent.toFixed(2)}%), ` +
      `functions ${report.totals.functionsHit}/${report.totals.functionsFound} (${report.functionPercent.toFixed(2)}%), ` +
      `threshold ${COVERAGE_THRESHOLD_PERCENT}%`,
  );
  if (!report.isPassing) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
