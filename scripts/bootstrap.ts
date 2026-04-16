import { $ } from "bun";
import { lstat, mkdir, readlink, realpath, rename, symlink } from "fs/promises";
import { homedir } from "os";
import { dirname, join, resolve } from "path";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const OUTPUT_DIR = join(REGISTRY_DIR, ".output");

type IBootstrapTarget = {
  name: string;
  envName: string;
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

function getBuildTargets(): string {
  const configuredTargets = (process.env.RULESYNC_TARGETS || "")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);

  if (configuredTargets.includes("*")) {
    return "*";
  }

  return Array.from(new Set([...configuredTargets, "opencode", "agentsmd"])).join(",");
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
      name: "opencode",
      envName: "OPENCODE_CONFIG_DIR",
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

async function main(): Promise<void> {
  console.log("🚀 Bootstrapping ai-registry...\n");

  const buildTargets = getBuildTargets();

  console.log("Installing dependencies...");
  await $`bun install`.cwd(REGISTRY_DIR);

  console.log("Building generated outputs...");
  await $`bun run build`
    .cwd(REGISTRY_DIR)
    .env({
      ...process.env,
      RULESYNC_TARGETS: buildTargets,
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

  console.log("\nReady.");
  console.log(`OpenCode now reads from: ${bootstrapTargets[0].targetPath}`);
  console.log("Override the target with OPENCODE_CONFIG_DIR if needed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
