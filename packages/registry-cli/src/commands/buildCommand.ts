import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "fs/promises";
import { join, relative } from "path";
import { hostname } from "node:os";
import { stdin, stdout } from "process";
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
  getObjectValue,
} from "../lib/harnessBuild";
import { discoverProfileLocalAssets } from "../lib/discoverProfileLocalAssets";
import { discoverProfiles, resolveMatchedAssets } from "../lib/resolveRegistryAssets";
import {
  collectGeneratedOutputEntries,
  createGeneratedOutputManifest,
  createRuntimeDirectoryRegistry,
  GENERATED_OUTPUT_MANIFEST_NAME,
  GENERATED_OUTPUT_MANIFEST_VERSION,
  getGeneratedOutputDrift,
  LEGACY_GENERATED_OUTPUT_MANIFEST_NAME,
  type IGeneratedOutputDrift,
  type IGeneratedOutputManifest,
  type IGeneratedOutputManifestEntry,
  syncManagedGeneratedOutputs,
} from "../lib/generatedOutputUtils";
import { promptForYesNo, promptForOverwriteDecision } from "../lib/promptForYesNo";
import { reverseTemplateContent } from "../lib/reverseTemplateContent";
import { isUserSkillPath, removeDisableModelInvocation, updateSkillName } from "../lib/userSkillUtils";
import { resolveBuildHostname } from "../lib/resolveBuildHostname";
import { parseSkillIdentity } from "../lib/resolveSkillVariant";

// Statically import harness plugins
import claudeCodePlugin from "../harnesses/claude-code/build";
import codexPlugin from "../harnesses/codex/build";
import opencodePlugin from "../harnesses/opencode/build";
import piPlugin from "../harnesses/pi/build";

const unifiedHarnessPlugins: IUnifiedHarnessPlugin[] = [claudeCodePlugin, codexPlugin, opencodePlugin, piPlugin];

function isProfileManifest(value: unknown): value is IProfileManifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isGeneratedOutputManifestEntry(
  value: unknown,
): value is IGeneratedOutputManifestEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const kind = getObjectValue(value, "kind");
  if (kind === "directory") return true;
  if (kind === "file") return typeof getObjectValue(value, "checksum") === "string";
  if (kind === "symlink") return typeof getObjectValue(value, "target") === "string";
  return false;
}

function isGeneratedOutputManifestEntryRecord(
  value: unknown,
): value is Record<string, IGeneratedOutputManifestEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => isGeneratedOutputManifestEntry(entry));
}

function isGeneratedOutputManifest(
  value: unknown,
): value is IGeneratedOutputManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const entries = getObjectValue(value, "entries");
  const sourcePaths = getObjectValue(value, "sourcePaths");
  return (
    version === GENERATED_OUTPUT_MANIFEST_VERSION &&
    typeof generatedAt === "string" &&
    isGeneratedOutputManifestEntryRecord(entries) &&
    (sourcePaths === undefined || isStringRecord(sourcePaths))
  );
}

type ILegacyGeneratedOutputManifest = {
  version: 1;
  generatedAt: string;
  files: Record<string, string>;
};

function isLegacyGeneratedOutputManifest(
  value: unknown,
): value is ILegacyGeneratedOutputManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const files = getObjectValue(value, "files");
  return version === 1 && typeof generatedAt === "string" && isStringRecord(files);
}

function convertLegacyGeneratedOutputManifest(
  legacyManifest: ILegacyGeneratedOutputManifest,
): IGeneratedOutputManifest {
  const entries = Object.fromEntries(
    Object.entries(legacyManifest.files).map(([relativePath, checksum]) => [
      relativePath,
      { kind: "file", checksum } satisfies IGeneratedOutputManifestEntry,
    ]),
  );
  return {
    version: GENERATED_OUTPUT_MANIFEST_VERSION,
    generatedAt: legacyManifest.generatedAt,
    entries,
  };
}

