import { copyFile, mkdir, readdir, rm, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parseArgs } from "node:util";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../lib/harnessBuild";
import { createExternalProfileHelper } from "../../lib/createExternalProfileHelper";
import { assertSupportedPiManifest } from "./lib/profileOutputRules";

const PROFILE_STAGING_DIR_NAME = ".pi-profiles";
const APPEND_SYSTEM_FILE_NAME = "APPEND_SYSTEM.md";
const DEFAULT_PROFILE_NAME = "default";

function getProfileStagingRoot(outputDir: string): string {
  return join(outputDir, PROFILE_STAGING_DIR_NAME);
}

function getProfileStagingDir(outputDir: string, profileName: string): string {
  return join(getProfileStagingRoot(outputDir), profileName);
}

async function stageProfileSkills(context: IProfileBuildContext, skillsOutputDir: string): Promise<void> {
  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsOutputDir, matchedSkill);
    if (existsSync(outputPath)) {
      continue;
    }
    await context.buildSupport.symlinkDirectoryWithOriginalFiles(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsOutputDir, profileLocalSkill);
    if (existsSync(outputPath)) {
      throw new Error(
        `Cannot stage profile-local skill ${profileLocalSkill} for profile ${context.profileName} because the output path already exists: ${outputPath}`,
      );
    }
    await context.buildSupport.symlinkDirectoryWithOriginalFiles(
      join(context.profileDir, "skills", profileLocalSkill),
      outputPath,
    );
  }
}

async function renderSystemPrompt(context: IProfileBuildContext): Promise<string> {
  const systemPrompt = typeof context.manifest.system_prompt === "string"
    ? context.manifest.system_prompt
    : "";

  if (systemPrompt.trim().length === 0) {
    return "";
  }

  return renderTemplate({
    content: systemPrompt,
    sourcePath: join(context.profileDir, "profile.yaml"),
    repositoryRoot: context.templateContext.repo_root,
    variables: context.templateContext,
    environment: process.env,
  });
}

async function stageProfileAppendSystemFile(context: IProfileBuildContext, profileStagingDir: string): Promise<void> {
  const renderedSystemPrompt = await renderSystemPrompt(context);
  if (renderedSystemPrompt.trim().length === 0) {
    return;
  }

  await writeFile(join(profileStagingDir, APPEND_SYSTEM_FILE_NAME), `${renderedSystemPrompt.trim()}\n`, "utf-8");
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  assertSupportedPiManifest(context.manifest, context.profileName);

  const profileStagingDir = getProfileStagingDir(context.outputDir, context.profileName);
  const skillsOutputDir = join(profileStagingDir, "skills");
  const isDefaultProfile = context.profileName === DEFAULT_PROFILE_NAME;

  await mkdir(profileStagingDir, { recursive: true });
  await stageProfileAppendSystemFile(context, profileStagingDir);

  if (isDefaultProfile) {
    const promptsOutputDir = join(profileStagingDir, "prompts");

    await context.buildSupport.stageProfileAssets(context, {
      commandsDir: promptsOutputDir,
      skillsDir: skillsOutputDir,
    });
    return;
  }

  await stageProfileSkills(context, skillsOutputDir);
}

