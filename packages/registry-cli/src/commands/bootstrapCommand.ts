import { homedir } from "os";
import { join, relative } from "path";
import { parseArgs } from "node:util";

import { applyEntriesTarget, type IEntriesApplyResult } from "../lib/applyEntriesTarget";
import { applyLinkTarget, type ILinkApplyResult } from "../lib/applyLinkTarget";
import { getLinkedWorktreePrimaryCheckout } from "../lib/getLinkedWorktreePrimaryCheckout";
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
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
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

function printEntriesTargetResult(target: IBootstrapTarget, result: IEntriesApplyResult): void {
  const hasChanges = result.added.length + result.updated.length + result.removed.length > 0;
  console.log(`  ${hasChanges ? "applied" : "reused"} ${target.description}: ${target.targetPath}`);
  if (result.added.length > 0) console.log(`    added: ${result.added.join(", ")}`);
  if (result.updated.length > 0) console.log(`    updated: ${result.updated.join(", ")}`);
  if (result.removed.length > 0) console.log(`    removed: ${result.removed.join(", ")}`);
  for (const name of result.replacedExternalEdits) {
    console.warn(`    ⚠️ replaced ${name}: it changed outside the registry since the last bootstrap`);
  }
  for (const name of result.keptExternalEdits) {
    console.warn(`    ⚠️ kept ${name}: the registry no longer declares it, but it changed outside the registry`);
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

export async function bootstrapCommand(
  dependencies: IBootstrapDependencies = createDefaultDependencies(),
): Promise<void> {
  const { root, overlays, output } = dependencies.registryPaths;
  // Harness homes are machine-wide and link into the bootstrapped checkout's output. A
  // linked worktree's output disappears with the worktree, so only the primary checkout
  // may own them.
  const primaryCheckout = await getLinkedWorktreePrimaryCheckout(root);
  if (primaryCheckout !== null) {
    throw new Error(
      `Bootstrap links this machine's harness homes to the checkout it runs in, so it runs only from the primary checkout ${primaryCheckout}, not the linked worktree ${root}. Use \`just build\` to verify changes in a worktree.`,
    );
  }

  console.log("🚀 Bootstrapping ai-registry...\n");
  for (const overlay of overlays) {
    console.log(`📦 Using overlay: ${overlay}\n`);
  }

  console.log("Installing dependencies and Git hooks...");
  await runCommand({
    cmd: ["just", "setup"],
    cwd: root,
    description: "install dependencies and Git hooks",
    spawn: dependencies.spawn,
  });

  console.log("Building generated outputs...");
  await runCommand({
    cmd: hasAutoConfirmFlag(dependencies.argv) ? ["just", "build", "-y"] : ["just", "build"],
    cwd: root,
    description: "build generated outputs",
    spawn: dependencies.spawn,
    failureHint:
      "Generated edits are recovered automatically when safe. Resolve any reported source conflict, unsupported recovery, or save failure before retrying; -y does not discard edits.",
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
    if (target.kind === "entries") {
      const statePath = join(
        dependencies.registryPaths.state,
        "bootstrap",
        `${relative(output, target.sourcePath)}.json`,
      );
      printEntriesTargetResult(target, await applyEntriesTarget(target, statePath));
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
  for (const overlay of overlays) {
    console.log(`Overlay merged: ${overlay}`);
  }
  for (const target of bootstrapTargets) {
    const verb = target.kind === "entries" ? "are written to" : "now reads from";
    console.log(`${target.description} ${verb}: ${target.targetPath}`);
  }
  console.log(`Repo-local air-*, claude-*, codex-*, and pi-* commands are linked into: ${dependencies.publicBinDir}`);
  console.log(
    "Override the targets with OPENCODE_CONFIG_DIR, CODEX_HOME, PI_CODING_AGENT_DIR, and CLAUDE_CONFIG_DIR if needed.",
  );
}