async function readGeneratedOutputManifest(outputDir: string): Promise<IGeneratedOutputManifest | null> {
  const generatedManifestPath = join(outputDir, GENERATED_OUTPUT_MANIFEST_NAME);
  const legacyManifestPath = join(outputDir, LEGACY_GENERATED_OUTPUT_MANIFEST_NAME);

  const manifestPath = existsSync(generatedManifestPath)
    ? generatedManifestPath
    : existsSync(legacyManifestPath)
      ? legacyManifestPath
      : null;

  if (!manifestPath) {
    return null;
  }

  const manifestContent = await readFile(manifestPath, "utf-8");
  const parsedManifest = JSON.parse(manifestContent);
  if (isGeneratedOutputManifest(parsedManifest)) {
    return parsedManifest;
  }

  if (isLegacyGeneratedOutputManifest(parsedManifest)) {
    return convertLegacyGeneratedOutputManifest(parsedManifest);
  }

  throw new Error(`Invalid generated output manifest: ${manifestPath}`);
}

async function getFileDiff(
  oldPath: string,
  newPath: string,
): Promise<string> {
  try {
    const process = Bun.spawn(["git", "diff", "--no-index", "--color=always", oldPath, newPath]);
    const output = await new Response(process.stdout).text();
    return output;
  } catch (error) {
    return `Could not generate diff: ${error}`;
  }
}

async function formatGeneratedOutputDrift(
  drift: IGeneratedOutputDrift[],
  outputDir: string,
  nextOutputDir: string,
): Promise<string> {
  const fileLabel = drift.length === 1 ? "file" : "files";
  const sections = await Promise.all(
    drift.map(async (entry) => {
      let message = `  - ${entry.path} (${entry.reason})`;
      if (entry.reason === "modified") {
        const oldPath = join(outputDir, entry.path);
        const newPath = join(nextOutputDir, entry.path);
        const diff = await getFileDiff(oldPath, newPath);
        message += `\n${diff.split('\n').map(line => `    ${line}`).join('\n')}`;
      }
      return message;
    }),
  );

  return `\n⚠️ Detected external changes in generated outputs (${drift.length} ${fileLabel}):\n${sections.join("\n")}`;
}

export async function syncBackModifiedFiles(
  drift: IGeneratedOutputDrift[],
  outputDir: string,
  nextOutputDir: string,
  sourcePathByOutputPath: Map<string, string>,
  templateContext: Record<string, string>,
  previousSourcePaths: Record<string, string> = {},
): Promise<void> {
  for (const entry of drift) {
    const previousSource = previousSourcePaths[entry.path];
    const nextSource = sourcePathByOutputPath.get(join(nextOutputDir, entry.path));
    if (entry.reason === "modified" && previousSource !== undefined && previousSource !== nextSource) {
      throw new Error(
        `Cannot sync generated edits for ${entry.path}: the selected skill source changed from ${previousSource} to ${nextSource ?? "none"}. Rebuild with the original hostname and overlay, or preserve the edits manually.`,
      );
    }
    if (entry.reason === "modified" && nextSource) {
      let sourceTemplate = await Bun.file(nextSource).text();
      for (const variable of [...Object.keys(templateContext), "file_path", "file_dir"]) {
        sourceTemplate = sourceTemplate.replaceAll(`<%- ${variable} %>`, "");
      }
      if (sourceTemplate.includes("<%")) {
        throw new Error(`Cannot sync generated edits for ${entry.path}: edit the EJS template at ${nextSource} directly; expressions, includes, and control flow cannot be reconstructed from rendered output.`);
      }
    }
  }
  console.log("\n🔄 Syncing modified files back to source directories...");

  for (const entry of drift) {
    if (entry.reason !== "modified") {
      console.log(`  - Skipping non-modified entry: ${entry.path} (${entry.reason})`);
      continue;
    }

    const nextOutputPath = join(nextOutputDir, entry.path);
    const sourcePath = sourcePathByOutputPath.get(nextOutputPath);

    if (!sourcePath) {
      console.warn(`  - ⚠️ Cannot sync back ${entry.path}: No original source file found.`);
      continue;
    }

    try {
      const modifiedOutputPath = join(outputDir, entry.path);
      const modifiedContent = await readFile(modifiedOutputPath, "utf-8");
      const reversedContent = reverseTemplateContent(modifiedContent, templateContext);

      let finalContent = isUserSkillPath(sourcePath) && sourcePath.endsWith("SKILL.md")
        ? removeDisableModelInvocation(reversedContent)
        : reversedContent;
      if (/\/variants\/[^/]+\/SKILL\.md$/.test(sourcePath.replaceAll("\\", "/"))) {
        const identity = parseSkillIdentity(await Bun.file(sourcePath).text(), sourcePath);
        finalContent = updateSkillName(finalContent, identity.name);
      }

      await writeFile(sourcePath, finalContent, "utf-8");
      console.log(`  - ✅ Synced ${entry.path} -> ${sourcePath}`);

      // Now copy the modified file from outputDir to nextOutputDir so the current build
      // stages this updated version and correctly updates the manifest checksum!
      await copyFile(modifiedOutputPath, nextOutputPath);
    } catch (error) {
      console.error(`  - ❌ Failed to sync back ${entry.path}: ${error}`);
    }
  }
}

