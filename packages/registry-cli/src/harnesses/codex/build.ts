import { mkdir, readFile, readdir, rm, symlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "node:util";

import { renderTemplate } from "@alexgorbatchev/template-resolver";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../lib/harnessBuild";
import { createExternalProfileHelper } from "../../lib/createExternalProfileHelper";
import { getProfileLocalCommandOutputName } from "../../lib/profileLocalAssetNames";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";
import { injectDisableModelInvocation, readHarnessSkillEntries } from "../../lib/userSkillUtils";
import { getCommandSkillName } from "./getCommandSkillName";

const CODEX_OUTPUT_DIR_NAME = "codex";
const CODEX_MUTABLE_STATE_DIR_NAME = "codex";
const DEFAULT_PROFILE_NAME = "default";
const COMMAND_SKILLS_STAGING_DIR_NAME = ".codex-command-skills";

// Directories Codex writes runtime state into. They are materialized in the default
// profile root so every generated profile shares them, then owned by Codex.
const CODEX_RUNTIME_DIR_NAMES = [".tmp", "log", "sessions"];

function getProfileOutputDir(outputDir: string, profileName: string): string {
  return join(outputDir, CODEX_OUTPUT_DIR_NAME, profileName);
}

function getMutableCodexStateDir(repositoryRoot: string): string {
  return join(repositoryRoot, ".tmp", CODEX_MUTABLE_STATE_DIR_NAME);
}

function getMutableCodexConfigPath(repositoryRoot: string): string {
  return join(getMutableCodexStateDir(repositoryRoot), "config.toml");
}

async function renderCodexConfigSeed(context: IProfileBuildContext): Promise<string> {
  const sourceConfigPath = join(context.harnessDir, "config.toml");
  if (!existsSync(sourceConfigPath)) {
    throw new Error(`Codex harness config seed does not exist: ${sourceConfigPath}`);
  }

  const sourceConfigText = await readFile(sourceConfigPath, "utf-8");
  return renderTemplate({
    content: sourceConfigText,
    sourcePath: sourceConfigPath,
    repositoryRoot: context.templateContext.repo_root,
    variables: context.templateContext,
    environment: process.env,
  });
}

async function seedMutableCodexConfig(context: IProfileBuildContext): Promise<string> {
  const mutableConfigPath = getMutableCodexConfigPath(context.templateContext.repo_root);
  const sourceConfigText = await renderCodexConfigSeed(context);

  await mkdir(getMutableCodexStateDir(context.templateContext.repo_root), { recursive: true });
  
  if (!existsSync(mutableConfigPath)) {
    await writeFile(mutableConfigPath, sourceConfigText, "utf-8");
  }

  return mutableConfigPath;
}

async function stageMutableCodexState(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const mutableConfigPath = await seedMutableCodexConfig(context);

  await mkdir(getMutableCodexStateDir(context.templateContext.repo_root), { recursive: true });
  await symlink(mutableConfigPath, join(profileOutputDir, "config.toml"));
}

async function stageHarnessRules(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const harnessRulesDir = join(context.harnessDir, "rules");
  if (!existsSync(harnessRulesDir)) {
    return;
  }

  await context.buildSupport.copyDirectoryWithTemplateVariables(
    harnessRulesDir,
    join(profileOutputDir, "rules"),
    context.templateContext,
  );
}

async function stageHarnessLocalSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  const harnessSkillsDir = join(context.harnessDir, "skills");
  if (!existsSync(harnessSkillsDir)) {
    return;
  }

  const harnessSkillEntries = await readHarnessSkillEntries(harnessSkillsDir);
  for (const harnessSkillEntry of harnessSkillEntries) {
    const outputPath = join(skillsDir, harnessSkillEntry.name);
    if (existsSync(outputPath)) {
      await rm(outputPath, { recursive: true, force: true });
    }

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      harnessSkillEntry.sourcePath,
      outputPath,
      context.templateContext,
    );

    if (harnessSkillEntry.isUser) {
      const skillFilePath = join(outputPath, "SKILL.md");
      if (existsSync(skillFilePath)) {
        const content = await readFile(skillFilePath, "utf-8");
        const injected = injectDisableModelInvocation(content);
        if (injected !== content) {
          await writeFile(skillFilePath, injected, "utf-8");
        }
      }
    }
  }
}

async function stageProfileSkills(context: IProfileBuildContext, skillsDir: string): Promise<void> {
  await context.buildSupport.stageProfileAssets(context, { skillsDir });
}

