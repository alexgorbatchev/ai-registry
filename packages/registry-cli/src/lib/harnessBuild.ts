import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "fs/promises";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";

import { renderTemplate } from "@alexgorbatchev/template-resolver";
import walk from "ignore-walk";
import { resolveSkillVariant } from "./resolveSkillVariant";
import type { IResolvedMatchedAssets } from "./resolveRegistryAssets";
import type { ISyncedSettingsFileOptions } from "./settingsSync/types";
import {
  getOutputSkillName,
  injectDisableModelInvocation,
  isUserSkillPath,
  parseSkillAuthor,
  updateSkillName,
} from "./userSkillUtils";
const REGISTRY_IGNORE_FILE_NAME = ".registry-ignore";
const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);

export type ITemplateContext = Record<string, string>;

interface ISourcePathByOutputPath extends Map<string, string> {
  sourceChecksums?: Map<string, string>;
}

export type IBuildSupport = {
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
  // Marks a staged settings file the harness edits at runtime. The build keeps it
  // out of the manifest and reconciles it with its registry source on every run.
  syncSettingsFile(filePath: string, options?: ISyncedSettingsFileOptions): void;
};

export type IHarnessBuildContext = {
  harnessDirs: string[];
  skills: IResolvedMatchedAssets;
  commands: IResolvedMatchedAssets;
  outputDir: string;
  templateContext: ITemplateContext;
  buildSupport: IBuildSupport;
};

// Harness homes retain runtime state outside the repository.
export type IBootstrapTarget =
  | { kind: "home"; sourcePath: string; targetPath: string; description: string }
  | { kind: "link"; sourcePath: string; targetPath: string; description: string };

export type IUnifiedHarnessPlugin = {
  target: string;
  build(context: IHarnessBuildContext): Promise<void>;
  getBootstrapTargets?(outputDir: string): Promise<IBootstrapTarget[]>;
};

export function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
}

export function isUnifiedHarnessPlugin(value: unknown): value is IUnifiedHarnessPlugin {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const target = getObjectValue(value, "target");
  const build = getObjectValue(value, "build");
  const getBootstrapTargets = getObjectValue(value, "getBootstrapTargets");

  return (
    typeof target === "string" &&
    typeof build === "function" &&
    (getBootstrapTargets === undefined || typeof getBootstrapTargets === "function")
  );
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

function registerOriginalSourcePath(
  outputPath: string,
  sourcePath: string,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
): void {
  sourcePathByOutputPath?.set(outputPath, sourcePath);
}

async function copyFileWithTemplateVariables(
  sourcePath: string,
  targetPath: string,
  templateContext: ITemplateContext,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });

  // Render only in the final pass so literal EJS delimiters survive unchanged.
  const sourceContent = await Bun.file(sourcePath).bytes();
  const checksum = new Bun.CryptoHasher("sha256").update(sourceContent).digest("hex");
  const previousChecksum = sourcePathByOutputPath?.sourceChecksums?.get(sourcePath);
  if (previousChecksum !== undefined && previousChecksum !== checksum) {
    throw new Error(`Source changed while staging generated outputs: ${sourcePath}`);
  }
  await Bun.write(targetPath, sourceContent);
  await chmod(targetPath, (await lstat(sourcePath)).mode);
  sourcePathByOutputPath?.sourceChecksums?.set(sourcePath, checksum);
  registerOriginalSourcePath(targetPath, sourcePath, sourcePathByOutputPath);
}

export async function copyDirectoryWithTemplateVariables(
  sourceDir: string,
  targetDir: string,
  templateContext: ITemplateContext,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
  hostname?: string,
): Promise<void> {
  const skillSourcePath = await resolveSkillVariant(sourceDir, hostname);
  await mkdir(targetDir, { recursive: true });

  const entries = await getSourceCopyEntries(sourceDir);
  for (const relativePath of entries) {
    if (skillSourcePath && (relativePath === "variants" || relativePath.startsWith("variants/"))) continue;
    const sourcePath = skillSourcePath && relativePath === "SKILL.md"
      ? skillSourcePath
      : join(sourceDir, relativePath);
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

    await copyFileWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath);
    await chmod(targetPath, sourceStats.mode);
  }
  if (skillSourcePath && skillSourcePath !== join(sourceDir, "SKILL.md")) {
    console.log(`   Hostname variant: ${skillSourcePath}`);
  }
}

