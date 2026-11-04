import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";

import type { IAssetEntry } from "./userSkillUtils";

export type IResolvedRegistryAssets = {
  names: string[];
  sourcePaths: Record<string, string>;
  userSkillNames: Set<string>;
  conflicts: IRegistryAssetConflict[];
};

type IRegistryAssetConflict = {
  name: string;
  previousSource: string;
  selectedSource: string;
};

function isGroupedDirectory(targetDir: string): boolean {
  if (!existsSync(targetDir)) return false;
  return existsSync(join(targetDir, "agent")) || existsSync(join(targetDir, "user"));
}

async function collectGroupedAssets(targetDir: string): Promise<Map<string, IAssetEntry>> {
  const assetMap = new Map<string, IAssetEntry>();
  const agentDir = join(targetDir, "agent");
  const userDir = join(targetDir, "user");

  if (existsSync(agentDir)) {
    const entries = await readdir(agentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      assetMap.set(entry.name, { name: entry.name, sourcePath: join(agentDir, entry.name), isUser: false });
    }
  }

  if (existsSync(userDir)) {
    const entries = await readdir(userDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (assetMap.has(entry.name)) {
        throw new Error(
          `Duplicate skill name "${entry.name}" found in both agent and user skills directories in ${targetDir}`,
        );
      }
      assetMap.set(entry.name, { name: entry.name, sourcePath: join(userDir, entry.name), isUser: true });
    }
  }

  const rootEntries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "agent" || entry.name === "user" || entry.name.startsWith(".")) continue;
    if (assetMap.has(entry.name)) continue;
    assetMap.set(entry.name, { name: entry.name, sourcePath: join(targetDir, entry.name), isUser: false });
  }

  return assetMap;
}

// Top-level entries of an ungrouped directory. Skill bundles are directories;
// commands are files, so files count only when no source directory is grouped.
async function collectFlatAssets(targetDir: string, includeFiles: boolean): Promise<Map<string, IAssetEntry>> {
  const assetMap = new Map<string, IAssetEntry>();
  const rootEntries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory() && !(includeFiles && entry.isFile())) continue;
    assetMap.set(entry.name, { name: entry.name, sourcePath: join(targetDir, entry.name), isUser: false });
  }

  return assetMap;
}

// Collects every asset in the base directory and the overlay directories. A later
// directory replaces the whole asset of an earlier one on a name collision.
export async function resolveRegistryAssets(
  baseDir: string,
  overlayDirs: string[] = [],
): Promise<IResolvedRegistryAssets> {
  const sourceDirs = [baseDir, ...overlayDirs].filter((directory) => existsSync(directory));
  const isGrouped = sourceDirs.some(isGroupedDirectory);
  const conflicts: IRegistryAssetConflict[] = [];
  const mergedAssets = new Map<string, IAssetEntry>();

  for (const directory of sourceDirs) {
    const assets = isGroupedDirectory(directory)
      ? await collectGroupedAssets(directory)
      : await collectFlatAssets(directory, !isGrouped);
    for (const [name, entry] of assets) {
      const previous = mergedAssets.get(name);
      if (previous && previous.sourcePath !== entry.sourcePath) {
        conflicts.push({ name, previousSource: previous.sourcePath, selectedSource: entry.sourcePath });
      }
      mergedAssets.set(name, entry);
    }
  }

  const sourcePaths: Record<string, string> = {};
  const userSkillNames = new Set<string>();
  for (const entry of mergedAssets.values()) {
    sourcePaths[entry.name] = entry.sourcePath;
    if (entry.isUser) {
      userSkillNames.add(entry.name);
    }
  }

  return {
    names: Object.keys(sourcePaths).sort((left, right) => left.localeCompare(right)),
    sourcePaths,
    userSkillNames,
    conflicts,
  };
}
