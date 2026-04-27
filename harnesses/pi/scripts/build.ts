import { copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../../scripts/lib/harnessBuild";
import {
  assertMissingPiOutputPath,
  assertSupportedPiManifest,
} from "./lib/profileOutputRules";

const PROFILE_STAGING_DIR_NAME = ".pi-profiles";
const APPEND_SYSTEM_FILE_NAME = "APPEND_SYSTEM.md";

function getProfileStagingRoot(outputDir: string): string {
  return join(outputDir, PROFILE_STAGING_DIR_NAME);
}

function getProfileStagingDir(outputDir: string, profileName: string): string {
  return join(getProfileStagingRoot(outputDir), profileName);
}

async function mergeDirectoryContents(sourceDir: string, destinationDir: string): Promise<void> {
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

        await mergeDirectoryContents(sourcePath, destinationPath);
        continue;
      }

      await rename(sourcePath, destinationPath);
      continue;
    }

    if (existsSync(destinationPath)) {
      throw new Error(`Cannot merge generated output because destination already exists: ${destinationPath}`);
    }

    await rename(sourcePath, destinationPath);
  }

  await rm(sourceDir, { force: true, recursive: true });
}

async function mergeStagedDir(sourceDir: string, destinationDir: string): Promise<void> {
  if (!existsSync(sourceDir)) {
    return;
  }

  await mergeDirectoryContents(sourceDir, destinationDir);
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  assertSupportedPiManifest(context.manifest, context.profileName);

  const profileStagingDir = getProfileStagingDir(context.outputDir, context.profileName);
  const promptsOutputDir = join(profileStagingDir, "prompts");
  const skillsOutputDir = join(profileStagingDir, "skills");

  await mkdir(profileStagingDir, { recursive: true });

  const systemPrompt = typeof context.manifest.system_prompt === "string"
    ? context.manifest.system_prompt.trim()
    : "";
  if (systemPrompt.length > 0) {
    await writeFile(join(profileStagingDir, APPEND_SYSTEM_FILE_NAME), `${systemPrompt}\n`, "utf-8");
  }

  for (const matchedCommand of context.globalMatchedCommands) {
    const outputPath = join(promptsOutputDir, matchedCommand);
    assertMissingPiOutputPath(outputPath, `global command ${matchedCommand} for profile ${context.profileName}`);

    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.templateContext.commands_dir, matchedCommand),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalCommand of context.profileLocalCommands) {
    const outputPath = join(promptsOutputDir, profileLocalCommand);
    assertMissingPiOutputPath(outputPath, `profile-local command ${profileLocalCommand} for profile ${context.profileName}`);

    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.profileDir, "commands", profileLocalCommand),
      outputPath,
      context.templateContext,
    );
  }

  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsOutputDir, matchedSkill);
    assertMissingPiOutputPath(outputPath, `global skill ${matchedSkill} for profile ${context.profileName}`);

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsOutputDir, profileLocalSkill);
    assertMissingPiOutputPath(outputPath, `profile-local skill ${profileLocalSkill} for profile ${context.profileName}`);

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.profileDir, "skills", profileLocalSkill),
      outputPath,
      context.templateContext,
    );
  }
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const profileStagingRoot = getProfileStagingRoot(context.outputDir);
  const visibleOutputDir = join(context.outputDir, "pi", "profiles");

  try {
    await mkdir(visibleOutputDir, { recursive: true });

    if (!existsSync(profileStagingRoot)) {
      return;
    }

    const stagedProfiles = await readdir(profileStagingRoot, { withFileTypes: true });
    for (const stagedProfile of stagedProfiles) {
      if (!stagedProfile.isDirectory()) {
        continue;
      }

      const stagedProfileDir = join(profileStagingRoot, stagedProfile.name);
      const visibleProfileDir = join(visibleOutputDir, stagedProfile.name);
      await mkdir(visibleProfileDir, { recursive: true });

      await context.buildSupport.copyDirectoryWithTemplateVariables(
        join(context.harnessDir, "agent"),
        visibleProfileDir,
        context.templateContext,
      );

      await mergeStagedDir(join(stagedProfileDir, "prompts"), join(visibleProfileDir, "prompts"));
      await mergeStagedDir(join(stagedProfileDir, "skills"), join(visibleProfileDir, "skills"));

      const stagedAppendSystemPath = join(stagedProfileDir, APPEND_SYSTEM_FILE_NAME);
      if (existsSync(stagedAppendSystemPath)) {
        await copyFile(stagedAppendSystemPath, join(visibleProfileDir, APPEND_SYSTEM_FILE_NAME));
      }
    }
  } finally {
    await rm(profileStagingRoot, { force: true, recursive: true });
  }
}

const plugin: IUnifiedHarnessPlugin = {
  finalizeOutput,
  stageProfile,
  target: "pi",
};

export default plugin;
