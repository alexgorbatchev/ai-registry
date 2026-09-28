import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import { Glob } from "bun";
import { globby } from "globby";

export type IDiscoveredProfile = {
  profileName: string;
  profileDir: string;
  isOverlay: boolean;
};

export type IResolvedMatchedAssets = {
  matchedNames: string[];
  sourcePaths: Record<string, string>;
  userSkillNames?: Set<string>;
};

type IGroupedAssetEntry = {
  name: string;
  groupPath: string;
  sourcePath: string;
  isUser: boolean;
};

function isGroupedDirectory(targetDir: string): boolean {
  if (!existsSync(targetDir)) return false;
  return existsSync(join(targetDir, "agent")) || existsSync(join(targetDir, "user"));
}

async function collectGroupedAssets(targetDir: string): Promise<Map<string, IGroupedAssetEntry>> {
  const assetMap = new Map<string, IGroupedAssetEntry>();
  if (!existsSync(targetDir)) {
    return assetMap;
  }

  const agentDir = join(targetDir, "agent");
  const userDir = join(targetDir, "user");

  if (existsSync(agentDir)) {
    const entries = await readdir(agentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      assetMap.set(entry.name, {
        name: entry.name,
        groupPath: `agent/${entry.name}`,
        sourcePath: join(agentDir, entry.name),
        isUser: false,
      });
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
      assetMap.set(entry.name, {
        name: entry.name,
        groupPath: `user/${entry.name}`,
        sourcePath: join(userDir, entry.name),
        isUser: true,
      });
    }
  }

  const rootEntries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name === "agent" || entry.name === "user" || entry.name.startsWith(".")) continue;
    if (assetMap.has(entry.name)) continue;
    assetMap.set(entry.name, {
      name: entry.name,
      groupPath: entry.name,
      sourcePath: join(targetDir, entry.name),
      isUser: false,
    });
  }

  return assetMap;
}

async function collectFlatAssets(targetDir: string): Promise<Map<string, IGroupedAssetEntry>> {
  const assetMap = new Map<string, IGroupedAssetEntry>();
  if (!existsSync(targetDir)) {
    return assetMap;
  }

  const rootEntries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name.startsWith(".")) continue;
    assetMap.set(entry.name, {
      name: entry.name,
      groupPath: entry.name,
      sourcePath: join(targetDir, entry.name),
      isUser: false,
    });
  }

  return assetMap;
}

function matchesAssetPatterns(
  name: string,
  groupPath: string,
  patterns: string[],
): boolean {
  let isMatched = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      const negativeGlob = new Glob(pattern.slice(1));
      if (negativeGlob.match(name) || negativeGlob.match(groupPath)) {
        isMatched = false;
      }
    } else {
      const positiveGlob = new Glob(pattern);
      if (positiveGlob.match(name) || positiveGlob.match(groupPath)) {
        isMatched = true;
      }
    }
  }
  return isMatched;
}

async function resolveGlobs(patterns: string[], cwd: string): Promise<string[]> {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return [];
  const matches = await globby(patterns, {
    cwd,
    onlyFiles: false,
    markDirectories: false,
    expandDirectories: false,
  });
  return matches;
}

export async function discoverProfiles(
  baseProfilesDir: string,
  overlayProfilesDir?: string | null,
): Promise<IDiscoveredProfile[]> {
  const profileMap = new Map<string, IDiscoveredProfile>();

  if (existsSync(baseProfilesDir)) {
    const baseEntries = await readdir(baseProfilesDir, { withFileTypes: true });
    for (const entry of baseEntries) {
      if (!entry.isDirectory()) continue;
      const profileName = entry.name;
      const profileDir = join(baseProfilesDir, profileName);
      if (existsSync(join(profileDir, "profile.json")) || existsSync(join(profileDir, "profile.yaml"))) {
        profileMap.set(profileName, { profileName, profileDir, isOverlay: false });
      }
    }
  }

  if (overlayProfilesDir && existsSync(overlayProfilesDir)) {
    const overlayEntries = await readdir(overlayProfilesDir, { withFileTypes: true });
    for (const entry of overlayEntries) {
      if (!entry.isDirectory()) continue;
      const profileName = entry.name;
      const profileDir = join(overlayProfilesDir, profileName);
      if (existsSync(join(profileDir, "profile.json")) || existsSync(join(profileDir, "profile.yaml"))) {
        profileMap.set(profileName, { profileName, profileDir, isOverlay: true });
      }
    }
  }

  return Array.from(profileMap.values()).sort((left, right) => left.profileName.localeCompare(right.profileName));
}

export async function resolveMatchedAssets(
  patterns: string[],
  baseDir: string,
  overlayDir?: string | null,
): Promise<IResolvedMatchedAssets> {
  if (!patterns || patterns.length === 0) {
    return {
      matchedNames: [],
      sourcePaths: {},
      userSkillNames: new Set<string>(),
    };
  }

  const hasOverlay = Boolean(overlayDir && existsSync(overlayDir));
  const isGrouped = isGroupedDirectory(baseDir) || (hasOverlay && overlayDir ? isGroupedDirectory(overlayDir) : false);

  if (isGrouped) {
    const baseAssets = isGroupedDirectory(baseDir)
      ? await collectGroupedAssets(baseDir)
      : await collectFlatAssets(baseDir);

    const overlayAssets = hasOverlay && overlayDir
      ? (isGroupedDirectory(overlayDir)
          ? await collectGroupedAssets(overlayDir)
          : await collectFlatAssets(overlayDir))
      : new Map<string, IGroupedAssetEntry>();

    const mergedAssets = new Map<string, IGroupedAssetEntry>(baseAssets);
    for (const [name, entry] of overlayAssets) {
      mergedAssets.set(name, entry);
    }

    const sourcePaths: Record<string, string> = {};
    const userSkillNames = new Set<string>();

    for (const entry of mergedAssets.values()) {
      if (matchesAssetPatterns(entry.name, entry.groupPath, patterns)) {
        sourcePaths[entry.name] = entry.sourcePath;
        if (entry.isUser) {
          userSkillNames.add(entry.name);
        }
      }
    }

    const matchedNames = Object.keys(sourcePaths).sort((left, right) => left.localeCompare(right));

    return {
      matchedNames,
      sourcePaths,
      userSkillNames,
    };
  }

  const baseMatches = existsSync(baseDir) ? await resolveGlobs(patterns, baseDir) : [];

  const overlayMatches = hasOverlay && overlayDir ? await resolveGlobs(patterns, overlayDir) : [];

  const sourcePaths: Record<string, string> = {};

  for (const name of baseMatches) {
    sourcePaths[name] = join(baseDir, name);
  }

  if (hasOverlay && overlayDir) {
    for (const name of overlayMatches) {
      sourcePaths[name] = join(overlayDir, name);
    }
  }

  const matchedNames = Object.keys(sourcePaths).sort((left, right) => left.localeCompare(right));

  return {
    matchedNames,
    sourcePaths,
    userSkillNames: new Set<string>(),
  };
}
