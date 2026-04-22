/**
 * OpenCode unified-output build plugin.
 *
 * Final output tree and canonical sources:
 *
 * .output/opencode/
 * |-- commands/                 <-- merged entries from selected `commands/` and `harnesses/opencode/commands/`
 * |-- skills/                   <-- merged entries from selected `skills/` and `harnesses/opencode/skills/`
 * |-- agents/
 * |   `-- <profile>.md          <-- `profiles/<profile>/profile.yaml|json`
 * |-- opencode.jsonc            <-- `harnesses/opencode/opencode.jsonc`
 * |-- dcp.jsonc                 <-- `harnesses/opencode/dcp.jsonc`
 * `-- package.json              <-- `harnesses/opencode/package.json`
 *
 * Build flow:
 *
 * - `stageProfile()` materializes profile agent markdown plus the selected canonical commands and skills
 *   into plugin-owned staging directories under `.output/`
 * - `finalizeOutput()` copies shipped harness files, merges staged canonical commands and skills into
 *   their canonical OpenCode directories, and copies staged profile agents into `.output/opencode/agents/`
 */
import { copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { dedentTemplate } from "@alexgorbatchev/dedent-string";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../../scripts/lib/harnessBuild";

const AGENT_STAGING_DIR_NAME = ".opencode-agents";
const COMMAND_STAGING_DIR_NAME = ".opencode-commands";
const SKILL_STAGING_DIR_NAME = ".opencode-skills";

function getAgentStagingDir(outputDir: string): string {
  return join(outputDir, AGENT_STAGING_DIR_NAME);
}

function getCommandStagingDir(outputDir: string): string {
  return join(outputDir, COMMAND_STAGING_DIR_NAME);
}

function getSkillStagingDir(outputDir: string): string {
  return join(outputDir, SKILL_STAGING_DIR_NAME);
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

  await rm(sourceDir, { recursive: true, force: true });
}

async function mergeStagedDir(
  sourceDir: string,
  destinationDir: string,
): Promise<void> {
  if (!existsSync(sourceDir)) {
    return;
  }

  await mergeDirectoryContents(sourceDir, destinationDir);
}

function createAgentMarkdown(context: IProfileBuildContext): string {
  const description = typeof context.manifest.description === "string"
    ? context.manifest.description
    : `Auto-generated agent persona for the ${context.profileName} profile`;

  const frontmatter: Record<string, unknown> = {
    description,
    mode: "primary",
  };

  if (context.manifest.tools && typeof context.manifest.tools === "object") {
    frontmatter.tools = context.manifest.tools;
  }

  const allowsAllSkills = Array.isArray(context.manifest.skills) &&
    context.manifest.skills.length === 1 &&
    context.manifest.skills[0] === "*";

  const permission: Record<string, string | Record<string, string>> = {
    skill: allowsAllSkills
      ? { "*": "allow" }
      : { "*": "deny" },
  };

  if (!allowsAllSkills) {
    const skillPermission = permission.skill;
    if (typeof skillPermission === "object" && skillPermission !== null) {
      for (const skill of context.matchedSkills) {
        skillPermission[skill] = "allow";
      }
    }
  }

  if (context.manifest.permission && typeof context.manifest.permission === "object") {
    for (const [permKey, permValue] of Object.entries(context.manifest.permission)) {
      if (permKey === "skill") {
        continue;
      }

      permission[permKey] = permValue;
    }
  }

  frontmatter.permission = permission;

  const systemPrompt = typeof context.manifest.system_prompt === "string"
    ? context.manifest.system_prompt
    : "";

  return dedentTemplate(
    `
      ---
      {frontmatter}
      ---
      {systemPrompt}
    `,
    {
      frontmatter: Bun.YAML.stringify(frontmatter, null, 2).trimEnd(),
      systemPrompt,
    },
  );
}

async function stageProfile(context: IProfileBuildContext): Promise<void> {
  const agentStagingDir = getAgentStagingDir(context.outputDir);
  const commandStagingDir = getCommandStagingDir(context.outputDir);
  const skillStagingDir = getSkillStagingDir(context.outputDir);

  await mkdir(agentStagingDir, { recursive: true });
  await writeFile(join(agentStagingDir, `${context.profileName}.md`), createAgentMarkdown(context), "utf-8");

  for (const matchedCommand of context.matchedCommands) {
    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.templateContext.commands_dir, matchedCommand),
      join(commandStagingDir, matchedCommand),
      context.templateContext,
    );
  }

  for (const matchedSkill of context.matchedSkills) {
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      join(skillStagingDir, matchedSkill),
      context.templateContext,
    );
  }
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const visibleOutputDir = join(context.outputDir, "opencode");
  const agentStagingDir = getAgentStagingDir(context.outputDir);
  const commandStagingDir = getCommandStagingDir(context.outputDir);
  const skillStagingDir = getSkillStagingDir(context.outputDir);

  try {
    await mkdir(visibleOutputDir, { recursive: true });
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      context.harnessDir,
      visibleOutputDir,
      context.templateContext,
    );

    await mergeStagedDir(commandStagingDir, join(visibleOutputDir, "commands"));
    await mergeStagedDir(skillStagingDir, join(visibleOutputDir, "skills"));

    if (!existsSync(agentStagingDir)) {
      return;
    }

    const agentOutputDir = join(visibleOutputDir, "agents");
    await mkdir(agentOutputDir, { recursive: true });

    const stagedAgents = await readdir(agentStagingDir, { withFileTypes: true });
    for (const stagedAgent of stagedAgents) {
      if (!stagedAgent.isFile()) {
        continue;
      }

      await copyFile(
        join(agentStagingDir, stagedAgent.name),
        join(agentOutputDir, stagedAgent.name),
      );
    }
  } finally {
    await rm(agentStagingDir, { recursive: true, force: true });
    await rm(commandStagingDir, { recursive: true, force: true });
    await rm(skillStagingDir, { recursive: true, force: true });
  }
}

const plugin: IUnifiedHarnessPlugin = {
  target: "opencode",
  stageProfile,
  finalizeOutput,
};

export default plugin;
