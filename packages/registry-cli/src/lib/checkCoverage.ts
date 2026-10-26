export type ICoverageTotals = {
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
};

export type ISourceFile = {
  path: string;
  // Type-stripped JavaScript for the file, used to size files no test loaded.
  transpiledCode: string;
};

export type ICoverageReport = {
  totals: ICoverageTotals;
  unloadedFiles: string[];
  linePercent: number;
  functionPercent: number;
  isPassing: boolean;
};

const FUNCTION_PATTERN = /\bfunction\b|=>/g;

function parseLcov(lcov: string): Map<string, ICoverageTotals> {
  const records = new Map<string, ICoverageTotals>();
  let currentPath: string | null = null;
  let current: ICoverageTotals = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };

  for (const line of lcov.split("\n")) {
    const separatorIndex = line.indexOf(":");
    const key = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    if (key === "SF") {
      currentPath = value;
      current = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };
    } else if (key === "LF") {
      current.linesFound = Number(value);
    } else if (key === "LH") {
      current.linesHit = Number(value);
    } else if (key === "FNF") {
      current.functionsFound = Number(value);
    } else if (key === "FNH") {
      current.functionsHit = Number(value);
    } else if (key === "end_of_record" && currentPath !== null) {
      records.set(currentPath, current);
      currentPath = null;
    }
  }

  return records;
}

// A file no test loaded counts as entirely uncovered: every non-blank line of its
// type-stripped code is a missed line and every function or arrow is a missed function.
function sizeUnloadedFile(transpiledCode: string): ICoverageTotals {
  return {
    linesFound: transpiledCode.split("\n").filter((line) => line.trim().length > 0).length,
    linesHit: 0,
    functionsFound: transpiledCode.match(FUNCTION_PATTERN)?.length ?? 0,
    functionsHit: 0,
  };
}

function toPercent(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

export function checkCoverage(lcov: string, sourceFiles: readonly ISourceFile[], thresholdPercent: number): ICoverageReport {
  const records = parseLcov(lcov);
  const totals: ICoverageTotals = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };
  const unloadedFiles: string[] = [];

  for (const sourceFile of sourceFiles) {
    let fileTotals = records.get(sourceFile.path);
    if (fileTotals === undefined) {
      fileTotals = sizeUnloadedFile(sourceFile.transpiledCode);
      // Type-only modules compile to nothing and have no runtime code to cover.
      if (fileTotals.linesFound === 0) {
        continue;
      }
      unloadedFiles.push(sourceFile.path);
    }
    totals.linesFound += fileTotals.linesFound;
    totals.linesHit += fileTotals.linesHit;
    totals.functionsFound += fileTotals.functionsFound;
    totals.functionsHit += fileTotals.functionsHit;
  }

  const linePercent = toPercent(totals.linesHit, totals.linesFound);
  const functionPercent = toPercent(totals.functionsHit, totals.functionsFound);
  return {
    totals,
    unloadedFiles,
    linePercent,
    functionPercent,
    isPassing: linePercent >= thresholdPercent && functionPercent >= thresholdPercent,
  };
}
