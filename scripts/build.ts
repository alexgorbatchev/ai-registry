import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "fs/promises";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { globby } from "globby";
import { stdin, stdout } from "process";

import {
  type IBuildSupport,
  type IProfileManifest,
  type IUnifiedHarnessPlugin,
  applyTemplateVariablesToGeneratedOutput,
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables, mergeDirectory, stageProfileAssets, writeBinScript,
  getAvailableHarnessBuildTargets,
  loadUnifiedHarnessPlugins,
  getObjectValue,
} from "./lib/harnessBuild";
import { discoverProfileLocalAssets } from "./lib/discoverProfileLocalAssets";
import { getErrorMessage } from "./lib/getErrorMessage";
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
} from "./lib/generatedOutputUtils";
import { promptForYesNo } from "./lib/promptForYesNo";
import { runCommand } from "./lib/runCommand";

// Resolve paths relative to the ai-registry root
const REGISTRY_DIR = resolve(import.meta.dir, "..");
const HARNESSES_DIR = join(REGISTRY_DIR, "harnesses");
const SKILLS_DIR = join(REGISTRY_DIR, "skills");
const COMMANDS_DIR = join(REGISTRY_DIR, "commands");
const PROFILES_DIR = join(REGISTRY_DIR, "profiles");

const UNIFIED_OUTPUT_DIR = join(REGISTRY_DIR, ".output");
const GENERATED_OUTPUT_STAGING_DIR = join(
  REGISTRY_DIR,
  ".tmp",
  "generated-output-staging",
);
const LEGACY_GENERATED_OUTPUT_MANIFEST_PATH = join(
  UNIFIED_OUTPUT_DIR,
  LEGACY_GENERATED_OUTPUT_MANIFEST_NAME,
);
const GENERATED_OUTPUT_MANIFEST_PATH = join(
  UNIFIED_OUTPUT_DIR,
  GENERATED_OUTPUT_MANIFEST_NAME,
);
const TEMPLATE_CONTEXT = {
  repo_root: REGISTRY_DIR,
  skills_dir: SKILLS_DIR,
  commands_dir: COMMANDS_DIR,
  profiles_dir: PROFILES_DIR,
  output_dir: UNIFIED_OUTPUT_DIR,
} as const;

const AUTO_CONFIRM_FLAGS = new Set(["-y", "--yes"]);

function hasAutoConfirmFlag(): boolean {
  return process.argv.some((argument) => AUTO_CONFIRM_FLAGS.has(argument));
}

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
  if (kind === "directory") {
    return true;
  }

  if (kind === "file") {
    return typeof getObjectValue(value, "checksum") === "string";
  }

  if (kind === "symlink") {
    return typeof getObjectValue(value, "target") === "string";
  }

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

async function readGeneratedOutputManifest(): Promise<IGeneratedOutputManifest | null> {
  const manifestPath = existsSync(GENERATED_OUTPUT_MANIFEST_PATH)
    ? GENERATED_OUTPUT_MANIFEST_PATH
    : existsSync(LEGACY_GENERATED_OUTPUT_MANIFEST_PATH)
      ? LEGACY_GENERATED_OUTPUT_MANIFEST_PATH
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
  nextOutputDir: string,
): Promise<string> {
  const fileLabel = drift.length === 1 ? "file" : "files";
  const sections = await Promise.all(
    drift.map(async (entry) => {
      let message = `  - ${entry.path} (${entry.reason})`;
      if (entry.reason === "modified") {
        const oldPath = join(UNIFIED_OUTPUT_DIR, entry.path);
        const newPath = join(nextOutputDir, entry.path);
        const diff = await getFileDiff(oldPath, newPath);
        message += `\n${diff.split('\n').map(line => `    ${line}`).join('\n')}`;
      }
      return message;
    }),
  );

  return `\n⚠️ Detected external changes in generated outputs (${drift.length} ${fileLabel}):\n${sections.join("\n")}`;
}

async function confirmGeneratedOutputOverwrite(
  drift: IGeneratedOutputDrift[],
  nextOutputDir: string,
  hasAutoConfirm: boolean,
): Promise<void> {
  if (drift.length === 0) {
    return;
  }

  const driftMessage = await formatGeneratedOutputDrift(drift, nextOutputDir);
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

  const shouldOverwrite = await promptForYesNo({
    message: "\nProceed and overwrite these generated files?",
    interruptMessage: "Build cancelled by Ctrl+C. Generated outputs were modified outside the build.",
  });

  if (!shouldOverwrite) {
    throw new Error(
      "Build cancelled. Generated outputs were modified outside the build.",
    );
  }
}

async function assertGeneratedOutputsAreSafeToReplace(
  manifest: IGeneratedOutputManifest | null,
  nextOutputDir: string,
  hasAutoConfirm: boolean,
): Promise<void> {
  if (!manifest) {
    return;
  }

  const currentEntries = await collectGeneratedOutputEntries(UNIFIED_OUTPUT_DIR);
  const drift = getGeneratedOutputDrift(manifest, currentEntries);
  await confirmGeneratedOutputOverwrite(drift, nextOutputDir, hasAutoConfirm);
}

