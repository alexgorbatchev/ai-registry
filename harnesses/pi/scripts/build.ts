import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, relative } from "path";
import { homedir } from "os";

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
      await mergeDirectoryContents(sourcePath, destinationPath);
      continue;
    }

    if (existsSync(destinationPath)) {
      throw new Error(`Cannot merge generated output because destination already exists: ${destinationPath}`);
    }

    await copyFile(sourcePath, destinationPath);
  }
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

async function generatePiHelpers(context: IUnifiedHarnessBuildContext, profiles: string[]): Promise<void> {
  const binDir = join(context.outputDir, "bin");
  await mkdir(binDir, { recursive: true });

  const piProfileHelperPath = join(context.harnessDir, "templates", "pi-profile-helper.sh");
  const piInstallPath = join(context.harnessDir, "templates", "pi-install.sh");
  const piUninstallPath = join(context.harnessDir, "templates", "pi-uninstall.sh");
  const piUpdatePath = join(context.harnessDir, "templates", "pi-update.sh");

  const template = await readFile(piProfileHelperPath, "utf-8");
  const installTemplate = await readFile(piInstallPath, "utf-8");
  const uninstallTemplate = await readFile(piUninstallPath, "utf-8");
  const updateTemplate = await readFile(piUpdatePath, "utf-8");

  for (const profile of profiles) {
    const helperName = `pi-${profile}`;
    const helperPath = join(binDir, helperName);
    
    // Replace {{profile}} with the actual profile name.
    // We leave {{output_dir}} untouched so it gets expanded by the general template expansion pass.
    const content = template.replace(/\{\{profile\}\}/g, profile);
    
    await writeFile(helperPath, content, { mode: 0o755 });
  }

  // Add pi-install, pi-uninstall, and pi-update helpers
  const piInstallBinPath = join(binDir, "pi-install");
  await writeFile(piInstallBinPath, installTemplate, { mode: 0o755 });

  const piUninstallBinPath = join(binDir, "pi-uninstall");
  await writeFile(piUninstallBinPath, uninstallTemplate, { mode: 0o755 });

  const piUpdateBinPath = join(binDir, "pi-update");
  await writeFile(piUpdateBinPath, updateTemplate, { mode: 0o755 });
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const profileStagingRoot = getProfileStagingRoot(context.outputDir);
  const visibleOutputDir = join(context.outputDir, "pi");
  const masterSettingsPath = join(context.harnessDir, "settings.json");

  try {
    await mkdir(visibleOutputDir, { recursive: true });

    if (!existsSync(profileStagingRoot)) {
      return;
    }

    const stagedProfiles = await readdir(profileStagingRoot, { withFileTypes: true });
    const profileNames: string[] = [];

    for (const stagedProfile of stagedProfiles) {
      if (!stagedProfile.isDirectory()) {
        continue;
      }

      profileNames.push(stagedProfile.name);
      const stagedProfileDir = join(profileStagingRoot, stagedProfile.name);
      const visibleProfileDir = join(visibleOutputDir, stagedProfile.name);
      await mkdir(visibleProfileDir, { recursive: true });

      // Copy master settings.json to the profile directory
      await copyFile(masterSettingsPath, join(visibleProfileDir, "settings.json"));

      await mergeStagedDir(join(stagedProfileDir, "prompts"), join(visibleProfileDir, "prompts"));
      await mergeStagedDir(join(stagedProfileDir, "skills"), join(visibleProfileDir, "skills"));

      // Merge harness-local prompts and skills
      await mergeStagedDir(join(context.harnessDir, "prompts"), join(visibleProfileDir, "prompts"));
      await mergeStagedDir(join(context.harnessDir, "skills"), join(visibleProfileDir, "skills"));

      const stagedAppendSystemPath = join(stagedProfileDir, APPEND_SYSTEM_FILE_NAME);
      if (existsSync(stagedAppendSystemPath)) {
        await copyFile(stagedAppendSystemPath, join(visibleProfileDir, APPEND_SYSTEM_FILE_NAME));
      }

      // Link sessions directory to central harnesses/pi/sessions
      const sessionsTargetDir = join(context.harnessDir, "sessions");
      await mkdir(sessionsTargetDir, { recursive: true });
      await symlink(sessionsTargetDir, join(visibleProfileDir, "sessions"));
    }

    await generatePiHelpers(context, profileNames);
  } finally {
    await rm(profileStagingRoot, { force: true, recursive: true });
  }
}

async function getBootstrapTargets(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>> {
  let profile = "default";
  const overrideIndex = process.argv.indexOf("--pi-profile");
  if (overrideIndex !== -1 && overrideIndex + 1 < process.argv.length) {
    profile = process.argv[overrideIndex + 1];
  }

  const sourcePath = join(outputDir, "pi", profile);
  if (!existsSync(sourcePath)) {
    throw new Error(`Generated Pi profile does not exist: ${sourcePath}`);
  }

  return [
    {
      sourcePath,
      targetPath: process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent"),
      description: `Pi config (${profile})`,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  finalizeOutput,
  stageProfile,
  getBootstrapTargets,
  target: "pi",
};

export default plugin;
