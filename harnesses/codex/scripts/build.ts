import { mkdir, readdir, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../../scripts/lib/harnessBuild";
import { createExternalProfileHelper } from "../../../scripts/lib/createExternalProfileHelper";
import { getProfileLocalCommandOutputName } from "../../../scripts/lib/profileLocalAssetNames";

const CODEX_OUTPUT_DIR_NAME = "codex";
const CODEX_MUTABLE_STATE_DIR_NAME = "codex";
const DEFAULT_PROFILE_NAME = "default";

function getProfileOutputDir(outputDir: string, profileName: string): string {
  return join(outputDir, CODEX_OUTPUT_DIR_NAME, profileName);
}

function getMutableCodexStateDir(repositoryRoot: string): string {
  return join(repositoryRoot, ".tmp", CODEX_MUTABLE_STATE_DIR_NAME);
}

function getMutableCodexConfigPath(repositoryRoot: string): string {
  return join(getMutableCodexStateDir(repositoryRoot), "config.toml");
}

function getMutableCodexAuthPath(repositoryRoot: string): string {
  return join(getMutableCodexStateDir(repositoryRoot), "auth.json");
}

async function seedMutableCodexConfig(context: IProfileBuildContext): Promise<string> {
  const mutableConfigPath = getMutableCodexConfigPath(context.templateContext.repo_root);
  if (existsSync(mutableConfigPath)) {
    return mutableConfigPath;
  }

  const sourceConfigPath = join(context.harnessDir, "config.toml");
  if (!existsSync(sourceConfigPath)) {
    throw new Error(`Codex harness config seed does not exist: ${sourceConfigPath}`);
  }

  await mkdir(getMutableCodexStateDir(context.templateContext.repo_root), { recursive: true });
  await context.buildSupport.copyPathWithTemplateVariables(sourceConfigPath, mutableConfigPath, context.templateContext);
  return mutableConfigPath;
}

async function stageMutableCodexState(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const mutableConfigPath = await seedMutableCodexConfig(context);
  const mutableAuthPath = getMutableCodexAuthPath(context.templateContext.repo_root);

  await mkdir(getMutableCodexStateDir(context.templateContext.repo_root), { recursive: true });
  await symlink(mutableConfigPath, join(profileOutputDir, "config.toml"));
  await symlink(mutableAuthPath, join(profileOutputDir, "auth.json"));
}

async function stageHarnessLocalSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, "skills");
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readdir(harnessSkillsDir, { withFileTypes: true });
  for (const harnessSkillEntry of harnessSkillEntries) {
    if (!harnessSkillEntry.isDirectory()) {
      throw new Error(
        `Codex harness skills must be directories: ${join(harnessSkillsDir, harnessSkillEntry.name)}`,
      );
    }

    const sourcePath = join(harnessSkillsDir, harnessSkillEntry.name);
    const outputPath = join(skillsDir, harnessSkillEntry.name);
    if (existsSync(outputPath)) {
      throw new Error(`Cannot stage Codex harness skill because the output path already exists: ${outputPath}`);
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      sourcePath,
      outputPath,
      context.templateContext,
    );
  }
}

