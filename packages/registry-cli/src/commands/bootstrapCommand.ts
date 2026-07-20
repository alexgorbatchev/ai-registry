import { lstat, mkdir, readlink, realpath, rename, symlink } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

import { runCommand } from "../lib/runCommand";
import { syncPublicScripts, type ISyncPublicScriptsResult } from "../lib/syncPublicScripts";
import { getRegistryPaths } from "../lib/getRegistryPaths";

// We import the static harness plugins to retrieve their bootstrap targets
import codexPlugin from "../harnesses/codex/build";
import opencodePlugin from "../harnesses/opencode/build";
import piPlugin from "../harnesses/pi/build";

const PUBLIC_BIN_DIR = join(homedir(), ".local", "bin");

type IBootstrapTarget = {
  sourcePath: string;
  targetPath: string;
  description: string;
};

type IApplyResult =
  | { action: "linked" }
  | { action: "unchanged" }
  | { action: "backed_up"; backupPath: string };

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
  const absoluteLinkPath = join(dirname(targetPath), linkPath);
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

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  const targets: IBootstrapTarget[] = [];
  const plugins = [codexPlugin, opencodePlugin, piPlugin];

  for (const plugin of plugins) {
    if (plugin.getBootstrapTargets) {
      const pluginTargets = await plugin.getBootstrapTargets(outputDir);
      targets.push(...pluginTargets);
    }
  }
  return targets;
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

export async function bootstrapCommand(): Promise<void> {
  const { root, output } = getRegistryPaths();
  console.log("🚀 Bootstrapping ai-registry...\n");

  console.log("Installing dependencies...");
  await runCommand({
    cmd: ["bun", "install"],
    cwd: root,
    description: "install dependencies",
  });

  console.log("Building generated outputs...");
  await runCommand({
    cmd: hasAutoConfirmFlag() ? ["bun", "run", "build", "--", "-y"] : ["bun", "run", "build"],
    cwd: root,
    description: "build generated outputs",
    failureHint: "If generated outputs drifted and you want to overwrite them, rerun `bun bootstrap -- -y`.",
  });

  const bootstrapTargets = await getBootstrapTargets(output);

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

  // we pass the outputDir because public scripts are generated in .output/bin now
  const publicScriptResult = await syncPublicScripts({
    binDir: PUBLIC_BIN_DIR,
    repositoryRoot: root, // not actually used for the source in the function, it computes .output/bin inside
  });
  printPublicScriptResult(PUBLIC_BIN_DIR, publicScriptResult);

  console.log("\nReady.");
  for (const target of bootstrapTargets) {
    console.log(`${target.description} now reads from: ${target.targetPath}`);
  }
  console.log(`Repo-local air-*, codex, codex-*, pi, and pi-* commands are linked into: ${PUBLIC_BIN_DIR}`);
  console.log("Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, and PI_CODING_AGENT_DIR if needed.");
}
