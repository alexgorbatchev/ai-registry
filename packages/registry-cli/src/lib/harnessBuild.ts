import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "fs/promises";
import { existsSync } from "fs";
import { dirname, isAbsolute, join, relative } from "path";

import { renderTemplate } from "@alexgorbatchev/template-resolver";
import walk from "ignore-walk";
import { resolveSkillVariant } from "./resolveSkillVariant";
import type { ISyncedSettingsFileOptions } from "./settingsSync/types";
import {
  getOutputSkillName,
  injectDisableModelInvocation,
  isUserSkillPath,
  parseSkillAuthor,
  readHarnessSkillEntries,
  updateSkillName,
} from "./userSkillUtils";
const REGISTRY_IGNORE_FILE_NAME = ".registry-ignore";
const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);

export type ITemplateContext = Record<string, string>;

interface ISourcePathByOutputPath extends Map<string, string> {
  sourceChecksums?: Map<string, string>;
}

export type IRegistryAssets = {
  skills: string[];
  skillSourcePaths: Record<string, string>;
  userSkillNames: Set<string>;
  commands: string[];
  commandSourcePaths: Record<string, string>;
};

export type IBuildSupport = {
  mergeDirectory(sourceDir: string, destDir: string, options?: { move?: boolean }): Promise<void>;
  stageRegistryAssets(
    context: IHarnessBuildContext,
    destinations: { skillsDir: string; commandsDir?: string },
  ): Promise<void>;
  stageHarnessSkills(context: IHarnessBuildContext, skillsDir: string): Promise<void>;
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
  harnessDir: string;
  overlayDirs: string[];
  outputDir: string;
  // Shared instructions each harness renders into its native memory file.
  systemPromptPath: string;
  assets: IRegistryAssets;
  templateContext: ITemplateContext;
  buildSupport: IBuildSupport;
};

// A harness home is a real directory outside the repository that holds the
// harness's runtime state; bootstrap links the generated output's managed
// entries into it. A link target replaces one path with a symlink.
export type IBootstrapTarget =
  | { kind: "home"; sourcePath: string; targetPath: string; description: string }
  | { kind: "link"; sourcePath: string; targetPath: string; description: string };

export type IUnifiedHarnessPlugin = {
  target: string;
  buildOutput(context: IHarnessBuildContext): Promise<void>;
  getBootstrapTargets?(outputDir: string): Promise<IBootstrapTarget[]>;
};

export function getObjectValue(object: object, key: string): unknown {
  return Reflect.get(object, key);
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
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  return renderTemplate({
    content,
    sourcePath,
    repositoryRoot: templateContext.repo_root,
    variables: templateContext,
    environment,
  });
}

function registerOriginalSourcePath(
  outputPath: string,
  sourcePath: string,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
): void {
  sourcePathByOutputPath?.set(outputPath, sourcePath);
}

function moveOriginalSourcePathForFile(
  currentOutputPath: string,
  nextOutputPath: string,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
  removeCurrentPath: boolean = true,
): void {
  if (!sourcePathByOutputPath) {
    return;
  }

  const originalSourcePath = sourcePathByOutputPath.get(currentOutputPath);
  if (originalSourcePath === undefined) {
    return;
  }

  sourcePathByOutputPath.set(nextOutputPath, originalSourcePath);
  if (removeCurrentPath) {
    sourcePathByOutputPath.delete(currentOutputPath);
  }
}

function moveOriginalSourcePathForDirectory(
  currentOutputDir: string,
  nextOutputDir: string,
  sourcePathByOutputPath?: ISourcePathByOutputPath,
): void {
  if (!sourcePathByOutputPath) {
    return;
  }

  const movedEntries: Array<{ currentOutputPath: string; nextOutputPath: string; originalSourcePath: string }> = [];
  for (const [currentOutputPath, originalSourcePath] of sourcePathByOutputPath.entries()) {
    const relativeOutputPath = relative(currentOutputDir, currentOutputPath);
    const isDescendantPath = relativeOutputPath.length > 0 && !relativeOutputPath.startsWith("..") && !isAbsolute(relativeOutputPath);

    if (!isDescendantPath) {
      continue;
    }

    movedEntries.push({
      currentOutputPath,
      nextOutputPath: join(nextOutputDir, relativeOutputPath),
      originalSourcePath,
    });
  }

  for (const movedEntry of movedEntries) {
    sourcePathByOutputPath.delete(movedEntry.currentOutputPath);
    sourcePathByOutputPath.set(movedEntry.nextOutputPath, movedEntry.originalSourcePath);
  }
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
  environment: NodeJS.ProcessEnv = process.env,
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
      await applyTemplateVariablesToGeneratedOutput(entryPath, templateContext, sourcePathByOutputPath, environment);
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
      environment,
    );

    if (renderedContent !== sourceContent) {
      await writeFile(entryPath, renderedContent, "utf-8");
    }
  }
}