export async function copyPathWithTemplateVariables(
  sourcePath: string,
  targetPath: string,
  templateContext: ITemplateContext,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
  hostname?: string,
): Promise<void> {
  const sourceStats = await lstat(sourcePath);

  if (sourceStats.isSymbolicLink()) {
    return;
  }

  if (sourceStats.isDirectory()) {
    await copyDirectoryWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath, hostname);
    return;
  }

  if (!sourceStats.isFile()) {
    return;
  }

  await copyFileWithTemplateVariables(sourcePath, targetPath, templateContext, sourcePathByOutputPath);
  await chmod(targetPath, sourceStats.mode);
}

export async function applyTemplateVariablesToGeneratedOutput(
  outputDir: string,
  templateContext: ITemplateContext,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
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
      await applyTemplateVariablesToGeneratedOutput(entryPath, templateContext, sourcePathByOutputPath);
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
      sourcePathByOutputPath?.get(entryPath) ?? entryPath,
      templateContext,
    );

    if (renderedContent !== sourceContent) {
      await writeFile(entryPath, renderedContent, "utf-8");
    }
  }
}

// Layer native files individually; skills are resolved separately as complete bundles.
export async function stageHarnessFiles(context: IHarnessBuildContext, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  for (const sourceDir of context.harnessDirs) {
    if (!existsSync(sourceDir)) continue;
    for (const entry of await getSourceCopyEntries(sourceDir)) {
      if (entry === "skills" || entry.startsWith("skills/")) continue;
      const sourcePath = join(sourceDir, entry);
      const stats = await lstat(sourcePath);
      if (stats.isSymbolicLink()) continue;
      const targetPath = join(targetDir, entry);
      if (stats.isDirectory()) {
        await mkdir(targetPath, { recursive: true });
      } else if (stats.isFile()) {
        await context.buildSupport.copyPathWithTemplateVariables(sourcePath, targetPath, context.templateContext);
      }
    }
  }
}

export async function stageAssets(
  context: IHarnessBuildContext,
  destinations: { skillsDir: string; commandsDir?: string },
): Promise<void> {
  if (destinations.commandsDir) {
    for (const name of context.commands.matchedNames) {
      const outputPath = join(destinations.commandsDir, name);
      // Native harness commands take precedence over reusable commands.
      if (existsSync(outputPath)) continue;
      await context.buildSupport.copyPathWithTemplateVariables(
        context.commands.sourcePaths[name]!, outputPath, context.templateContext,
      );
    }
  }
  const outputNames = new Set<string>();
  await mkdir(destinations.skillsDir, { recursive: true });
  for (const name of context.skills.matchedNames) {
    const sourceDir = context.skills.sourcePaths[name]!;
    const author = parseSkillAuthor(await Bun.file(join(sourceDir, "SKILL.md")).text());
    const outputName = getOutputSkillName(name, author);
    if (outputNames.has(outputName)) throw new Error(`Duplicate generated skill name: ${outputName}`);
    outputNames.add(outputName);
    const outputPath = join(destinations.skillsDir, outputName);
    await context.buildSupport.copyDirectoryWithTemplateVariables(sourceDir, outputPath, context.templateContext);
    const skillPath = join(outputPath, "SKILL.md");
    let content = await Bun.file(skillPath).text();
    if (outputName !== name) content = updateSkillName(content, outputName);
    if (context.skills.userSkillNames?.has(name) || isUserSkillPath(sourceDir)) {
      content = injectDisableModelInvocation(content);
    }
    await Bun.write(skillPath, content);
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
