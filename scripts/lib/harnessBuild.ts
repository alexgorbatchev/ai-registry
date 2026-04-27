import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";

import { renderTemplate } from "@alexgorbatchev/template-resolver";
import walk from "ignore-walk";
const REGISTRY_IGNORE_FILE_NAME = ".registry-ignore";
const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);

import { pathToFileURL } from "url";

export type ITemplateContext = Record<string, string>;

export type IProfileManifest = {
  description?: string;
  skills?: string[];
  commands?: string[];
  tools?: Record<string, boolean>;
  permission?: Record<string, string | Record<string, string>>;
  system_prompt?: string;
};

export type IBuildSupport = {
  mergeDirectory(sourceDir: string, destDir: string, options?: { move?: boolean }): Promise<void>;
  stageProfileAssets(context: IProfileBuildContext, destinations: { skillsDir: string; commandsDir: string; localCommandRenamer?: (profileName: string, commandName: string) => string; }): Promise<void>;
  writeBinScript(outputDir: string, filename: string, content: string): Promise<void>;
  copyDirectoryWithTemplateVariables(
    sourceDir: string,
    targetDir: string,
    templateContext: ITemplateContext,
  ): Promise<void>;
  copyPathWithTemplateVariables(
    sourcePath: string,
    targetPath: string,
    templateContext: ITemplateContext,
  ): Promise<void>;
};

export type IProfileBuildContext = {
  harnessDir: string;
  profileName: string;
  profileDir: string;
  manifest: IProfileManifest;
  globalMatchedSkills: string[];
  globalMatchedCommands: string[];
  profileLocalSkills: string[];
  profileLocalCommands: string[];
  outputDir: string;
  templateContext: ITemplateContext;
  buildSupport: IBuildSupport;
};

export type IUnifiedHarnessBuildContext = {
  harnessDir: string;
  outputDir: string;
  templateContext: ITemplateContext;
  buildSupport: IBuildSupport;
};

export type IUnifiedHarnessPlugin = {
  target: string;
  stageProfile?(context: IProfileBuildContext): Promise<void>;
  finalizeOutput?(context: IUnifiedHarnessBuildContext): Promise<void>;
  getBootstrapTargets?(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>>;
};

export function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
}

export function isUnifiedHarnessPlugin(value: unknown): value is IUnifiedHarnessPlugin {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const target = getObjectValue(value, "target");
  const stageProfile = getObjectValue(value, "stageProfile");
  const finalizeOutput = getObjectValue(value, "finalizeOutput");
  const getBootstrapTargets = getObjectValue(value, "getBootstrapTargets");

  return (
    typeof target === "string" &&
    (stageProfile === undefined || typeof stageProfile === "function") &&
    (finalizeOutput === undefined || typeof finalizeOutput === "function") &&
    (getBootstrapTargets === undefined || typeof getBootstrapTargets === "function")
  );
}

export async function getAvailableHarnessBuildTargets(harnessesDir: string): Promise<string[]> {
  if (!existsSync(harnessesDir)) {
    return [];
  }

  const harnessEntries = await readdir(harnessesDir, { withFileTypes: true });
  return harnessEntries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((entryName) => existsSync(join(harnessesDir, entryName, "scripts", "build.ts")));
}