async function generatePiHelpers(context: IUnifiedHarnessBuildContext, profiles: string[]): Promise<void> {
  const piInstallPath = join(context.harnessDir, "templates", "pi-install.sh");
  const piUninstallPath = join(context.harnessDir, "templates", "pi-uninstall.sh");
  const piUpdatePath = join(context.harnessDir, "templates", "pi-update.sh");

  const installTemplate = await import("fs/promises").then(m => m.readFile(piInstallPath, "utf-8"));
  const uninstallTemplate = await import("fs/promises").then(m => m.readFile(piUninstallPath, "utf-8"));
  const updateTemplate = await import("fs/promises").then(m => m.readFile(piUpdatePath, "utf-8"));

  for (const profile of profiles) {
    const helperName = profile === "default" ? "pi" : `pi-${profile}`;
    const content = createExternalProfileHelper("pi", "PI_CODING_AGENT_DIR", `{{output_dir}}/pi/${profile}`);

    await context.buildSupport.writeBinScript(context.outputDir, helperName, content);
  }

  await context.buildSupport.writeBinScript(context.outputDir, "pi-install", installTemplate);
  await context.buildSupport.writeBinScript(context.outputDir, "pi-uninstall", uninstallTemplate);
  await context.buildSupport.writeBinScript(context.outputDir, "pi-update", updateTemplate);
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const profileStagingRoot = getProfileStagingRoot(context.outputDir);
  const visibleOutputDir = join(context.outputDir, "pi");
  const finalVisibleOutputDir = join(context.templateContext.output_dir, "pi");
  const masterSettingsPath = join(context.harnessDir, "settings.json");

  try {
    await mkdir(visibleOutputDir, { recursive: true });

    if (!existsSync(profileStagingRoot)) {
      return;
    }

    const stagedProfiles = await readdir(profileStagingRoot, { withFileTypes: true });
    const stagedProfileNames = stagedProfiles
      .filter((stagedProfile) => stagedProfile.isDirectory())
      .map((stagedProfile) => stagedProfile.name);
    const defaultProfileDir = join(visibleOutputDir, DEFAULT_PROFILE_NAME);
    if (!stagedProfileNames.includes(DEFAULT_PROFILE_NAME)) {
      throw new Error(`Generated Pi default profile does not exist: ${defaultProfileDir}`);
    }

    const profileNames: string[] = [];
    const nonDefaultProfileDirs: string[] = [];

    for (const stagedProfile of stagedProfiles) {
      if (!stagedProfile.isDirectory()) continue;

      profileNames.push(stagedProfile.name);
      const stagedProfileDir = join(profileStagingRoot, stagedProfile.name);
      const visibleProfileDir = join(visibleOutputDir, stagedProfile.name);
      const isDefaultProfile = stagedProfile.name === DEFAULT_PROFILE_NAME;
      await mkdir(visibleProfileDir, { recursive: true });

      await context.buildSupport.mergeDirectory(join(stagedProfileDir, "skills"), join(visibleProfileDir, "skills"));
      const harnessSkillsDir = join(context.harnessDir, "skills");
      if (existsSync(harnessSkillsDir)) {
        const harnessSkillEntries = await readdir(harnessSkillsDir, { withFileTypes: true });
        for (const entry of harnessSkillEntries) {
          if (!entry.isDirectory()) continue;
          await context.buildSupport.symlinkDirectoryWithOriginalFiles(
            join(harnessSkillsDir, entry.name),
            join(visibleProfileDir, "skills", entry.name),
          );
        }
      }

      const stagedAppendSystemPath = join(stagedProfileDir, APPEND_SYSTEM_FILE_NAME);
      if (existsSync(stagedAppendSystemPath)) {
        await context.buildSupport.copyPathWithTemplateVariables(
          stagedAppendSystemPath,
          join(visibleProfileDir, APPEND_SYSTEM_FILE_NAME),
          context.templateContext,
        );
      }

      if (isDefaultProfile) {
        await context.buildSupport.copyPathWithTemplateVariables(
          masterSettingsPath,
          join(visibleProfileDir, "settings.json"),
          context.templateContext,
        );
        const masterModelsPath = join(context.harnessDir, "models.json");
        if (existsSync(masterModelsPath)) {
          await context.buildSupport.copyPathWithTemplateVariables(
            masterModelsPath,
            join(visibleProfileDir, "models.json"),
            context.templateContext,
          );
        }
        const masterWebSearchPath = join(context.harnessDir, "web-search.json");
        if (existsSync(masterWebSearchPath)) {
          await context.buildSupport.copyPathWithTemplateVariables(
            masterWebSearchPath,
            join(visibleProfileDir, "web-search.json"),
            context.templateContext,
          );
        }
        await context.buildSupport.mergeDirectory(join(stagedProfileDir, "prompts"), join(visibleProfileDir, "prompts"));
        await context.buildSupport.mergeDirectory(join(context.harnessDir, "prompts"), join(visibleProfileDir, "prompts"));

        await mkdir(join(visibleProfileDir, "sessions"), { recursive: true });
        continue;
      }

      nonDefaultProfileDirs.push(visibleProfileDir);
    }

    const defaultProfileEntries = await readdir(defaultProfileDir, { withFileTypes: true });
    for (const nonDefaultProfileDir of nonDefaultProfileDirs) {
      for (const defaultProfileEntry of defaultProfileEntries) {
        if (defaultProfileEntry.name === "skills" || defaultProfileEntry.name === APPEND_SYSTEM_FILE_NAME) {
          continue;
        }

        await symlink(
          join(finalVisibleOutputDir, DEFAULT_PROFILE_NAME, defaultProfileEntry.name),
          join(nonDefaultProfileDir, defaultProfileEntry.name),
        );
      }
    }

    await generatePiHelpers(context, profileNames);
  } finally {
    await rm(profileStagingRoot, { force: true, recursive: true });
  }
}

function getRequestedPiProfile(argv: string[]): string | null {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      "pi-profile": { type: "string" },
    },
    strict: false,
  });

  const value = values["pi-profile"];
  if (value === true || (typeof value === "string" && value.trim().length === 0)) {
    throw new Error("Missing Pi profile name after --pi-profile.");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return null;
}

async function getGeneratedPiProfileNames(outputDir: string): Promise<string[]> {
  const piOutputDir = join(outputDir, "pi");
  if (!existsSync(piOutputDir)) {
    return [];
  }

  const profileEntries = await readdir(piOutputDir, { withFileTypes: true });
  return profileEntries
    .filter((profileEntry) => profileEntry.isDirectory())
    .map((profileEntry) => profileEntry.name)
    .sort();
}

function formatMissingPiProfileMessage(sourcePath: string, availableProfiles: string[]): string {
  if (availableProfiles.length === 0) {
    return `Generated Pi profile does not exist: ${sourcePath}. No generated Pi profiles are available.`;
  }
  return `Generated Pi profile does not exist: ${sourcePath}. Available generated Pi profiles: ${availableProfiles.join(", ")}.`;
}

async function getBootstrapTargets(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>> {
  const profile = getRequestedPiProfile(process.argv) ?? DEFAULT_PROFILE_NAME;

  const sourcePath = join(outputDir, "pi", profile);
  if (!existsSync(sourcePath)) {
    const availableProfiles = await getGeneratedPiProfileNames(outputDir);
    throw new Error(formatMissingPiProfileMessage(sourcePath, availableProfiles));
  }

  const targets = [
    {
      sourcePath,
      targetPath: process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent"),
      description: `Pi config (${profile})`,
    },
  ];

  const webSearchSource = join(sourcePath, "web-search.json");
  if (existsSync(webSearchSource)) {
    targets.push({
      sourcePath: webSearchSource,
      targetPath: join(homedir(), ".pi", "web-search.json"),
      description: "Pi web search config",
    });
  }

  return targets;
}

const plugin: IUnifiedHarnessPlugin = {
  finalizeOutput,
  stageProfile,
  getBootstrapTargets,
  target: "pi",
};

export default plugin;
