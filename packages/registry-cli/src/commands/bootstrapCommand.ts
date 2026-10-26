import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "node:util";

import { applyLinkTarget, type ILinkApplyResult } from "../lib/applyLinkTarget";
import type { IBootstrapTarget, IUnifiedHarnessPlugin } from "../lib/harnessBuild";
import { applyHomeTarget, getManagedEntryNames, type IHomeApplyResult } from "../lib/homeTargetUtils";
import { readGeneratedOutputManifest } from "../lib/readGeneratedOutputManifest";
import { runCommand, type IRunCommandSpawn } from "../lib/runCommand";
import { syncPublicScripts, type ISyncPublicScriptsResult } from "../lib/syncPublicScripts";
import { getRegistryPaths, type IRegistryPaths } from "../lib/getRegistryPaths";

// We import the static harness plugins to retrieve their bootstrap targets
import claudeCodePlugin from "../harnesses/claude-code/build";
import codexPlugin from "../harnesses/codex/build";
import opencodePlugin from "../harnesses/opencode/build";
import piPlugin from "../harnesses/pi/build";

type ILinkTarget = Extract<IBootstrapTarget, { kind: "link" }>;

export type IBootstrapDependencies = {
  registryPaths: IRegistryPaths;
  argv: string[];
  plugins: IUnifiedHarnessPlugin[];
  publicBinDir: string;
  getTimestamp: () => string;
  spawn?: IRunCommandSpawn;
};

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function createDefaultDependencies(): IBootstrapDependencies {
  return {
    registryPaths: getRegistryPaths(),
    argv: process.argv,
    plugins: [claudeCodePlugin, codexPlugin, opencodePlugin, piPlugin],
    publicBinDir: join(homedir(), ".local", "bin"),
    getTimestamp,
  };
}

function hasAutoConfirmFlag(argv: string[]): boolean {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      yes: { type: "boolean", short: "y" },
    },
    strict: false,
  });
  return Boolean(values.yes);
}

async function getBootstrapTargets(plugins: IUnifiedHarnessPlugin[], outputDir: string): Promise<IBootstrapTarget[]> {
  const targets: IBootstrapTarget[] = [];

  for (const plugin of plugins) {
    if (plugin.getBootstrapTargets) {
      const pluginTargets = await plugin.getBootstrapTargets(outputDir);
      targets.push(...pluginTargets);
    }
  }
  return targets;
}

function printLinkTargetResult(target: ILinkTarget, result: ILinkApplyResult): void {
  if (result.action === "unchanged") {
    console.log(`  reused ${target.description}: ${target.targetPath}`);
    return;
  }
  if (result.action === "relinked") {
    console.log(`  relinked ${target.description}: ${target.targetPath}`);
    return;
  }
  console.log(`  linked ${target.description}: ${target.targetPath}`);
  if (result.action === "backed_up") {
    console.log(`    backed up previous contents to: ${result.backupPath}`);
  }
}

function printHomeTargetResult(target: IBootstrapTarget, result: IHomeApplyResult): void {
  console.log(`  applied ${target.description}: ${target.targetPath}`);
  if (result.linked.length > 0) {
    console.log(`    linked: ${result.linked.join(", ")}`);
  }
  if (result.relinked.length > 0) {
    console.log(`    relinked: ${result.relinked.join(", ")}`);
  }
  for (const backedUpEntry of result.backedUp) {
    console.log(`    backed up ${backedUpEntry.name} to: ${backedUpEntry.backupPath}`);
  }
  if (result.removed.length > 0) {
    console.log(`    removed stale links: ${result.removed.join(", ")}`);
  }
  if (result.shared.length > 0) {
    console.log(`    shared runtime entries: ${result.shared.join(", ")}`);
  }
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

export async function bootstrapCommand(dependencies: IBootstrapDependencies = createDefaultDependencies()): Promise<void> {
  const { root, overlay, output } = dependencies.registryPaths;
  console.log("🚀 Bootstrapping ai-registry...\n");
  if (overlay) {
    console.log(`📦 Using overlay: ${overlay}\n`);
  }

  console.log("Installing dependencies...");
  await runCommand({
    cmd: ["bun", "install"],
    cwd: root,
    description: "install dependencies",
    spawn: dependencies.spawn,
  });

  console.log("Building generated outputs...");
  await runCommand({
    cmd: hasAutoConfirmFlag(dependencies.argv) ? ["bun", "run", "build", "--", "-y"] : ["bun", "run", "build"],
    cwd: root,
    description: "build generated outputs",
    spawn: dependencies.spawn,
    failureHint: "Generated edits are recovered automatically when safe. Resolve any reported source conflict, unsupported recovery, or save failure before retrying; -y does not discard edits.",
  });

  const bootstrapTargets = await getBootstrapTargets(dependencies.plugins, output);
  const manifest = await readGeneratedOutputManifest(output);
  if (manifest === null) {
    throw new Error(`Generated output manifest is missing from ${output}. Rebuild before bootstrapping.`);
  }

  console.log("Applying generated outputs...");
  const backupSuffix = dependencies.getTimestamp();
  for (const target of bootstrapTargets) {
    if (target.kind === "link") {
      printLinkTargetResult(target, await applyLinkTarget(target, backupSuffix));
      continue;
    }

    const managedEntryNames = getManagedEntryNames(manifest, output, target.sourcePath);
    printHomeTargetResult(target, await applyHomeTarget(target, managedEntryNames, backupSuffix));
  }

  const publicScriptResult = await syncPublicScripts({
    binDir: dependencies.publicBinDir,
    getTimestamp: dependencies.getTimestamp,
    repositoryRoot: root,
  });
  printPublicScriptResult(dependencies.publicBinDir, publicScriptResult);

  console.log("\nReady.");
  if (overlay) {
    console.log(`Overlay merged: ${overlay}`);
  }
  for (const target of bootstrapTargets) {
    console.log(`${target.description} now reads from: ${target.targetPath}`);
  }
  console.log(`Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: ${dependencies.publicBinDir}`);
  console.log("Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed.");
}
