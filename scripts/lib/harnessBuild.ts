import {
  chmod,
  copyFile,
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
const REGISTRY_IGNORE_FILE_NAME = ".registry-ignore";
const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);

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
};

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
