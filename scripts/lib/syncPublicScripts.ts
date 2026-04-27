import { lstat, mkdir, readdir, readlink, realpath, rename, rm, symlink } from "fs/promises";
import { dirname, resolve, join } from "path";

const PUBLIC_SCRIPT_PREFIXES = ["air-", "pi-"];

export type IPublicScriptLinkResult =
  | { action: "linked"; scriptName: string }
  | { action: "unchanged"; scriptName: string }
  | { action: "relinked"; scriptName: string }
  | { action: "backed_up"; scriptName: string; backupPath: string };

export interface ISyncPublicScriptsOptions {
  binDir: string;
  getTimestamp?: () => string;
  scriptsDir: string;
}

export interface ISyncPublicScriptsResult {
  cleanedBrokenLinks: string[];
  linkedScripts: IPublicScriptLinkResult[];
}

function defaultGetTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const { code } = error;
  return typeof code === "string" ? code : null;
}

function getBackupPath(targetPath: string, getTimestamp: () => string): string {
  return `${targetPath}.backup-${getTimestamp()}`;
}

function isPublicScriptName(fileName: string): boolean {
  return PUBLIC_SCRIPT_PREFIXES.some(prefix => fileName.startsWith(prefix));
}

async function listPublicScriptNames(scriptsDir: string): Promise<string[]> {
  const entries = await readdir(scriptsDir, { withFileTypes: true });

  return entries
    .filter((entry) => isPublicScriptName(entry.name) && (entry.isFile() || entry.isSymbolicLink()))
    .map((entry) => entry.name)
    .sort();
}

async function resolveRealPathOrSelf(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return targetPath;
    }

    throw error;
  }
}

async function resolveSymlinkTarget(targetPath: string): Promise<string> {
  const linkPath = await readlink(targetPath);
  const absoluteLinkPath = resolve(dirname(targetPath), linkPath);

  try {
    return await realpath(absoluteLinkPath);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return absoluteLinkPath;
    }

    throw error;
  }
}

async function cleanupBrokenPublicSymlinks(binDir: string): Promise<string[]> {
  const entries = await readdir(binDir, { withFileTypes: true });
  const cleanedBrokenLinks: string[] = [];

  for (const entry of entries) {
    if (!isPublicScriptName(entry.name) || !entry.isSymbolicLink()) {
      continue;
    }

    const targetPath = resolve(binDir, entry.name);

    try {
      await realpath(targetPath);
    } catch (error) {
      if (getErrorCode(error) !== "ENOENT") {
        throw error;
      }

      await rm(targetPath, { force: true });
      cleanedBrokenLinks.push(entry.name);
    }
  }

  return cleanedBrokenLinks.sort();
}

async function applyPublicScriptLink(
  scriptName: string,
  scriptsDir: string,
  binDir: string,
  getTimestamp: () => string,
): Promise<IPublicScriptLinkResult> {
  const sourcePath = resolve(scriptsDir, scriptName);
  const targetPath = resolve(binDir, scriptName);

  try {
    const targetStats = await lstat(targetPath);
    if (targetStats.isSymbolicLink()) {
      const [resolvedTargetPath, resolvedSourcePath] = await Promise.all([
        resolveSymlinkTarget(targetPath),
        resolveRealPathOrSelf(sourcePath),
      ]);

      if (resolvedTargetPath === resolvedSourcePath) {
        return { action: "unchanged", scriptName };
      }

      await rm(targetPath, { force: true });
      await symlink(sourcePath, targetPath);
      return { action: "relinked", scriptName };
    }

    const backupPath = getBackupPath(targetPath, getTimestamp);
    await rename(targetPath, backupPath);
    await symlink(sourcePath, targetPath);
    return { action: "backed_up", backupPath, scriptName };
  } catch (error) {
    if (getErrorCode(error) !== "ENOENT") {
      throw error;
    }
  }

  await symlink(sourcePath, targetPath);
  return { action: "linked", scriptName };
}

export async function syncPublicScripts(options: ISyncPublicScriptsOptions): Promise<ISyncPublicScriptsResult> {
  const getTimestamp = options.getTimestamp ?? defaultGetTimestamp;

  await mkdir(options.binDir, { recursive: true });

  const cleanedBrokenLinks = await cleanupBrokenPublicSymlinks(options.binDir);
  
  // Link air and pi scripts from .output/bin
  const outputBinDir = join(options.scriptsDir, "..", ".output", "bin");
  const binScriptNames = await readdir(outputBinDir).catch(() => []);
  binScriptNames.sort();
  const airScriptNames = binScriptNames.filter(n => n.startsWith("air-"));
  const piScriptNames = binScriptNames.filter(n => n.startsWith("pi-"));
  
  const linkedScripts: IPublicScriptLinkResult[] = [];

  for (const scriptName of airScriptNames) {
    linkedScripts.push(await applyPublicScriptLink(scriptName, outputBinDir, options.binDir, getTimestamp));
  }
  
  for (const scriptName of piScriptNames) {
    linkedScripts.push(await applyPublicScriptLink(scriptName, outputBinDir, options.binDir, getTimestamp));
  }

  return {
    cleanedBrokenLinks,
    linkedScripts,
  };
}