async function stageCommandSkill(
  context: IProfileBuildContext,
  commandFileName: string,
  sourcePath: string,
): Promise<void> {
  const content = await Bun.file(sourcePath).text();
  const skillName = getCommandSkillName(commandFileName, content);
  const skillDir = join(context.outputDir, COMMAND_SKILLS_STAGING_DIR_NAME, skillName);
  if (existsSync(skillDir)) {
    throw new Error(`Duplicate Codex command skill name: ${skillName}`);
  }

  await context.buildSupport.copyPathWithTemplateVariables(
    sourcePath,
    join(skillDir, "SKILL.md"),
    context.templateContext,
  );
  await mkdir(join(skillDir, "agents"), { recursive: true });
  await Bun.write(join(skillDir, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
}

async function stageCommandSkills(context: IProfileBuildContext): Promise<void> {
  for (const command of context.globalMatchedCommands) {
    const sourcePath = context.globalCommandSourcePaths?.[command] ?? join(context.templateContext.commands_dir, command);
    await stageCommandSkill(context, command, sourcePath);
  }
  for (const command of context.profileLocalCommands) {
    await stageCommandSkill(
      context,
      getProfileLocalCommandOutputName(context.profileName, command),
      join(context.profileDir, "commands", command),
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

async function stageProfileAgentsFile(context: IProfileBuildContext, profileOutputDir: string): Promise<void> {
  const renderedSystemPrompt = await renderSystemPrompt(context);
  if (renderedSystemPrompt.trim().length === 0) {
    return;
  }

  await writeFile(join(profileOutputDir, "AGENTS.md"), `${renderedSystemPrompt.trim()}\n`, "utf-8");
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  const profileOutputDir = getProfileOutputDir(context.outputDir, context.profileName);
  const skillsDir = join(profileOutputDir, "skills");
  const isDefaultProfile = context.profileName === DEFAULT_PROFILE_NAME;

  await mkdir(skillsDir, { recursive: true });
  await stageProfileAgentsFile(context, profileOutputDir);

  if (isDefaultProfile) {
    // Codex-owned runtime state, shared by every generated profile through the
    // default root: created here, never tracked by the manifest.
    for (const runtimeDirName of CODEX_RUNTIME_DIR_NAMES) {
      await context.buildSupport.ensureRuntimeDirectory(join(profileOutputDir, runtimeDirName));
    }
    await stageMutableCodexState(context, profileOutputDir);
    await stageHarnessRules(context, profileOutputDir);
    await stageHarnessLocalSkills(context, skillsDir);

    await stageProfileSkills(context, skillsDir);
    await stageCommandSkills(context);
  } else {
    await stageHarnessLocalSkills(context, skillsDir);
    await stageProfileSkills(context, skillsDir);
  }
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
  const commandSkillsDir = join(context.outputDir, COMMAND_SKILLS_STAGING_DIR_NAME);
  const commandSkillNames = existsSync(commandSkillsDir) ? await readdir(commandSkillsDir) : [];
  for (const profileEntry of profileEntries) {
    if (!profileEntry.isDirectory()) {
      continue;
    }

    const profileSkillsDir = join(codexOutputDir, profileEntry.name, "skills");
    for (const skillName of commandSkillNames) {
      if (existsSync(join(profileSkillsDir, skillName))) {
        throw new Error(`Codex command skill ${skillName} collides with a skill in profile ${profileEntry.name}.`);
      }
    }
    await context.buildSupport.mergeDirectory(commandSkillsDir, profileSkillsDir);

    if (profileEntry.name !== DEFAULT_PROFILE_NAME) {
      const profileOutputDir = join(codexOutputDir, profileEntry.name);
      for (const defaultProfileEntry of defaultProfileEntries) {
        if (defaultProfileEntry.name === "skills" || defaultProfileEntry.name === "AGENTS.md") {
          continue;
        }

        const targetPath = join(profileOutputDir, defaultProfileEntry.name);
        if (existsSync(targetPath)) {
          continue;
        }

        await symlink(
          join(finalCodexOutputDir, DEFAULT_PROFILE_NAME, defaultProfileEntry.name),
          targetPath,
        );
      }
    }

    // The default profile is reached through the `${CODEX_HOME:-~/.codex}` symlink that
    // bootstrap creates, so only non-default profiles need a launcher that overrides
    // CODEX_HOME. Nothing generated here shadows the real `codex` binary.
    if (profileEntry.name === DEFAULT_PROFILE_NAME) {
      continue;
    }

    const content = createExternalProfileHelper(
      "codex",
      "CODEX_HOME",
      `{{output_dir}}/${CODEX_OUTPUT_DIR_NAME}/${profileEntry.name}`,
    );
    await context.buildSupport.writeBinScript(context.outputDir, `codex-${profileEntry.name}`, content);
  }

  await rm(commandSkillsDir, { recursive: true, force: true });
  await logHarnessSkillOverrides(context, "codex");
}

function getRequestedCodexProfile(argv: string[]): string | null {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      "codex-profile": { type: "string" },
    },
    strict: false,
  });

  const value = values["codex-profile"];
  if (value === true || (typeof value === "string" && value.trim().length === 0)) {
    throw new Error("Missing Codex profile name after --codex-profile.");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return null;
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
