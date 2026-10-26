import { existsSync, type Stats } from "fs";
import { lstat, mkdir, readdir, readlink, rename, rm, symlink } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";

import type { IGeneratedOutputManifest } from "./generatedOutputUtils";
import type { IBootstrapTarget } from "./harnessBuild";
import { getErrorCode } from "./getErrorCode";

type IHomeBootstrapTarget = Extract<IBootstrapTarget, { kind: "home" }>;

// Backups bootstrap itself leaves beside a replaced entry; they are not runtime state.
const BOOTSTRAP_BACKUP_PATTERN = /\.backup-\d{8}T\d{6}Z$/;

export type IHomeApplyResult = {
  linked: string[];
  relinked: string[];
  backedUp: Array<{ name: string; backupPath: string }>;
  removed: string[];
  shared: string[];
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

// Top-level entries the build generated for one profile directory, read from the
// manifest so leftovers that a harness wrote into `.output/` are never linked.
export function getManagedEntryNames(
  manifest: IGeneratedOutputManifest,
  outputDir: string,
  profileOutputDir: string,
): string[] {
  const prefix = `${relative(outputDir, profileOutputDir).replaceAll("\\", "/")}/`;
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

// Removes links this bootstrap created earlier whose target is gone: a managed
// entry the build stopped generating, or a shared runtime entry the harness deleted.
async function removeStaleLinks(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  result: IHomeApplyResult,
): Promise<void> {
  const ownedDirectories = [target.sourcePath, ...(target.sharedHomePath === undefined ? [] : [target.sharedHomePath])];
  const homeEntries = await readdir(target.targetPath, { withFileTypes: true });
  for (const homeEntry of homeEntries) {
    if (!homeEntry.isSymbolicLink() || managedEntryNames.includes(homeEntry.name)) {
      continue;
    }

    const homeEntryPath = join(target.targetPath, homeEntry.name);
    const linkTargetPath = resolve(target.targetPath, await readlink(homeEntryPath));
    const isOwnedLink = ownedDirectories.some((directoryPath) => isInsideDirectory(linkTargetPath, directoryPath));
    if (isOwnedLink && !existsSync(linkTargetPath)) {
      await rm(homeEntryPath, { force: true });
      result.removed.push(homeEntry.name);
    }
  }
}

// A non-default profile shares the runtime state of the default home: every real
// entry there that the profile neither manages nor already holds is linked in,
// except the backups bootstrap made of replaced entries.
async function shareRuntimeEntries(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  result: IHomeApplyResult,
): Promise<void> {
  if (target.sharedHomePath === undefined || !existsSync(target.sharedHomePath)) {
    return;
  }

  const sharedEntries = await readdir(target.sharedHomePath, { withFileTypes: true });
  for (const sharedEntry of sharedEntries) {
    if (
      sharedEntry.isSymbolicLink() ||
      managedEntryNames.includes(sharedEntry.name) ||
      BOOTSTRAP_BACKUP_PATTERN.test(sharedEntry.name)
    ) {
      continue;
    }

    const homeEntryPath = join(target.targetPath, sharedEntry.name);
    if ((await lstatOrNull(homeEntryPath)) !== null) {
      continue;
    }

    await symlink(join(target.sharedHomePath, sharedEntry.name), homeEntryPath);
    result.shared.push(sharedEntry.name);
  }
}

export async function applyHomeTarget(
  target: IHomeBootstrapTarget,
  managedEntryNames: readonly string[],
  backupSuffix: string,
): Promise<IHomeApplyResult> {
  if (managedEntryNames.length === 0) {
    throw new Error(`The generated output manifest records no entries for ${target.sourcePath}. Rebuild before bootstrapping.`);
  }

  const result: IHomeApplyResult = { linked: [], relinked: [], backedUp: [], removed: [], shared: [] };
  await assertHomeDirectory(target.targetPath);
  await linkManagedEntries(target, managedEntryNames, backupSuffix, result);
  await removeStaleLinks(target, managedEntryNames, result);
  await shareRuntimeEntries(target, managedEntryNames, result);
  return result;
}