async function confirmGeneratedOutputOverwrite(
  drift: IGeneratedOutputDrift[],
  outputDir: string,
  nextOutputDir: string,
  hasAutoConfirm: boolean,
  sourcePathByOutputPath: Map<string, string>,
  templateContext: Record<string, string>,
  previousSourcePaths: Record<string, string> | undefined,
): Promise<void> {
  if (drift.length === 0) {
    return;
  }

  const driftMessage = await formatGeneratedOutputDrift(drift, outputDir, nextOutputDir);
  console.error(driftMessage);

  if (hasAutoConfirm) {
    console.error("\nAuto-confirm enabled via -y/--yes. Overwriting generated files.");
    return;
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Build cancelled. Generated outputs changed outside the build and no interactive terminal is available to confirm overwrite. Rerun with -y/--yes to overwrite them.",
    );
  }

  const decision = await promptForOverwriteDecision({
    message: "\nProceed and overwrite these generated files?",
    interruptMessage: "Build cancelled by Ctrl+C. Generated outputs were modified outside the build.",
  });

  if (decision === "no") {
    throw new Error(
      "Build cancelled. Generated outputs were modified outside the build.",
    );
  }

  if (decision === "sync") {
    await syncBackModifiedFiles(
      drift,
      outputDir,
      nextOutputDir,
      sourcePathByOutputPath,
      templateContext,
      previousSourcePaths,
    );
  }
}

async function assertGeneratedOutputsAreSafeToReplace(
  manifest: IGeneratedOutputManifest | null,
  outputDir: string,
  nextOutputDir: string,
  hasAutoConfirm: boolean,
  sourcePathByOutputPath: Map<string, string>,
  templateContext: Record<string, string>,
  runtimeDirectoryPaths: readonly string[],
): Promise<void> {
  if (!manifest) {
    return;
  }

  const currentEntries = await collectGeneratedOutputEntries(outputDir, { runtimeDirectoryPaths });
  const drift = getGeneratedOutputDrift(manifest, currentEntries, { runtimeDirectoryPaths });
  await confirmGeneratedOutputOverwrite(
    drift,
    outputDir,
    nextOutputDir,
    hasAutoConfirm,
    sourcePathByOutputPath,
    templateContext,
    manifest.sourcePaths,
  );
}

