import {
  lstat,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { dirname, join, relative, sep } from "path";
import { hostname } from "node:os";
import { globby } from "globby";
import { existsSync } from "fs";

import { getRegistryPaths, type IRegistryPaths } from "../lib/getRegistryPaths";
import {
  type IBuildSupport,
  type IProfileManifest,
  type IUnifiedHarnessPlugin,
  applyTemplateVariablesToGeneratedOutput,
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
} from "../lib/harnessBuild";
import { discoverProfileLocalAssets } from "../lib/discoverProfileLocalAssets";
import { discoverProfiles, resolveMatchedAssets } from "../lib/resolveRegistryAssets";
import {
  collectGeneratedOutputEntries,
  createGeneratedOutputManifest,
  GENERATED_OUTPUT_MANIFEST_NAME,
  getGeneratedOutputDrift,
  LEGACY_GENERATED_OUTPUT_MANIFEST_NAME,
  type IGeneratedOutputDrift,
  type IGeneratedOutputManifest,
  type IGeneratedOutputManifestEntry,
  type IUnmanagedOutputPaths,
  syncManagedGeneratedOutputs,
} from "../lib/generatedOutputUtils";
import { readGeneratedOutputManifest } from "../lib/readGeneratedOutputManifest";
import { reverseTemplateContent } from "../lib/reverseTemplateContent";
import { isUserSkillPath, removeDisableModelInvocation, updateSkillName } from "../lib/userSkillUtils";
import { resolveBuildHostname } from "../lib/resolveBuildHostname";
import { parseSkillIdentity } from "../lib/resolveSkillVariant";
import { createSettingsSyncRegistry } from "../lib/settingsSync/createSettingsSyncRegistry";
import { createGitSettingsSourceRepository } from "../lib/settingsSync/createGitSettingsSourceRepository";
import {
  type ISyncSettingsFilesOptions,
  syncSettingsFiles,
  validateStagedSettingsFiles,
} from "../lib/settingsSync/syncSettingsFiles";

// Statically import harness plugins
import claudeCodePlugin from "../harnesses/claude-code/build";
import codexPlugin from "../harnesses/codex/build";
import opencodePlugin from "../harnesses/opencode/build";
import piPlugin from "../harnesses/pi/build";

const unifiedHarnessPlugins: IUnifiedHarnessPlugin[] = [claudeCodePlugin, codexPlugin, opencodePlugin, piPlugin];

function isProfileManifest(value: unknown): value is IProfileManifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function syncBackModifiedFiles(
  drift: IGeneratedOutputDrift[],
  outputDir: string,
  nextOutputDir: string,
  sourcePathByOutputPath: Map<string, string>,
  templateContext: Record<string, string>,
  previousSourcePaths: Record<string, string> = {},
  previousEntries: Record<string, IGeneratedOutputManifestEntry> = {},
  previousSourceChecksums: Record<string, string> = {},
  saveSource: (path: string, content: string, originalContent: string) => Promise<void> = saveRecoveredSource,
  canRecoverEdits = true,
): Promise<boolean> {
  const stagedEntries = await collectGeneratedOutputEntries(nextOutputDir);
  const recoveryBySource = new Map<string, IGeneratedEditRecovery>();
  for (const entry of drift) {
    if (entry.reason !== "modified") continue;
    const nextOutputPath = join(nextOutputDir, entry.path);
    const previousSource = previousSourcePaths[entry.path];
    const nextSource = sourcePathByOutputPath.get(nextOutputPath);
    if (previousSource !== undefined && previousSource !== nextSource) {
      throw new Error(
        `Cannot sync generated edits for ${entry.path}: the selected skill source changed from ${previousSource} to ${nextSource ?? "none"}. Rebuild with the original hostname and overlay, or preserve the edits manually.`,
      );
    }
    if (!nextSource) {
      throw new Error(`Cannot recover ${entry.path}: no mapped source. Preserve the generated edit and resolve its source mapping before retrying.`);
    }
    const modifiedOutputPath = join(outputDir, entry.path);
    const filePaths = [nextSource, nextOutputPath, modifiedOutputPath];
    for (const path of filePaths) {
      if (!(await lstat(path)).isFile()) {
        throw new Error(`Cannot recover ${entry.path}: ${path} is not a regular file. Preserve both versions and resolve the file type before retrying.`);
      }
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const originalSource = decoder.decode(await Bun.file(nextSource).bytes());
    const stagedContent = decoder.decode(await Bun.file(nextOutputPath).bytes());
    const modifiedContent = decoder.decode(await Bun.file(modifiedOutputPath).bytes());
    if (modifiedContent === stagedContent) continue;
    {
      let sourceTemplate = originalSource;
      for (const variable of [...Object.keys(templateContext), "file_path", "file_dir"]) {
        sourceTemplate = sourceTemplate.replaceAll(`<%- ${variable} %>`, "");
      }
      if (sourceTemplate.includes("<%")) {
        throw new Error(`Cannot sync generated edits for ${entry.path}: edit the EJS template at ${nextSource} directly; expressions, includes, and control flow cannot be reconstructed from rendered output.`);
      }
    }
    const baseline = previousEntries[entry.path];
    const stagedEntry = stagedEntries[entry.path];
    if (baseline?.kind !== "file" || stagedEntry?.kind !== "file") {
      throw new Error(`Cannot recover ${entry.path}: no verified file baseline. Preserve the generated edit and restore or reconcile the manifest before retrying.`);
    }
    if (baseline.checksum !== stagedEntry.checksum) {
      throw new Error(`Cannot recover ${entry.path}: source ${nextSource} and generated output both changed. Preserve both versions and reconcile their edits before retrying.`);
    }
    const previousSourceChecksum = previousSourceChecksums[entry.path];
    if (previousSourceChecksum === undefined) {
      throw new Error(`Cannot recover ${entry.path}: no source fingerprint in the manifest. Preserve the generated edit and reconcile it into source before establishing a fresh baseline.`);
    }
    const sourceChecksum = new Bun.CryptoHasher("sha256").update(originalSource).digest("hex");
    if (sourceChecksum !== previousSourceChecksum) {
      throw new Error(`Cannot recover ${entry.path}: source ${nextSource} changed since generation. Preserve both versions and reconcile their edits before retrying.`);
    }
    const context: Record<string, string> = { ...templateContext, file_path: nextSource, file_dir: dirname(nextSource) };
    const reverseContent = (content: string, variables: Record<string, string> = context): string => {
      let recovered = reverseTemplateContent(content, variables);
      if (isUserSkillPath(nextSource) && nextSource.endsWith("SKILL.md")) {
        recovered = removeDisableModelInvocation(recovered);
      }
      if (nextSource.endsWith("SKILL.md") && originalSource.startsWith("---")) {
        recovered = updateSkillName(recovered, parseSkillIdentity(originalSource, nextSource).name);
      }
      return recovered;
    };
    const originalVariables = Object.fromEntries(
      Object.entries(context).filter(([name]) => originalSource.includes(`<%- ${name} %>`)),
    );
    if (originalSource.includes("\0") || modifiedContent.includes("\0") || reverseContent(stagedContent, originalVariables) !== originalSource) {
      throw new Error(`Cannot recover ${entry.path}: generated transformations cannot be reversed exactly into ${nextSource}. Preserve both versions and edit the source directly.`);
    }
    const recoveredContent = reverseContent(modifiedContent);
    const previousRecovery = recoveryBySource.get(nextSource);
    if (previousRecovery && previousRecovery.recoveredContent !== recoveredContent) {
      throw new Error(`Cannot recover ${entry.path}: harness copies ${previousRecovery.outputPath} and ${entry.path} contain conflicting edits for ${nextSource}. Preserve both copies and reconcile them before retrying.`);
    }
    recoveryBySource.set(nextSource, { sourcePath: nextSource, originalSource, recoveredContent, outputPath: entry.path });
  }
  if (recoveryBySource.size > 0 && !canRecoverEdits) {
    throw new Error("Generated files changed again during regeneration. Output application is suspended; preserve the edits and retry after reconciliation.");
  }
  for (const recovery of recoveryBySource.values()) {
    if (await Bun.file(recovery.sourcePath).text() !== recovery.originalSource) {
      throw new Error(`Cannot recover ${recovery.outputPath}: source ${recovery.sourcePath} changed during recovery. Preserve both versions and retry after reconciliation.`);
    }
    try {
      await saveSource(recovery.sourcePath, recovery.recoveredContent, recovery.originalSource);
    } catch (error) {
      throw new Error(`Cannot save recovered edit for ${recovery.outputPath} to ${recovery.sourcePath}; generated output is preserved. Resolve the save failure before retrying.`, { cause: error });
    }
  }
  return recoveryBySource.size > 0;
}

interface IGeneratedEditRecovery {
  sourcePath: string;
  originalSource: string;
  recoveredContent: string;
  outputPath: string;
}

async function saveRecoveredSource(sourcePath: string, content: string, originalContent: string): Promise<void> {
  const scratchDir = join(dirname(sourcePath), ".tmp");
  await mkdir(scratchDir, { recursive: true });
  const recoveryDir = await mkdtemp(join(scratchDir, "generated-edit-"));
  const recoveryPath = join(recoveryDir, "source");
  try {
    await Bun.write(recoveryPath, content);
    const sourceStat = await lstat(sourcePath);
    if (!sourceStat.isFile() || await Bun.file(sourcePath).text() !== originalContent) {
      throw new Error(`Source changed while preparing recovery: ${sourcePath}`);
    }
    await chmod(recoveryPath, sourceStat.mode);
    await rename(recoveryPath, sourcePath);
  } finally {
    await rm(recoveryDir, { recursive: true, force: true });
  }
}

export async function assertGeneratedOutputsAreSafeToReplace(
  manifest: IGeneratedOutputManifest | null,
  outputDir: string,
  nextOutputDir: string,
  sourcePathByOutputPath: Map<string, string>,
  templateContext: Record<string, string>,
  unmanagedPaths: IUnmanagedOutputPaths,
  canRecoverEdits = true,
): Promise<boolean> {
  if (!manifest) {
    return false;
  }

  const currentEntries = await collectGeneratedOutputEntries(outputDir, unmanagedPaths);
  const drift = getGeneratedOutputDrift(manifest, currentEntries, unmanagedPaths);
  return syncBackModifiedFiles(
    drift,
    outputDir,
    nextOutputDir,
    sourcePathByOutputPath,
    templateContext,
    manifest.sourcePaths,
    manifest.entries,
    manifest.sourceChecksums,
    undefined,
    canRecoverEdits,
  );
}

async function writeGeneratedOutputManifest(
  outputDir: string,
  managedEntries: Record<string, IGeneratedOutputManifestEntry>,
  sourcePathByOutputPath: Map<string, string>,
  stagingDir: string,
  sourceChecksums: Map<string, string>,
  syncedFilePaths: readonly string[],
): Promise<void> {
  const manifest = createGeneratedOutputManifest(managedEntries);
  manifest.syncedFilePaths = [...syncedFilePaths].sort();
  const sourcePaths: Record<string, string> = Object.fromEntries(
    [...sourcePathByOutputPath]
      .map(([outputPath, sourcePath]) => [relative(stagingDir, outputPath).replaceAll("\\", "/"), sourcePath])
      .filter(([outputPath]) => managedEntries[outputPath]?.kind === "file"),
  );
  manifest.sourcePaths = sourcePaths;
  manifest.sourceChecksums = Object.fromEntries(
    Object.entries(sourcePaths).flatMap(([path, sourcePath]) => {
      const checksum = sourceChecksums.get(sourcePath);
      return checksum === undefined ? [] : [[path, checksum]];
    }),
  );

  await writeFile(
    join(outputDir, GENERATED_OUTPUT_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
  await rm(join(outputDir, LEGACY_GENERATED_OUTPUT_MANIFEST_NAME), { force: true });
}

export async function buildCommand(options: IBuildOptions): Promise<void> {
  await buildOutputs(options, true);
}

interface IBuildOptions {
  hasAutoConfirm: boolean;
  registryPaths?: IRegistryPaths;
}

async function buildOutputs(options: IBuildOptions, canRecoverEdits: boolean): Promise<void> {
  console.log("🚀 Building Unified Agent Outputs...");
  const buildHostname = resolveBuildHostname(process.env.AI_REGISTRY_HOSTNAME, hostname());
  const { root, overlays, output, harnesses, profiles, skills, commands, temp } =
    options.registryPaths ?? getRegistryPaths();
  
  const GENERATED_OUTPUT_STAGING_DIR = join(temp, "generated-output-staging");
  const TEMPLATE_CONTEXT = {
    repo_root: root,
    overlay_dir: overlays.at(-1) ?? "",
    skills_dir: skills,
    commands_dir: commands,
    profiles_dir: profiles,
    output_dir: output,
  } as const;

  for (const overlay of overlays) {
    console.log(`📦 Using overlay: ${overlay}`);
  }

  console.log();

  const existingManifest = await readGeneratedOutputManifest(output);

  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });
  await mkdir(GENERATED_OUTPUT_STAGING_DIR, { recursive: true });
  const sourceChecksums = new Map<string, string>();
  const sourcePathByOutputPath = Object.assign(new Map<string, string>(), { sourceChecksums });
  const settingsSyncRegistry = createSettingsSyncRegistry(GENERATED_OUTPUT_STAGING_DIR);

  const wrappedBuildSupport: IBuildSupport = {
    copyDirectoryWithTemplateVariables: (sourceDir, targetDir, templateContext) => {
      return copyDirectoryWithTemplateVariables(sourceDir, targetDir, templateContext, sourcePathByOutputPath, buildHostname);
    },
    copyPathWithTemplateVariables: (sourcePath, targetPath, templateContext) => {
      return copyPathWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath, buildHostname);
    },
    mergeDirectory: (sourceDir, destinationDir, options) => {
      return mergeDirectory(sourceDir, destinationDir, options, sourcePathByOutputPath);
    },
    stageProfileAssets,
    writeBinScript,
    syncSettingsFile: settingsSyncRegistry.syncSettingsFile,
  };

  const overlayProfilesDirs = overlays.map((overlay) => join(overlay, "profiles"));
  const overlaySkillsDirs = overlays.map((overlay) => join(overlay, "skills"));
  const overlayCommandsDirs = overlays.map((overlay) => join(overlay, "commands"));

  const discoveredProfiles = await discoverProfiles(profiles, overlayProfilesDirs);

  for (const discoveredProfile of discoveredProfiles) {
    const { profileName, profileDir, isOverlay } = discoveredProfile;

    console.log(`📦 Processing persona: ${profileName}${isOverlay ? " (overlay)" : ""}`);
    let manifest: IProfileManifest | null = null;

    const yamlPath = join(profileDir, "profile.yaml");
    const jsonPath = join(profileDir, "profile.json");

    if (existsSync(yamlPath)) {
      const module = await import(yamlPath);
      if (isProfileManifest(module.default)) {
        manifest = module.default;
      }
    } else if (existsSync(jsonPath)) {
      const manifestContent = await readFile(jsonPath, "utf-8");
      const parsedManifest = JSON.parse(manifestContent);
      if (isProfileManifest(parsedManifest)) {
        manifest = parsedManifest;
      }
    } else {
      console.warn(`   ⚠️ Skipping: Neither profile.yaml nor profile.json found.`);
      continue;
    }

    if (!manifest) {
      throw new Error(`Profile manifest for ${profileName} must be a JSON/YAML object.`);
    }

    const [matchedSkillsResult, matchedCommandsResult, localAssets] = await Promise.all([
      resolveMatchedAssets(manifest.skills ?? [], skills, overlaySkillsDirs),
      resolveMatchedAssets(manifest.commands ?? [], commands, overlayCommandsDirs),
      discoverProfileLocalAssets(profileDir),
    ]);

    for (const conflict of matchedSkillsResult.conflicts) {
      console.log(`NOTE: Skill "${conflict.name}" conflict: ${conflict.selectedSource} replaces ${conflict.previousSource}`);
    }

    const globalMatchedSkills = matchedSkillsResult.matchedNames;
    const globalSkillSourcePaths = matchedSkillsResult.sourcePaths;
    const globalUserSkillNames = matchedSkillsResult.userSkillNames;
    const globalMatchedCommands = matchedCommandsResult.matchedNames;
    const globalCommandSourcePaths = matchedCommandsResult.sourcePaths;

    if (overlays.length > 0) {
      const overlaySkillNames = globalMatchedSkills.filter(
        (name) => overlays.some((overlay) => globalSkillSourcePaths[name]?.startsWith(overlay + sep)),
      );
      const overlayCommandNames = globalMatchedCommands.filter(
        (name) => overlays.some((overlay) => globalCommandSourcePaths[name]?.startsWith(overlay + sep)),
      );
      if (overlaySkillNames.length > 0) {
        console.log(`   ↳ overlay skills (${overlaySkillNames.length}): ${overlaySkillNames.join(", ")}`);
      }
      if (overlayCommandNames.length > 0) {
        console.log(`   ↳ overlay commands (${overlayCommandNames.length}): ${overlayCommandNames.join(", ")}`);
      }
    }

    for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
      if (!unifiedHarnessPlugin.stageProfile) continue;

      await unifiedHarnessPlugin.stageProfile({
        harnessDir: join(harnesses, unifiedHarnessPlugin.target),
        profileName,
        profileDir,
        manifest,
        globalMatchedSkills,
        globalMatchedCommands,
        globalSkillSourcePaths,
        globalCommandSourcePaths,
        globalUserSkillNames,
        profileLocalSkills: localAssets.profileLocalSkills,
        profileLocalCommands: localAssets.profileLocalCommands,
        outputDir: GENERATED_OUTPUT_STAGING_DIR,
        templateContext: TEMPLATE_CONTEXT,
        buildSupport: wrappedBuildSupport,
      });
    }
  }

  console.log("\n🧩 Finalizing harness outputs...");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    if (!unifiedHarnessPlugin.finalizeOutput) continue;

    await unifiedHarnessPlugin.finalizeOutput({
      harnessDir: join(harnesses, unifiedHarnessPlugin.target),
      overlayDirs: overlays,
      outputDir: GENERATED_OUTPUT_STAGING_DIR,
      templateContext: TEMPLATE_CONTEXT,
      buildSupport: wrappedBuildSupport,
    });
  }

  await applyTemplateVariablesToGeneratedOutput(GENERATED_OUTPUT_STAGING_DIR, TEMPLATE_CONTEXT, sourcePathByOutputPath);
  console.log("   ✅ Successfully compiled unified outputs!");

  const syncedSettingsFiles = settingsSyncRegistry.getSyncedSettingsFiles();
  const syncedFilePaths = syncedSettingsFiles.map((file) => file.relativePath);
  const unmanagedPaths: IUnmanagedOutputPaths = { syncedFilePaths };
  const settingsSyncOptions: ISyncSettingsFilesOptions = {
    syncedSettingsFiles,
    stagingDir: GENERATED_OUTPUT_STAGING_DIR,
    outputDir: output,
    stateDir: join(temp, "settings-sync"),
    sourcePathByOutputPath,
    templateContext: TEMPLATE_CONTEXT,
    sourceRepository: createGitSettingsSourceRepository(),
    shouldCommitSourceChanges: process.env.AI_REGISTRY_SETTINGS_AUTO_COMMIT !== "0",
  };
  await validateStagedSettingsFiles(settingsSyncOptions);
  for (const [sourcePath, checksum] of sourceChecksums) {
    const currentChecksum = new Bun.CryptoHasher("sha256").update(await Bun.file(sourcePath).bytes()).digest("hex");
    if (currentChecksum !== checksum) {
      throw new Error(`Source changed while staging generated outputs: ${sourcePath}`);
    }
  }
  const expectedCurrentEntries = await collectGeneratedOutputEntries(output, unmanagedPaths);

  const hasRecoveredEdits = await assertGeneratedOutputsAreSafeToReplace(
    existingManifest,
    output,
    GENERATED_OUTPUT_STAGING_DIR,
    sourcePathByOutputPath,
    TEMPLATE_CONTEXT,
    unmanagedPaths,
    canRecoverEdits,
  );

  if (hasRecoveredEdits) {
    await buildOutputs(options, false);
    return;
  }

  const nextManagedEntries = await collectGeneratedOutputEntries(GENERATED_OUTPUT_STAGING_DIR, unmanagedPaths);

  await syncManagedGeneratedOutputs({
    nextEntries: nextManagedEntries,
    nextOutputDir: GENERATED_OUTPUT_STAGING_DIR,
    outputDir: output,
    previousManifest: existingManifest,
    ...unmanagedPaths,
    expectedCurrentEntries,
  });
  await syncSettingsFiles(settingsSyncOptions);
  await writeGeneratedOutputManifest(
    output,
    nextManagedEntries,
    sourcePathByOutputPath,
    GENERATED_OUTPUT_STAGING_DIR,
    sourceChecksums,
    syncedFilePaths,
  );
  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nGenerated harness outputs:");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    console.log(`  - ${join(output, unifiedHarnessPlugin.target)}`);
  }
  console.log(`  - ${join(output, GENERATED_OUTPUT_MANIFEST_NAME)}`);
  for (const overlay of overlays) {
    console.log(`  - overlay merged: ${overlay}`);
  }
  console.log("\nTo test OpenCode instantly via CLI, run:");
  console.log(`  XDG_CONFIG_HOME=${join(root, ".output")} opencode --agent designer\n`);
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
}