async function writeGeneratedOutputManifest(
  managedEntries: Record<string, IGeneratedOutputManifestEntry>,
): Promise<void> {
  const manifest = createGeneratedOutputManifest(managedEntries);

  await writeFile(
    GENERATED_OUTPUT_MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
  await rm(LEGACY_GENERATED_OUTPUT_MANIFEST_PATH, { force: true });
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

async function buildUnifiedOutputs(
  outputDir: string,
  unifiedHarnessPlugins: IUnifiedHarnessPlugin[],
): Promise<void> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const sourcePathByOutputPath = new Map<string, string>();

  const buildSupport: IBuildSupport = {
    copyDirectoryWithTemplateVariables: (sourceDir, targetDir, templateContext) => {
      return copyDirectoryWithTemplateVariables(sourceDir, targetDir, templateContext, sourcePathByOutputPath);
    },
    copyPathWithTemplateVariables: (sourcePath, targetPath, templateContext) => {
      return copyPathWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath);
    },
    mergeDirectory: (sourceDir, destinationDir, options) => {
      return mergeDirectory(sourceDir, destinationDir, options, sourcePathByOutputPath);
    },
    stageProfileAssets,
    writeBinScript,
  };

  const profileDirents = await readdir(PROFILES_DIR, { withFileTypes: true });
  const profiles = profileDirents.filter(d => d.isDirectory());

  for (const dirent of profiles) {
    const profileName = dirent.name;
    const profileDir = join(PROFILES_DIR, profileName);

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
      manifest.skills ? resolveGlobs(manifest.skills, SKILLS_DIR) : [],
      manifest.commands ? resolveGlobs(manifest.commands, COMMANDS_DIR) : [],
      discoverProfileLocalAssets(profileDir),
    ]);

    for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
      if (!unifiedHarnessPlugin.stageProfile) {
        continue;
      }

      await unifiedHarnessPlugin.stageProfile({
        harnessDir: join(HARNESSES_DIR, unifiedHarnessPlugin.target),
        profileName,
        profileDir,
        manifest,
        globalMatchedSkills,
        globalMatchedCommands,
        profileLocalSkills: localAssets.profileLocalSkills,
        profileLocalCommands: localAssets.profileLocalCommands,
        outputDir,
        templateContext: TEMPLATE_CONTEXT,
        buildSupport,
      });
    }
  }

  console.log("\n🧩 Finalizing harness outputs...");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    if (!unifiedHarnessPlugin.finalizeOutput) {
      continue;
    }

    await unifiedHarnessPlugin.finalizeOutput({
      harnessDir: join(HARNESSES_DIR, unifiedHarnessPlugin.target),
      outputDir,
      templateContext: TEMPLATE_CONTEXT,
      buildSupport,
    });
  }

  await applyTemplateVariablesToGeneratedOutput(outputDir, TEMPLATE_CONTEXT, sourcePathByOutputPath);
  console.log("   ✅ Successfully compiled unified outputs!");
}

async function main() {
  console.log("🚀 Building Unified Agent Outputs...\n");

  const hasAutoConfirm = hasAutoConfirmFlag();

  const availableHarnessBuildTargets = await getAvailableHarnessBuildTargets(HARNESSES_DIR);
  const unifiedHarnessPlugins = await loadUnifiedHarnessPlugins(HARNESSES_DIR, availableHarnessBuildTargets);

  try {
    const existingManifest = await readGeneratedOutputManifest();

    await buildUnifiedOutputs(
      GENERATED_OUTPUT_STAGING_DIR,
      unifiedHarnessPlugins,
    );
    const nextManagedEntries = await collectGeneratedOutputEntries(GENERATED_OUTPUT_STAGING_DIR);
    await assertGeneratedOutputsAreSafeToReplace(
      existingManifest,
      GENERATED_OUTPUT_STAGING_DIR,
      hasAutoConfirm,
    );

    await syncManagedGeneratedOutputs({
      nextEntries: nextManagedEntries,
      nextOutputDir: GENERATED_OUTPUT_STAGING_DIR,
      outputDir: UNIFIED_OUTPUT_DIR,
      previousManifest: existingManifest,
    });
    await writeGeneratedOutputManifest(nextManagedEntries);
  } finally {
    await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });
  }

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nGenerated harness outputs:");
  for (const unifiedHarnessPlugin of unifiedHarnessPlugins) {
    console.log(`  - ${join(UNIFIED_OUTPUT_DIR, unifiedHarnessPlugin.target)}`);
  }
  console.log(`  - ${GENERATED_OUTPUT_MANIFEST_PATH}`);
  console.log("\nTo test OpenCode instantly via CLI, run:");
  console.log("  XDG_CONFIG_HOME=~/.dotfiles/ai-registry/.output opencode --agent designer\n");
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
