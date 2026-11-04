import { existsSync, type Stats } from "fs";
import { lstat, mkdir, readdir, readlink, rename, rm, symlink } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";

import type { IGeneratedOutputManifest } from "./generatedOutputUtils";
import type { IBootstrapTarget } from "./harnessBuild";
import { getErrorCode } from "./getErrorCode";

type IHomeBootstrapTarget = Extract<IBootstrapTarget, { kind: "home" }>;

export type IHomeApplyResult = {
  linked: string[];
  relinked: string[];
  backedUp: Array<{ name: string; backupPath: string }>;
  removed: string[];
};

async function lstatOrNull(path: string): Promise<Stats | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isInsideDirectory(path: string, directoryPath: string): boolean {
  const relativePath = relative(directoryPath, path);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

// Top-level entries the build generated for one harness output directory, read from
// the manifest so leftovers that a harness wrote into `.output/` are never linked.
export function getManagedEntryNames(
  manifest: IGeneratedOutputManifest,
  outputDir: string,
  harnessOutputDir: string,
): string[] {
  const prefix = `${relative(outputDir, harnessOutputDir).replaceAll("\\", "/")}/`;
  const names = new Set<string>();
  for (const path of [...Object.keys(manifest.entries), ...(manifest.syncedFilePaths ?? [])]) {
    if (!path.startsWith(prefix)) {
      continue;
    }
    const name = path.slice(prefix.length).split("/")[0];
    if (name !== undefined && name.length > 0) {
      names.add(name);
    }
  }
  return [...names].sort();
}

async function assertHomeDirectory(homePath: string): Promise<void> {
  const homeStats = await lstatOrNull(homePath);
  if (homeStats === null) {
    await mkdir(homePath, { recursive: true });
    return;
  }

  if (homeStats.isSymbolicLink()) {
    throw new Error(
      `${homePath} is a symlink to ${await readlink(homePath)}. Harness homes are real directories that keep runtime state outside the registry; move the state it points at into a real directory at ${homePath}, then rerun bootstrap.`,
    );
  }

  if (!homeStats.isDirectory()) {
    throw new Error(`${homePath} exists but is not a directory.`);
  }
}

async function linkManagedEntries(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  backupSuffix: string,
  result: IHomeApplyResult,
): Promise<void> {
  for (const name of managedEntryNames) {
    const sourceEntryPath = join(target.sourcePath, name);
    const homeEntryPath = join(target.targetPath, name);
    const homeEntryStats = await lstatOrNull(homeEntryPath);

    if (homeEntryStats === null) {
      await symlink(sourceEntryPath, homeEntryPath);
      result.linked.push(name);
      continue;
    }

    if (homeEntryStats.isSymbolicLink()) {
      if ((await readlink(homeEntryPath)) === sourceEntryPath) {
        continue;
      }
      await rm(homeEntryPath, { force: true });
      await symlink(sourceEntryPath, homeEntryPath);
      result.relinked.push(name);
      continue;
    }

    const backupPath = `${homeEntryPath}.backup-${backupSuffix}`;
    await rename(homeEntryPath, backupPath);
    await symlink(sourceEntryPath, homeEntryPath);
    result.backedUp.push({ name, backupPath });
  }
}

// Removes links this bootstrap created earlier whose target is gone because the
// build stopped generating the managed entry.
async function removeStaleLinks(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  result: IHomeApplyResult,
): Promise<void> {
  const homeEntries = await readdir(target.targetPath, { withFileTypes: true });
  for (const homeEntry of homeEntries) {
    if (!homeEntry.isSymbolicLink() || managedEntryNames.includes(homeEntry.name)) {
      continue;
    }

    const homeEntryPath = join(target.targetPath, homeEntry.name);
    const linkTargetPath = resolve(target.targetPath, await readlink(homeEntryPath));
    if (isInsideDirectory(linkTargetPath, target.sourcePath) && !existsSync(linkTargetPath)) {
      await rm(homeEntryPath, { force: true });
      result.removed.push(homeEntry.name);
    }
  }
}

export async function applyHomeTarget(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  backupSuffix: string,
): Promise<IHomeApplyResult> {
  if (managedEntryNames.length === 0) {
    throw new Error(
      `The generated output manifest records no entries for ${target.sourcePath}. Rebuild before bootstrapping.`,
    );
  }

  const result: IHomeApplyResult = { linked: [], relinked: [], backedUp: [], removed: [] };
  await assertHomeDirectory(target.targetPath);
  await linkManagedEntries(target, managedEntryNames, backupSuffix, result);
  await removeStaleLinks(target, managedEntryNames, result);
  return result;
}
