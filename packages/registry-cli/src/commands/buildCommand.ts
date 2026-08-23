import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "fs/promises";
import { join } from "path";
import { stdin, stdout } from "process";
import { globby } from "globby";
import { existsSync } from "fs";

import { getRegistryPaths } from "../lib/getRegistryPaths";
import {
  type IBuildSupport,
  type IProfileManifest,
  type IUnifiedHarnessPlugin,
  applyTemplateVariablesToGeneratedOutput,
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  symlinkDirectoryWithOriginalFiles,
  writeBinScript,
  getObjectValue,
} from "../lib/harnessBuild";
import { discoverProfileLocalAssets } from "../lib/discoverProfileLocalAssets";
import {
  collectGeneratedOutputEntries,
  createGeneratedOutputManifest,
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

// Statically import harness plugins
import codexPlugin from "../harnesses/codex/build";
import opencodePlugin from "../harnesses/opencode/build";
import piPlugin from "../harnesses/pi/build";

const unifiedHarnessPlugins: IUnifiedHarnessPlugin[] = [codexPlugin, opencodePlugin, piPlugin];

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
  return (
    version === GENERATED_OUTPUT_MANIFEST_VERSION &&
    typeof generatedAt === "string" &&
    isGeneratedOutputManifestEntryRecord(entries)
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
): Promise<void> {
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

      await writeFile(sourcePath, reversedContent, "utf-8");
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
): Promise<void> {
  if (!manifest) {
    return;
  }

  const currentEntries = await collectGeneratedOutputEntries(outputDir);
  const drift = getGeneratedOutputDrift(manifest, currentEntries);
  await confirmGeneratedOutputOverwrite(
    drift,
    outputDir,
    nextOutputDir,
    hasAutoConfirm,
    sourcePathByOutputPath,
    templateContext,
  );
}

async function writeGeneratedOutputManifest(
  outputDir: string,
  managedEntries: Record<string, IGeneratedOutputManifestEntry>,
): Promise<void> {
  const manifest = createGeneratedOutputManifest(managedEntries);

  await writeFile(
    join(outputDir, GENERATED_OUTPUT_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
  await rm(join(outputDir, LEGACY_GENERATED_OUTPUT_MANIFEST_NAME), { force: true });
}

async function resolveGlobs(patterns: string[], cwd: string): Promise<string[]> {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return [];
  const matches = await globby(patterns, {
    cwd,
    onlyFiles: false,
    markDirectories: false,
    expandDirectories: false,
  });
  return matches;
}

export async function buildCommand(options: { hasAutoConfirm: boolean }): Promise<void> {
  console.log("🚀 Building Unified Agent Outputs...");
  const { root, output, harnesses, profiles, skills, commands, temp } = getRegistryPaths();
  
  const GENERATED_OUTPUT_STAGING_DIR = join(temp, "generated-output-staging");
  const TEMPLATE_CONTEXT = {
    repo_root: root,
    skills_dir: skills,
    commands_dir: commands,
    profiles_dir: profiles,
    output_dir: output,
  } as const;

  const buildSupport: IBuildSupport = {
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
    mergeDirectory,
    stageProfileAssets,
    symlinkDirectoryWithOriginalFiles,
    writeBinScript,
  };

  console.log();

  const existingManifest = await readGeneratedOutputManifest(output);

  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });
  await mkdir(GENERATED_OUTPUT_STAGING_DIR, { recursive: true });
  const sourcePathByOutputPath = new Map<string, string>();

  const wrappedBuildSupport: IBuildSupport = {
    copyDirectoryWithTemplateVariables: (sourceDir, targetDir, templateContext) => {
      return copyDirectoryWithTemplateVariables(sourceDir, targetDir, templateContext, sourcePathByOutputPath);
    },
    copyPathWithTemplateVariables: (sourcePath, targetPath, templateContext) => {
      return copyPathWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath);
    },
    mergeDirectory: (sourceDir, destinationDir, options) => {
      return mergeDirectory(sourceDir, destinationDir, options, sourcePathByOutputPath);
    },
    symlinkDirectoryWithOriginalFiles: (sourceDir, targetDir) => {
      return symlinkDirectoryWithOriginalFiles(sourceDir, targetDir, sourcePathByOutputPath);
    },
    stageProfileAssets,
    writeBinScript,
  };

  const profileDirents = await readdir(profiles, { withFileTypes: true });
  const profileDirs = profileDirents.filter(d => d.isDirectory());

  for (const dirent of profileDirs) {
    const profileName = dirent.name;
    const profileDir = join(profiles, profileName);

    const hasJson = existsSync(join(profileDir, "profile.json"));
    const hasYaml = existsSync(join(profileDir, "profile.yaml"));

    if (!hasJson && !hasYaml) continue;

    console.log(`📦 Processing persona: ${profileName}`);
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

    const [globalMatchedSkills, globalMatchedCommands, localAssets] = await Promise.all([
      manifest.skills ? resolveGlobs(manifest.skills, skills) : [],
      manifest.commands ? resolveGlobs(manifest.commands, commands) : [],
      discoverProfileLocalAssets(profileDir),
    ]);

    for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
      if (!unifiedHarnessPlugin.stageProfile) continue;

      await unifiedHarnessPlugin.stageProfile({
        harnessDir: join(harnesses, unifiedHarnessPlugin.target),
        profileName,
        profileDir,
        manifest,
        globalMatchedSkills,
        globalMatchedCommands,
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

  await assertGeneratedOutputsAreSafeToReplace(
    existingManifest,
    output,
    GENERATED_OUTPUT_STAGING_DIR,
    options.hasAutoConfirm,
    sourcePathByOutputPath,
    TEMPLATE_CONTEXT,
  );

  const nextManagedEntries = await collectGeneratedOutputEntries(GENERATED_OUTPUT_STAGING_DIR);

  await syncManagedGeneratedOutputs({
    nextEntries: nextManagedEntries,
    nextOutputDir: GENERATED_OUTPUT_STAGING_DIR,
    outputDir: output,
    previousManifest: existingManifest,
  });
  await writeGeneratedOutputManifest(output, nextManagedEntries);
  await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nGenerated harness outputs:");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    console.log(`  - ${join(output, unifiedHarnessPlugin.target)}`);
  }
  console.log(`  - ${join(output, GENERATED_OUTPUT_MANIFEST_NAME)}`);
  console.log("\nTo test OpenCode instantly via CLI, run:");
  console.log(`  XDG_CONFIG_HOME=${join(root, ".output")} opencode --agent designer\n`);
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
}