export async function loadUnifiedHarnessPlugins(harnessesDir: string, targets: string[]): Promise<IUnifiedHarnessPlugin[]> {
  const plugins: IUnifiedHarnessPlugin[] = [];

  for (const target of targets) {
    const pluginPath = join(harnessesDir, target, "scripts", "build.ts");
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

function normalizeRelativePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function shouldIgnoreSourceCopyPath(relativePath: string): boolean {
  const pathParts = normalizeRelativePath(relativePath).split("/");
  const entryBasename = pathParts[pathParts.length - 1];

  return (
    entryBasename === REGISTRY_IGNORE_FILE_NAME ||
    pathParts.some((part) => GENERATED_OUTPUT_IGNORED_PATH_PARTS.has(part))
  );
}

async function getSourceCopyEntries(sourceDir: string): Promise<string[]> {
  const entries = await walk({
    path: sourceDir,
    ignoreFiles: [REGISTRY_IGNORE_FILE_NAME],
    includeEmpty: true,
  });

  const supplementalIgnorePrefixes = await getSupplementalIgnorePrefixes(sourceDir);

  return entries
    .map((entry) => normalizeRelativePath(entry))
    .filter((entry) => entry.length > 0 && !shouldIgnoreSourceCopyPath(entry))
    .filter((entry) => !isIgnoredBySupplementalPrefixes(entry, supplementalIgnorePrefixes));
}

async function getSupplementalIgnorePrefixes(
  sourceDir: string,
  currentDir: string = sourceDir,
): Promise<string[]> {
  const prefixes: string[] = [];
  const ignoreFilePath = join(currentDir, REGISTRY_IGNORE_FILE_NAME);

  if (existsSync(ignoreFilePath)) {
    const relativeBaseDir = normalizeRelativePath(currentDir.slice(sourceDir.length + 1));
    const ignoreFileContent = await readFile(ignoreFilePath, "utf-8");
    for (const rawLine of ignoreFileContent.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("./")) {
        continue;
      }

      const normalizedPrefix = normalizeRelativePath(join(relativeBaseDir, line.slice(2))).replace(/\/$/, "");
      if (normalizedPrefix.length > 0) {
        prefixes.push(normalizedPrefix);
      }
    }
  }

  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || GENERATED_OUTPUT_IGNORED_PATH_PARTS.has(entry.name)) {
      continue;
    }

    prefixes.push(...await getSupplementalIgnorePrefixes(sourceDir, join(currentDir, entry.name)));
  }

  return prefixes;
}

function isIgnoredBySupplementalPrefixes(relativePath: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}

async function applyTemplateVariables(
  content: string,
  sourcePath: string,
  templateContext: ITemplateContext,
): Promise<string> {
  return renderTemplate({
    content,
    sourcePath,
    repositoryRoot: templateContext.repo_root,
    variables: templateContext,
    environment: process.env,
  });
}

async function copyFileWithTemplateVariables(
  sourcePath: string,
  targetPath: string,
  templateContext: ITemplateContext,
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });

  const isSkillDefinition = basename(sourcePath) === "SKILL.md";
  if (isSkillDefinition) {
    const sourceContent = await readFile(sourcePath, "utf-8");
    const renderedContent = await applyTemplateVariables(sourceContent, sourcePath, templateContext);
    await writeFile(
      targetPath,
      renderedContent,
      "utf-8",
    );
    return;
  }

  await copyFile(sourcePath, targetPath);
}

export async function copyDirectoryWithTemplateVariables(
  sourceDir: string,
  targetDir: string,
  templateContext: ITemplateContext,
): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  const entries = await getSourceCopyEntries(sourceDir);
  for (const relativePath of entries) {
    const sourcePath = join(sourceDir, relativePath);
    const targetPath = join(targetDir, relativePath);
    const sourceStats = await lstat(sourcePath);

    if (sourceStats.isSymbolicLink()) {
      continue;
    }

    if (sourceStats.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await chmod(targetPath, sourceStats.mode);
      continue;
    }

    if (!sourceStats.isFile()) {
      continue;
    }

    await copyFileWithTemplateVariables(sourcePath, targetPath, templateContext);
    await chmod(targetPath, sourceStats.mode);
  }
}

export async function copyPathWithTemplateVariables(
  sourcePath: string,
  targetPath: string,
  templateContext: ITemplateContext,
): Promise<void> {
  const sourceStats = await lstat(sourcePath);

  if (sourceStats.isSymbolicLink()) {
    return;
  }

  if (sourceStats.isDirectory()) {
    await copyDirectoryWithTemplateVariables(sourcePath, targetPath, templateContext);
    return;
  }

  if (!sourceStats.isFile()) {
    return;
  }

  await copyFileWithTemplateVariables(sourcePath, targetPath, templateContext);
  await chmod(targetPath, sourceStats.mode);
}

