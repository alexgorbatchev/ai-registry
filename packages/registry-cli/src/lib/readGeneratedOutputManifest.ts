import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

import {
  GENERATED_OUTPUT_MANIFEST_NAME,
  GENERATED_OUTPUT_MANIFEST_VERSION,
  LEGACY_GENERATED_OUTPUT_MANIFEST_NAME,
  type IGeneratedOutputManifest,
  type IGeneratedOutputManifestEntry,
} from "./generatedOutputUtils";
import { getObjectValue } from "./harnessBuild";

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isGeneratedOutputManifestEntry(
  value: unknown,
): value is IGeneratedOutputManifestEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const kind = getObjectValue(value, "kind");
  if (kind === "directory") return true;
  if (kind === "file") return typeof getObjectValue(value, "checksum") === "string";
  if (kind === "symlink") return typeof getObjectValue(value, "target") === "string";
  return false;
}

function isGeneratedOutputManifestEntryRecord(
  value: unknown,
): value is Record<string, IGeneratedOutputManifestEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => isGeneratedOutputManifestEntry(entry));
}

function isGeneratedOutputManifest(
  value: unknown,
): value is IGeneratedOutputManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const entries = getObjectValue(value, "entries");
  const syncedFilePaths = getObjectValue(value, "syncedFilePaths");
  const sourcePaths = getObjectValue(value, "sourcePaths");
  const sourceChecksums = getObjectValue(value, "sourceChecksums");
  return (
    version === GENERATED_OUTPUT_MANIFEST_VERSION &&
    typeof generatedAt === "string" &&
    isGeneratedOutputManifestEntryRecord(entries) &&
    (syncedFilePaths === undefined ||
      (Array.isArray(syncedFilePaths) && syncedFilePaths.every((path) => typeof path === "string"))) &&
    (sourcePaths === undefined || isStringRecord(sourcePaths)) &&
    (sourceChecksums === undefined || isStringRecord(sourceChecksums))
  );
}

type ILegacyGeneratedOutputManifest = {
  version: 1;
  generatedAt: string;
  files: Record<string, string>;
};

function isLegacyGeneratedOutputManifest(
  value: unknown,
): value is ILegacyGeneratedOutputManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const files = getObjectValue(value, "files");
  return version === 1 && typeof generatedAt === "string" && isStringRecord(files);
}

function convertLegacyGeneratedOutputManifest(
  legacyManifest: ILegacyGeneratedOutputManifest,
): IGeneratedOutputManifest {
  const entries = Object.fromEntries(
    Object.entries(legacyManifest.files).map(([relativePath, checksum]) => [
      relativePath,
      { kind: "file", checksum } satisfies IGeneratedOutputManifestEntry,
    ]),
  );
  return {
    version: GENERATED_OUTPUT_MANIFEST_VERSION,
    generatedAt: legacyManifest.generatedAt,
    entries,
  };
}

export async function readGeneratedOutputManifest(outputDir: string): Promise<IGeneratedOutputManifest | null> {
  const generatedManifestPath = join(outputDir, GENERATED_OUTPUT_MANIFEST_NAME);
  const legacyManifestPath = join(outputDir, LEGACY_GENERATED_OUTPUT_MANIFEST_NAME);

  const manifestPath = existsSync(generatedManifestPath)
    ? generatedManifestPath
    : existsSync(legacyManifestPath)
      ? legacyManifestPath
      : null;

  if (!manifestPath) {
    return null;
  }

  const manifestContent = await readFile(manifestPath, "utf-8");
  const parsedManifest = JSON.parse(manifestContent);
  if (isGeneratedOutputManifest(parsedManifest)) {
    return parsedManifest;
  }

  if (isLegacyGeneratedOutputManifest(parsedManifest)) {
    return convertLegacyGeneratedOutputManifest(parsedManifest);
  }

  throw new Error(`Invalid generated output manifest: ${manifestPath}`);
}
