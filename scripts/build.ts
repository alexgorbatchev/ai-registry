import { createHash } from "crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { join, relative, resolve } from "path";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { globby } from "globby";
import { stdin, stdout } from "process";
import { createInterface } from "readline/promises";

import {
  type IBuildSupport,
  type IProfileManifest,
  type IUnifiedHarnessPlugin,
  applyTemplateVariablesToGeneratedOutput,
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
} from "./lib/harnessBuild";
import { discoverProfileLocalAssets } from "./lib/discoverProfileLocalAssets";

// Resolve paths relative to the ai-registry root
const REGISTRY_DIR = resolve(import.meta.dir, "..");
const HARNESSES_DIR = join(REGISTRY_DIR, "harnesses");
const SKILLS_DIR = join(REGISTRY_DIR, "skills");
const COMMANDS_DIR = join(REGISTRY_DIR, "commands");
const PROFILES_DIR = join(REGISTRY_DIR, "profiles");

const UNIFIED_OUTPUT_DIR = join(REGISTRY_DIR, ".output");
const GENERATED_OUTPUT_MANIFEST_NAME = "manifest.json";
const LEGACY_GENERATED_OUTPUT_MANIFEST_NAME = ".generated-output-manifest.json";
const GENERATED_OUTPUT_MANIFEST_PATH = join(
  UNIFIED_OUTPUT_DIR,
  GENERATED_OUTPUT_MANIFEST_NAME,
);
const GENERATED_OUTPUT_STAGING_DIR = join(
  REGISTRY_DIR,
  ".tmp",
  "generated-output-staging",
);
const LEGACY_GENERATED_OUTPUT_MANIFEST_PATH = join(
  UNIFIED_OUTPUT_DIR,
  LEGACY_GENERATED_OUTPUT_MANIFEST_NAME,
);
const GENERATED_OUTPUT_MANIFEST_VERSION = 1;
const NULL_DEVICE_PATH = "/dev/null";
const TEMPLATE_CONTEXT = {
  repo_root: REGISTRY_DIR,
  skills_dir: SKILLS_DIR,
  commands_dir: COMMANDS_DIR,
  profiles_dir: PROFILES_DIR,
  output_dir: UNIFIED_OUTPUT_DIR,
} as const;

type IGeneratedOutputManifest = {
  version: number;
  generatedAt: string;
  files: Record<string, string>;
};

type IGeneratedOutputDrift = {
  path: string;
  reason: "missing" | "modified" | "unexpected";
};

const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);
const GENERATED_OUTPUT_IGNORED_BASENAMES = new Set([
  ".gitignore",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
]);
const AUTO_CONFIRM_FLAGS = new Set(["-y", "--yes"]);

function hasAutoConfirmFlag(): boolean {
  return process.argv.some((argument) => AUTO_CONFIRM_FLAGS.has(argument));
}

function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
}