export async function mergeDirectory(
  sourceDir: string,
  destinationDir: string,
  options: { move?: boolean } = {},
  sourcePathByOutputPath?: ISourcePathByOutputPath,
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
        await mergeDirectory(sourcePath, destinationPath, options, sourcePathByOutputPath);
        continue;
      }

      if (options.move) {
        moveOriginalSourcePathForDirectory(sourcePath, destinationPath, sourcePathByOutputPath);
        await rename(sourcePath, destinationPath);
      } else {
        await mergeDirectory(sourcePath, destinationPath, options, sourcePathByOutputPath);
      }
      continue;
    }

    if (existsSync(destinationPath)) {
      throw new Error(`Cannot merge generated output because destination already exists: ${destinationPath}`);
    }

    if (sourceEntry.isSymbolicLink()) {
      const target = await readlink(sourcePath);
      if (options.move) {
        await rename(sourcePath, destinationPath);
        moveOriginalSourcePathForFile(sourcePath, destinationPath, sourcePathByOutputPath);
      } else {
        await symlink(target, destinationPath);
        moveOriginalSourcePathForFile(sourcePath, destinationPath, sourcePathByOutputPath, false);
      }
      continue;
    }

    if (options.move) {
      await rename(sourcePath, destinationPath);
      moveOriginalSourcePathForFile(sourcePath, destinationPath, sourcePathByOutputPath);
    } else {
      await copyFile(sourcePath, destinationPath);
      moveOriginalSourcePathForFile(sourcePath, destinationPath, sourcePathByOutputPath, false);
    }
  }

  if (options.move) {
    await rm(sourceDir, { recursive: true, force: true });
  }
}

// Copies every registry skill and command into a harness output. Existing skill
// paths are skipped so harness-local skills staged first take precedence; an
// existing command path is a collision.
export async function stageRegistryAssets(
  context: IHarnessBuildContext,
  destinations: { skillsDir: string; commandsDir?: string },
): Promise<void> {
  const { commandsDir, skillsDir } = destinations;
  const { assets } = context;

  if (commandsDir) {
    for (const command of assets.commands) {
      const outputPath = join(commandsDir, command);
      if (existsSync(outputPath)) {
        throw new Error(`Cannot stage command ${command} because the output path already exists: ${outputPath}`);
      }
      await context.buildSupport.copyPathWithTemplateVariables(
        assets.commandSourcePaths[command] ?? join(context.templateContext.commands_dir, command),
        outputPath,
        context.templateContext,
      );
    }
  }

  for (const skill of assets.skills) {
    const sourceDir = assets.skillSourcePaths[skill] ?? join(context.templateContext.skills_dir, skill);
    const skillFilePath = join(sourceDir, "SKILL.md");
    let skillAuthor: string | null = null;
    if (existsSync(skillFilePath)) {
      const content = await readFile(skillFilePath, "utf-8");
      skillAuthor = parseSkillAuthor(content);
    }
    const outputSkillName = getOutputSkillName(skill, skillAuthor);
    const outputPath = join(skillsDir, outputSkillName);
    if (existsSync(outputPath)) continue;
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      sourceDir,
      outputPath,
      context.templateContext,
    );

    const generatedSkillFilePath = join(outputPath, "SKILL.md");
    if (existsSync(generatedSkillFilePath)) {
      let content = await readFile(generatedSkillFilePath, "utf-8");
      if (outputSkillName !== skill) {
        content = updateSkillName(content, outputSkillName);
      }
      if (assets.userSkillNames.has(skill) || isUserSkillPath(sourceDir)) {
        content = injectDisableModelInvocation(content);
      }
      await writeFile(generatedSkillFilePath, content, "utf-8");
    }
  }
}

// Copies harness-only skills from `harnesses/<target>/skills/` into a harness
// output, replacing any skill already staged under the same output name.
export async function stageHarnessSkills(context: IHarnessBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, "skills");
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readHarnessSkillEntries(harnessSkillsDir);
  for (const harnessSkillEntry of harnessSkillEntries) {
    const skillFilePath = join(harnessSkillEntry.sourcePath, "SKILL.md");
    let skillAuthor: string | null = null;
    if (existsSync(skillFilePath)) {
      const content = await readFile(skillFilePath, "utf-8");
      skillAuthor = parseSkillAuthor(content);
    }
    const outputSkillName = getOutputSkillName(harnessSkillEntry.name, skillAuthor);
    const outputPath = join(skillsDir, outputSkillName);
    if (existsSync(outputPath)) {
      await rm(outputPath, { recursive: true, force: true });
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      harnessSkillEntry.sourcePath,
      outputPath,
      context.templateContext,
    );

    const generatedSkillFilePath = join(outputPath, "SKILL.md");
    if (existsSync(generatedSkillFilePath)) {
      let content = await readFile(generatedSkillFilePath, "utf-8");
      if (outputSkillName !== harnessSkillEntry.name) {
        content = updateSkillName(content, outputSkillName);
      }
      if (harnessSkillEntry.isUser) {
        content = injectDisableModelInvocation(content);
      }
      await writeFile(generatedSkillFilePath, content, "utf-8");
    }
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