export async function applyTemplateVariablesToGeneratedOutput(
  outputDir: string,
  templateContext: ITemplateContext,
): Promise<void> {
  if (!existsSync(outputDir)) {
    return;
  }

  const entries = await readdir(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && GENERATED_OUTPUT_IGNORED_PATH_PARTS.has(entry.name)) {
      continue;
    }

    const entryPath = join(outputDir, entry.name);

    if (entry.isDirectory()) {
      await applyTemplateVariablesToGeneratedOutput(entryPath, templateContext);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileBuffer = await readFile(entryPath);
    if (fileBuffer.includes(0)) {
      continue;
    }

    const sourceContent = fileBuffer.toString("utf-8");
    const renderedContent = await applyTemplateVariables(
      sourceContent,
      entryPath,
      templateContext,
    );

    if (renderedContent !== sourceContent) {
      await writeFile(entryPath, renderedContent, "utf-8");
    }
  }
}

export async function mergeDirectory(
  sourceDir: string,
  destinationDir: string,
  options: { move?: boolean } = {}
): Promise<void> {
  if (!existsSync(sourceDir)) {
    return;
  }
  await mkdir(destinationDir, { recursive: true });

  const sourceEntries = await readdir(sourceDir, { withFileTypes: true });
  for (const sourceEntry of sourceEntries) {
    const sourcePath = join(sourceDir, sourceEntry.name);
    const destinationPath = join(destinationDir, sourceEntry.name);

    if (sourceEntry.isDirectory()) {
      if (existsSync(destinationPath)) {
        const destinationStats = await lstat(destinationPath);
        if (!destinationStats.isDirectory()) {
          throw new Error(`Cannot merge directory into file: ${destinationPath}`);
        }
        await mergeDirectory(sourcePath, destinationPath, options);
        continue;
      }

      if (options.move) {
        await rename(sourcePath, destinationPath);
      } else {
        await mergeDirectory(sourcePath, destinationPath, options);
      }
      continue;
    }

    if (existsSync(destinationPath)) {
      throw new Error(`Cannot merge generated output because destination already exists: ${destinationPath}`);
    }

    if (options.move) {
      await rename(sourcePath, destinationPath);
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }

  if (options.move) {
    await rm(sourceDir, { recursive: true, force: true });
  }
}

export async function stageProfileAssets(
  context: IProfileBuildContext,
  destinations: {
    skillsDir: string;
    commandsDir: string;
    localCommandRenamer?: (profileName: string, commandName: string) => string;
  }
): Promise<void> {
  const { commandsDir, skillsDir, localCommandRenamer } = destinations;

  const assertMissingOutputPath = (outputPath: string, assetDescription: string) => {
    if (existsSync(outputPath)) {
      throw new Error(`Cannot stage ${assetDescription} because the output path already exists: ${outputPath}`);
    }
  };

  for (const matchedCommand of context.globalMatchedCommands) {
    const outputPath = join(commandsDir, matchedCommand);
    if (existsSync(outputPath)) continue;
    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.templateContext.commands_dir, matchedCommand),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalCommand of context.profileLocalCommands) {
    const outputName = localCommandRenamer ? localCommandRenamer(context.profileName, profileLocalCommand) : profileLocalCommand;
    const outputPath = join(commandsDir, outputName);
    assertMissingOutputPath(outputPath, `profile-local command ${profileLocalCommand} for profile ${context.profileName}`);
    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.profileDir, "commands", profileLocalCommand),
      outputPath,
      context.templateContext,
    );
  }

  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsDir, matchedSkill);
    if (existsSync(outputPath)) continue;
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsDir, profileLocalSkill);
    assertMissingOutputPath(outputPath, `profile-local skill ${profileLocalSkill} for profile ${context.profileName}`);
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.profileDir, "skills", profileLocalSkill),
      outputPath,
      context.templateContext,
    );
  }
}

export async function writeBinScript(
  outputDir: string,
  filename: string,
  content: string
): Promise<void> {
  const binDir = join(outputDir, "bin");
  await mkdir(binDir, { recursive: true });
  const scriptPath = join(binDir, filename);
  await writeFile(scriptPath, content, { mode: 0o755 });
}