function isProfileManifest(value: unknown): value is IProfileManifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnifiedHarnessPlugin(value: unknown): value is IUnifiedHarnessPlugin {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const target = getObjectValue(value, "target");
  const stageProfile = getObjectValue(value, "stageProfile");
  const finalizeOutput = getObjectValue(value, "finalizeOutput");

  return (
    typeof target === "string" &&
    (stageProfile === undefined || typeof stageProfile === "function") &&
    (finalizeOutput === undefined || typeof finalizeOutput === "function")
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

function isGeneratedOutputManifest(
  value: unknown,
): value is IGeneratedOutputManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const version = getObjectValue(value, "version");
  const generatedAt = getObjectValue(value, "generatedAt");
  const files = getObjectValue(value, "files");

  return (
    version === GENERATED_OUTPUT_MANIFEST_VERSION &&
    typeof generatedAt === "string" &&
    isStringRecord(files)
  );
}

function createFileChecksum(fileBuffer: Buffer): string {
  return createHash("sha256").update(fileBuffer).digest("hex");
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function shouldIgnoreGeneratedOutputPath(relativePath: string): boolean {
  const pathParts = relativePath.split("/");
  const basename = pathParts[pathParts.length - 1];

  return (
    GENERATED_OUTPUT_IGNORED_BASENAMES.has(basename) ||
    pathParts.some((part) => GENERATED_OUTPUT_IGNORED_PATH_PARTS.has(part))
  );
}

async function collectGeneratedOutputChecksums(
  rootDir: string,
  currentDir: string = rootDir,
): Promise<Record<string, string>> {
  if (!existsSync(currentDir)) {
    return {};
  }

  const checksums: Record<string, string> = {};
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      Object.assign(
        checksums,
        await collectGeneratedOutputChecksums(rootDir, entryPath),
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = normalizeRelativePath(entryPath.slice(rootDir.length + 1));
    if (
      relativePath === GENERATED_OUTPUT_MANIFEST_NAME ||
      relativePath === LEGACY_GENERATED_OUTPUT_MANIFEST_NAME ||
      shouldIgnoreGeneratedOutputPath(relativePath)
    ) {
      continue;
    }

    const fileBuffer = await readFile(entryPath);
    checksums[relativePath] = createFileChecksum(fileBuffer);
  }

  return checksums;
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
  if (!isGeneratedOutputManifest(parsedManifest)) {
    throw new Error(
      `Invalid generated output manifest: ${manifestPath}`,
    );
  }

  return parsedManifest;
}

function getGeneratedOutputDrift(
  manifest: IGeneratedOutputManifest,
  currentChecksums: Record<string, string>,
): IGeneratedOutputDrift[] {
  const drift: IGeneratedOutputDrift[] = [];

  for (const [relativePath, expectedChecksum] of Object.entries(manifest.files)) {
    const actualChecksum = currentChecksums[relativePath];
    if (!actualChecksum) {
      drift.push({ path: relativePath, reason: "missing" });
      continue;
    }

    if (actualChecksum !== expectedChecksum) {
      drift.push({ path: relativePath, reason: "modified" });
    }
  }

  for (const relativePath of Object.keys(currentChecksums)) {
    if (!(relativePath in manifest.files)) {
      drift.push({ path: relativePath, reason: "unexpected" });
    }
  }

  return drift.sort((left, right) => left.path.localeCompare(right.path));
}

function indentBlock(content: string, indent: string): string {
  return content
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function getGeneratedOutputDiffPaths(
  entry: IGeneratedOutputDrift,
  nextOutputDir: string,
): { currentPath: string; nextPath: string } {
  const currentPath = join(UNIFIED_OUTPUT_DIR, entry.path);
  const nextPath = join(nextOutputDir, entry.path);

  if (entry.reason === "missing") {
    return { currentPath: NULL_DEVICE_PATH, nextPath };
  }

  if (entry.reason === "unexpected") {
    return { currentPath, nextPath: NULL_DEVICE_PATH };
  }

  return { currentPath, nextPath };
}

function normalizeDiffPathLabel(filePath: string, label: string): string {
  if (filePath === NULL_DEVICE_PATH) {
    return filePath;
  }

  const relativePath = normalizeRelativePath(relative(REGISTRY_DIR, filePath));
  return `${label}/${relativePath}`;
}

async function getGeneratedOutputDiff(
  entry: IGeneratedOutputDrift,
  nextOutputDir: string,
): Promise<string> {
  const { currentPath, nextPath } = getGeneratedOutputDiffPaths(entry, nextOutputDir);
  const diffCurrentPath = currentPath === NULL_DEVICE_PATH
    ? currentPath
    : normalizeRelativePath(relative(REGISTRY_DIR, currentPath));
  const diffNextPath = nextPath === NULL_DEVICE_PATH
    ? nextPath
    : normalizeRelativePath(relative(REGISTRY_DIR, nextPath));
  const diffProcess = Bun.spawn({
    cmd: [
      "git",
      "diff",
      "--no-index",
      "--no-color",
      "--text",
      "--src-prefix=current/",
      "--dst-prefix=next/",
      "--",
      diffCurrentPath,
      diffNextPath,
    ],
    cwd: REGISTRY_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutText = (await new Response(diffProcess.stdout).text()).trim();
  const stderrText = (await new Response(diffProcess.stderr).text()).trim();
  const exitCode = await diffProcess.exited;
  if (exitCode > 1) {
    throw new Error(
      `Failed to generate diff for ${entry.path}: ${stderrText || stdoutText || `exit code ${exitCode}`}`,
    );
  }

  return stdoutText
    .replaceAll(
      normalizeDiffPathLabel(currentPath, "current"),
      `current/${entry.path}`,
    )
    .replaceAll(normalizeDiffPathLabel(nextPath, "next"), `next/${entry.path}`);
}

async function formatGeneratedOutputDrift(
  drift: IGeneratedOutputDrift[],
  nextOutputDir: string,
): Promise<string> {
  const sections: string[] = [];

  for (const entry of drift) {
    const diff = await getGeneratedOutputDiff(entry, nextOutputDir);
    const sectionLines = [`  - ${entry.path} (${entry.reason})`];
    if (diff) {
      sectionLines.push(indentBlock(diff, "    "));
    }
    sections.push(sectionLines.join("\n"));
  }

  return `\n⚠️ Detected external changes in generated outputs:\n${sections.join("\n")}`;
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
      `Build cancelled. Generated outputs changed outside the build and no interactive terminal is available to confirm overwrite.${driftMessage}`,
    );
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await readline
      .question("\nProceed and overwrite these generated files? [y/N] "))
      .trim()
      .toLowerCase();

    if (answer !== "y" && answer !== "yes") {
      throw new Error(
        `Build cancelled. Generated outputs were modified outside the build.${driftMessage}`,
      );
    }
  } finally {
    readline.close();
  }
}

async function assertGeneratedOutputsAreSafeToReplace(
  nextOutputDir: string,
  hasAutoConfirm: boolean,
): Promise<void> {
  const manifest = await readGeneratedOutputManifest();
  if (!manifest) {
    return;
  }

  const currentChecksums = await collectGeneratedOutputChecksums(UNIFIED_OUTPUT_DIR);
  const drift = getGeneratedOutputDrift(manifest, currentChecksums);
  await confirmGeneratedOutputOverwrite(drift, nextOutputDir, hasAutoConfirm);
}

async function writeGeneratedOutputManifest(): Promise<void> {
  const manifest: IGeneratedOutputManifest = {
    version: GENERATED_OUTPUT_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    files: await collectGeneratedOutputChecksums(UNIFIED_OUTPUT_DIR),
  };

  await writeFile(
    GENERATED_OUTPUT_MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );
}

async function getAvailableHarnessBuildTargets(): Promise<string[]> {
  if (!existsSync(HARNESSES_DIR)) {
    return [];
  }

  const harnessEntries = await readdir(HARNESSES_DIR, { withFileTypes: true });
  return harnessEntries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((entryName) => existsSync(join(HARNESSES_DIR, entryName, "scripts", "build.ts")));
}

async function loadUnifiedHarnessPlugins(targets: string[]): Promise<IUnifiedHarnessPlugin[]> {
  const plugins: IUnifiedHarnessPlugin[] = [];

  for (const target of targets) {
    const pluginPath = join(HARNESSES_DIR, target, "scripts", "build.ts");
    if (!existsSync(pluginPath)) {
      continue;
    }

    const moduleValue = await import(pathToFileURL(pluginPath).href);
    const defaultExport = getObjectValue(moduleValue, "default");
    const namedPlugin = getObjectValue(moduleValue, "plugin");
    const plugin = isUnifiedHarnessPlugin(defaultExport)
      ? defaultExport
      : isUnifiedHarnessPlugin(namedPlugin)
        ? namedPlugin
        : null;

    if (!plugin) {
      throw new Error(
        `Harness build plugin at ${pluginPath} must export a plugin object as default or named \"plugin\".`,
      );
    }

    if (plugin.target !== target) {
      throw new Error(
        `Harness build plugin at ${pluginPath} declared target \"${plugin.target}\", expected \"${target}\".`,
      );
    }

    plugins.push(plugin);
  }

  return plugins;
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

  const buildSupport: IBuildSupport = {
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
  };

  const profiles = await readdir(PROFILES_DIR, { withFileTypes: true });

  for (const dirent of profiles) {
    if (!dirent.isDirectory()) continue;

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

  await applyTemplateVariablesToGeneratedOutput(outputDir, TEMPLATE_CONTEXT);
  console.log("   ✅ Successfully compiled unified outputs!");
}

async function main() {
  console.log("🚀 Building Unified Agent Outputs...\n");

  const hasAutoConfirm = hasAutoConfirmFlag();

  const availableHarnessBuildTargets = await getAvailableHarnessBuildTargets();
  const unifiedHarnessPlugins = await loadUnifiedHarnessPlugins(availableHarnessBuildTargets);

  try {
    await buildUnifiedOutputs(
      GENERATED_OUTPUT_STAGING_DIR,
      unifiedHarnessPlugins,
    );
    await assertGeneratedOutputsAreSafeToReplace(
      GENERATED_OUTPUT_STAGING_DIR,
      hasAutoConfirm,
    );

    await rm(UNIFIED_OUTPUT_DIR, { recursive: true, force: true });
    await rename(GENERATED_OUTPUT_STAGING_DIR, UNIFIED_OUTPUT_DIR);
    await writeGeneratedOutputManifest();
  } finally {
    await rm(GENERATED_OUTPUT_STAGING_DIR, { recursive: true, force: true });
  }

  console.log("\n🎉 Unified configuration ready!");
  console.log("\nTo test this setup instantly via CLI, run:");
  console.log("  XDG_CONFIG_HOME=~/.dotfiles/ai-registry/.output opencode --agent designer\n");
  console.log("To apply the generated outputs to your machine, run:");
  console.log("  bun run bootstrap\n");
  console.log("Once activated, you can open OpenCode and use the Tab key to switch between your profiles!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
