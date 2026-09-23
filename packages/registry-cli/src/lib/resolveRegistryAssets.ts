import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import { globby } from "globby";

export type IDiscoveredProfile = {
  profileName: string;
  profileDir: string;
  isOverlay: boolean;
};

export type IResolvedMatchedAssets = {
  matchedNames: string[];
  sourcePaths: Record<string, string>;
};

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
    };
  }

  const baseMatches = existsSync(baseDir) ? await resolveGlobs(patterns, baseDir) : [];

  const hasOverlay = Boolean(overlayDir && existsSync(overlayDir));
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
  };
}
