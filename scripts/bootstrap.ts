import { lstat, mkdir, readlink, realpath, rename, symlink } from "fs/promises";
import { homedir } from "os";
import { dirname, join, resolve } from "path";

import { getErrorMessage } from "./lib/getErrorMessage";
import { runCommand } from "./lib/runCommand";
import { syncPublicScripts, type ISyncPublicScriptsResult } from "./lib/syncPublicScripts";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const OUTPUT_DIR = join(REGISTRY_DIR, ".output");
const PUBLIC_BIN_DIR = join(homedir(), ".local", "bin");
const SCRIPTS_DIR = join(REGISTRY_DIR, "scripts");

type IBootstrapTarget = {
  sourcePath: string;
  targetPath: string;
  description: string;
};

type IApplyResult =
  | { action: "linked" }
  | { action: "unchanged" }
  | { action: "backed_up"; backupPath: string };

function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function hasAutoConfirmFlag(): boolean {
  return process.argv.includes("-y") || process.argv.includes("--yes");
}

function getBackupPath(targetPath: string): string {
  return `${targetPath}.backup-${getTimestamp()}`;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const { code } = error;
  return typeof code === "string" ? code : null;
}

async function resolveSymlinkTarget(targetPath: string): Promise<string> {
  const linkPath = await readlink(targetPath);
  const absoluteLinkPath = resolve(dirname(targetPath), linkPath);

  try {
    return await realpath(absoluteLinkPath);
  } catch (error) {
    return absoluteLinkPath;
  }
}

async function resolveRealPathOrSelf(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    return targetPath;
  }
}

function getBootstrapTargets(): IBootstrapTarget[] {
  return [
    {
      sourcePath: join(OUTPUT_DIR, "opencode"),
      targetPath: process.env.OPENCODE_CONFIG_DIR?.trim() || join(getConfigHome(), "opencode"),
      description: "OpenCode config",
    },
  ];
}

async function applyTarget(target: IBootstrapTarget): Promise<IApplyResult> {
  await mkdir(dirname(target.targetPath), { recursive: true });

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
    }

    const backupPath = getBackupPath(target.targetPath);
    await rename(target.targetPath, backupPath);
    await symlink(target.sourcePath, target.targetPath, "dir");
    return { action: "backed_up", backupPath };
  } catch (error) {
    const errorCode = getErrorCode(error);
    if (errorCode !== "ENOENT") {
      throw error;
    }
  }

  await symlink(target.sourcePath, target.targetPath, "dir");
  return { action: "linked" };
}

function printPublicScriptResult(binDir: string, result: ISyncPublicScriptsResult): void {
  console.log("Syncing repo-local public scripts...");

  for (const scriptName of result.cleanedBrokenLinks) {
    console.log(`  removed broken link: ${join(binDir, scriptName)}`);
  }

  for (const linkedScript of result.linkedScripts) {
    const targetPath = join(binDir, linkedScript.scriptName);
    if (linkedScript.action === "unchanged") {
      console.log(`  reused ${linkedScript.scriptName}: ${targetPath}`);
      continue;
    }

    if (linkedScript.action === "relinked") {
      console.log(`  relinked ${linkedScript.scriptName}: ${targetPath}`);
      continue;
    }

    console.log(`  linked ${linkedScript.scriptName}: ${targetPath}`);
    if (linkedScript.action === "backed_up") {
      console.log(`    backed up previous contents to: ${linkedScript.backupPath}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("🚀 Bootstrapping ai-registry...\n");

  console.log("Installing dependencies...");
  await runCommand({
    cmd: ["bun", "install"],
    cwd: REGISTRY_DIR,
    description: "install dependencies",
  });

  console.log("Building generated outputs...");
  await runCommand({
    cmd: hasAutoConfirmFlag() ? ["bun", "run", "build", "--", "-y"] : ["bun", "run", "build"],
    cwd: REGISTRY_DIR,
    description: "build generated outputs",
    failureHint: "If generated outputs drifted and you want to overwrite them, rerun `bun bootstrap -- -y`.",
  });

  const bootstrapTargets = getBootstrapTargets();

  console.log("Applying generated outputs...");
  for (const target of bootstrapTargets) {
    const result = await applyTarget(target);
    if (result.action === "unchanged") {
      console.log(`  reused ${target.description}: ${target.targetPath}`);
      continue;
    }

    console.log(`  linked ${target.description}: ${target.targetPath}`);
    if (result.action === "backed_up") {
      console.log(`    backed up previous contents to: ${result.backupPath}`);
    }
  }

  const publicScriptResult = await syncPublicScripts({
    binDir: PUBLIC_BIN_DIR,
    scriptsDir: SCRIPTS_DIR,
  });
  printPublicScriptResult(PUBLIC_BIN_DIR, publicScriptResult);

  console.log("\nReady.");
  console.log(`OpenCode now reads from: ${bootstrapTargets[0].targetPath}`);
  console.log(`Repo-local air-* commands are linked into: ${PUBLIC_BIN_DIR}`);
  console.log("Override the target with OPENCODE_CONFIG_DIR if needed.");
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
