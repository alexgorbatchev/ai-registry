import { lstat, mkdir, readlink, realpath, rename, rm, symlink } from "fs/promises";
import { dirname, resolve } from "path";

import type { IBootstrapTarget } from "./harnessBuild";
import { getErrorCode } from "./getErrorCode";

type ILinkBootstrapTarget = Extract<IBootstrapTarget, { kind: "link" }>;

export type ILinkApplyResult =
  | { action: "linked" }
  | { action: "relinked" }
  | { action: "unchanged" }
  | { action: "backed_up"; backupPath: string };

async function resolveSymlinkTarget(targetPath: string): Promise<string> {
  const absoluteLinkPath = resolve(dirname(targetPath), await readlink(targetPath));
  try {
    return await realpath(absoluteLinkPath);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return absoluteLinkPath;
    }
    throw error;
  }
}

async function getSymlinkType(sourcePath: string): Promise<"dir" | "file"> {
  try {
    const stat = await lstat(sourcePath);
    return stat.isDirectory() ? "dir" : "file";
  } catch (error) {
    return "dir";
  }
}

async function resolveRealPathOrSelf(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    return targetPath;
  }
}

// Replaces one path with a symlink to its generated source, keeping anything that
// was there before as a timestamped backup.
export async function applyLinkTarget(target: ILinkBootstrapTarget, backupSuffix: string): Promise<ILinkApplyResult> {
  await mkdir(dirname(target.targetPath), { recursive: true });
  const symlinkType = await getSymlinkType(target.sourcePath);
  try {
    const targetStats = await lstat(target.targetPath);
    if (targetStats.isSymbolicLink()) {
      const [resolvedTargetPath, resolvedSourcePath] = await Promise.all([
        resolveSymlinkTarget(target.targetPath),
        resolveRealPathOrSelf(target.sourcePath),
      ]);
      if (resolvedTargetPath === resolvedSourcePath) {
        return { action: "unchanged" };
      }

      await rm(target.targetPath, { force: true });
      await symlink(target.sourcePath, target.targetPath, symlinkType);
      return { action: "relinked" };
    }

    const backupPath = `${target.targetPath}.backup-${backupSuffix}`;
    await rename(target.targetPath, backupPath);
    await symlink(target.sourcePath, target.targetPath, symlinkType);
    return { action: "backed_up", backupPath };
  } catch (error) {
    if (getErrorCode(error) !== "ENOENT") {
      throw error;
    }
  }
  await symlink(target.sourcePath, target.targetPath, symlinkType);
  return { action: "linked" };
}