async function writeGeneratedOutputManifest(
  outputDir: string,
  managedEntries: Record<string, IGeneratedOutputManifestEntry>,
  sourcePathByOutputPath: Map<string, string>,
  stagingDir: string,
): Promise<void> {
  const manifest = createGeneratedOutputManifest(managedEntries);
  manifest.sourcePaths = Object.fromEntries(
    [...sourcePathByOutputPath].filter(([outputPath]) => outputPath.endsWith("/SKILL.md"))
      .map(([outputPath, sourcePath]) => [relative(stagingDir, outputPath).replaceAll("\\", "/"), sourcePath])
      .filter(([outputPath]) => managedEntries[outputPath]?.kind === "file"),
  );

  await writeFile(
    join(outputDir, GENERATED_OUTPUT_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
  await rm(join(outputDir, LEGACY_GENERATED_OUTPUT_MANIFEST_NAME), { force: true });
}

export async function buildCommand(options: {
  hasAutoConfirm: boolean;
  registryPaths?: IRegistryPaths;
}): Promise<void> {
  console.log("🚀 Building Unified Agent Outputs...");
  const buildHostname = resolveBuildHostname(process.env.AI_REGISTRY_HOSTNAME, hostname());
  const { root, overlay, output, harnesses, profiles, skills, commands, temp } =
    options.registryPaths ?? getRegistryPaths();
  
  const GENERATED_OUTPUT_STAGING_DIR = join(temp, "generated-output-staging");
  const TEMPLATE_CONTEXT = {
    repo_root: root,
    overlay_dir: overlay ?? "",
    skills_dir: skills,
    commands_dir: commands,
    profiles_dir: profiles,
    output_dir: output,
  } as const;

  if (overlay) {
    console.log(`📦 Using overlay: ${overlay}`);
  }

  console.log();

  const existingManifest = await readGeneratedOutputManifest(output);

  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });
  await mkdir(GENERATED_OUTPUT_STAGING_DIR, { recursive: true });
  const sourcePathByOutputPath = new Map<string, string>();
  const runtimeDirectoryRegistry = createRuntimeDirectoryRegistry(GENERATED_OUTPUT_STAGING_DIR);

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
    ensureRuntimeDirectory: runtimeDirectoryRegistry.ensureRuntimeDirectory,
  };

  const overlayProfilesDir = overlay ? join(overlay, "profiles") : null;
  const overlaySkillsDir = overlay ? join(overlay, "skills") : null;
  const overlayCommandsDir = overlay ? join(overlay, "commands") : null;

  const discoveredProfiles = await discoverProfiles(profiles, overlayProfilesDir);

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
      resolveMatchedAssets(manifest.skills ?? [], skills, overlaySkillsDir),
      resolveMatchedAssets(manifest.commands ?? [], commands, overlayCommandsDir),
      discoverProfileLocalAssets(profileDir),
    ]);

    const globalMatchedSkills = matchedSkillsResult.matchedNames;
    const globalSkillSourcePaths = matchedSkillsResult.sourcePaths;
    const globalUserSkillNames = matchedSkillsResult.userSkillNames;
    const globalMatchedCommands = matchedCommandsResult.matchedNames;
    const globalCommandSourcePaths = matchedCommandsResult.sourcePaths;

    if (overlay) {
      const overlaySkillNames = globalMatchedSkills.filter(
        (name) => globalSkillSourcePaths[name]?.startsWith(overlay),
      );
      const overlayCommandNames = globalMatchedCommands.filter(
        (name) => globalCommandSourcePaths[name]?.startsWith(overlay),
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
      outputDir: GENERATED_OUTPUT_STAGING_DIR,
      templateContext: TEMPLATE_CONTEXT,
      buildSupport: wrappedBuildSupport,
    });
  }

  await applyTemplateVariablesToGeneratedOutput(GENERATED_OUTPUT_STAGING_DIR, TEMPLATE_CONTEXT, sourcePathByOutputPath);
  console.log("   ✅ Successfully compiled unified outputs!");

  const runtimeDirectoryPaths = runtimeDirectoryRegistry.getRuntimeDirectoryPaths();

  await assertGeneratedOutputsAreSafeToReplace(
    existingManifest,
    output,
    GENERATED_OUTPUT_STAGING_DIR,
    options.hasAutoConfirm,
    sourcePathByOutputPath,
    TEMPLATE_CONTEXT,
    runtimeDirectoryPaths,
  );

  const nextManagedEntries = await collectGeneratedOutputEntries(GENERATED_OUTPUT_STAGING_DIR, { runtimeDirectoryPaths });

  await syncManagedGeneratedOutputs({
    nextEntries: nextManagedEntries,
    nextOutputDir: GENERATED_OUTPUT_STAGING_DIR,
    outputDir: output,
    previousManifest: existingManifest,
    runtimeDirectoryPaths,
  });
  await writeGeneratedOutputManifest(output, nextManagedEntries, sourcePathByOutputPath, GENERATED_OUTPUT_STAGING_DIR);
  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nGenerated harness outputs:");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    console.log(`  - ${join(output, unifiedHarnessPlugin.target)}`);
  }
  console.log(`  - ${join(output, GENERATED_OUTPUT_MANIFEST_NAME)}`);
  if (overlay) {
    console.log(`  - overlay merged: ${overlay}`);
  }
  console.log("\nTo test OpenCode instantly via CLI, run:");
  console.log(`  XDG_CONFIG_HOME=${join(root, ".output")} opencode --agent designer\n`);
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
}