async function stageProfileSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  for (const matchedSkill of context.globalMatchedSkills) {
    const outputPath = join(skillsDir, matchedSkill);
    if (existsSync(outputPath)) {
      continue;
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      outputPath,
      context.templateContext,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillsDir, profileLocalSkill);
    if (existsSync(outputPath)) {
      throw new Error(
        `Cannot stage profile-local skill ${profileLocalSkill} for profile ${context.profileName} because the output path already exists: ${outputPath}`,
      );
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.profileDir, "skills", profileLocalSkill),
      outputPath,
      context.templateContext,
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

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  const profileOutputDir = getProfileOutputDir(context.outputDir, context.profileName);
  const promptsDir = join(profileOutputDir, "prompts");
  const skillsDir = join(profileOutputDir, "skills");
  const isDefaultProfile = context.profileName === DEFAULT_PROFILE_NAME;

  await mkdir(skillsDir, { recursive: true });
  if (isDefaultProfile) {
    const renderedSystemPrompt = await renderSystemPrompt(context);
    await mkdir(promptsDir, { recursive: true });
    await stageMutableCodexState(context, profileOutputDir);

    if (renderedSystemPrompt.trim().length > 0) {
      await writeFile(join(profileOutputDir, "AGENTS.md"), `${renderedSystemPrompt.trim()}\n`, "utf-8");
    }

    await context.buildSupport.stageProfileAssets(context, {
      commandsDir: promptsDir,
      skillsDir,
      localCommandRenamer: getProfileLocalCommandOutputName,
    });
  } else {
    await stageProfileSkills(context, skillsDir);
  }

  await stageHarnessLocalSkills(context, skillsDir);
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const codexOutputDir = join(context.outputDir, CODEX_OUTPUT_DIR_NAME);
  const finalCodexOutputDir = join(context.templateContext.output_dir, CODEX_OUTPUT_DIR_NAME);
  if (!existsSync(codexOutputDir)) {
    return;
  }

  const profileEntries = await readdir(codexOutputDir, { withFileTypes: true });
  const defaultProfileOutputDir = getProfileOutputDir(context.outputDir, DEFAULT_PROFILE_NAME);
  if (!existsSync(defaultProfileOutputDir)) {
    throw new Error(`Generated Codex default profile does not exist: ${defaultProfileOutputDir}`);
  }

  const defaultProfileEntries = await readdir(defaultProfileOutputDir, { withFileTypes: true });
  for (const profileEntry of profileEntries) {
    if (!profileEntry.isDirectory()) {
      continue;
    }

    if (profileEntry.name !== DEFAULT_PROFILE_NAME) {
      const profileOutputDir = join(codexOutputDir, profileEntry.name);
      for (const defaultProfileEntry of defaultProfileEntries) {
        if (defaultProfileEntry.name === "skills") {
          continue;
        }

        await symlink(
          join(finalCodexOutputDir, DEFAULT_PROFILE_NAME, defaultProfileEntry.name),
          join(profileOutputDir, defaultProfileEntry.name),
        );
      }
    }

    const helperName = profileEntry.name === "default" ? "codex" : `codex-${profileEntry.name}`;
    const content = createExternalProfileHelper(
      "codex",
      "CODEX_HOME",
      `{{output_dir}}/${CODEX_OUTPUT_DIR_NAME}/${profileEntry.name}`,
    );
    await context.buildSupport.writeBinScript(context.outputDir, helperName, content);
  }
}

function getRequestedCodexProfile(argv: string[]): string | null {
  const overrideIndex = argv.indexOf("--codex-profile");
  if (overrideIndex === -1) {
    return null;
  }

  if (overrideIndex + 1 < argv.length) {
    const profileName = argv[overrideIndex + 1]?.trim() ?? "";
    if (profileName.length > 0) {
      return profileName;
    }
  }

  throw new Error("Missing Codex profile name after --codex-profile.");
}

async function getGeneratedCodexProfileNames(outputDir: string): Promise<string[]> {
  const codexOutputDir = join(outputDir, CODEX_OUTPUT_DIR_NAME);
  if (!existsSync(codexOutputDir)) {
    return [];
  }

  const profileEntries = await readdir(codexOutputDir, { withFileTypes: true });
  return profileEntries
    .filter((profileEntry) => profileEntry.isDirectory())
    .map((profileEntry) => profileEntry.name)
    .sort();
}

function formatMissingCodexProfileMessage(sourcePath: string, availableProfiles: string[]): string {
  if (availableProfiles.length === 0) {
    return `Generated Codex profile does not exist: ${sourcePath}. No generated Codex profiles are available.`;
  }

  return `Generated Codex profile does not exist: ${sourcePath}. Available generated Codex profiles: ${availableProfiles.join(", ")}.`;
}

async function getBootstrapTargets(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>> {
  const profile = getRequestedCodexProfile(process.argv) ?? "default";

  const sourcePath = getProfileOutputDir(outputDir, profile);

  if (!existsSync(sourcePath)) {
    const availableProfiles = await getGeneratedCodexProfileNames(outputDir);
    throw new Error(formatMissingCodexProfileMessage(sourcePath, availableProfiles));
  }

  return [
    {
      sourcePath,
      targetPath: process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"),
      description: `Codex home (${profile})`,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: CODEX_OUTPUT_DIR_NAME,
  stageProfile,
  finalizeOutput,
  getBootstrapTargets,
};

export default plugin;
