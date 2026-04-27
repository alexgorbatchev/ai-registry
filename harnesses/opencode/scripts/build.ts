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
import { homedir } from "os";
import { dedentTemplate } from "@alexgorbatchev/dedent-string";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../../scripts/lib/harnessBuild";
import {
  createSkillPermission,
  getProfileLocalCommandOutputName,
} from "./lib/profileLocalAssetRules";

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

function assertMissingOutputPath(outputPath: string, assetDescription: string): void {
  if (existsSync(outputPath)) {
    throw new Error(`Cannot stage ${assetDescription} because the output path already exists: ${outputPath}`);
  }
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

  const permission: Record<string, string | Record<string, string>> = {
    skill: createSkillPermission(
      context.globalMatchedSkills,
      context.profileLocalSkills,
    ),
  };

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

  for (const matchedCommand of context.globalMatchedCommands) {
    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.templateContext.commands_dir, matchedCommand),
      join(commandStagingDir, matchedCommand),
      context.templateContext,
    );
  }

  for (const profileLocalCommand of context.profileLocalCommands) {
    const outputName = getProfileLocalCommandOutputName(context.profileName, profileLocalCommand);
    const outputPath = join(commandStagingDir, outputName);
    assertMissingOutputPath(outputPath, `profile-local command ${profileLocalCommand} for profile ${context.profileName}`);

    await context.buildSupport.copyPathWithTemplateVariables(
      join(context.profileDir, "commands", profileLocalCommand),
      outputPath,
      context.templateContext,
    );
  }

  for (const matchedSkill of context.globalMatchedSkills) {
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.templateContext.skills_dir, matchedSkill),
      join(skillStagingDir, matchedSkill),
      context.templateContext,
    );
  }

  for (const profileLocalSkill of context.profileLocalSkills) {
    const outputPath = join(skillStagingDir, profileLocalSkill);
    assertMissingOutputPath(outputPath, `profile-local skill ${profileLocalSkill} for profile ${context.profileName}`);

    await context.buildSupport.copyDirectoryWithTemplateVariables(
      join(context.profileDir, "skills", profileLocalSkill),
      outputPath,
      context.templateContext,
    );
  }
}

async function generateAirHelpers(context: IUnifiedHarnessBuildContext): Promise<void> {
  const binDir = join(context.outputDir, "bin");
  await mkdir(binDir, { recursive: true });

  const helpers = [
    {
      name: "air-opencode-conversation-extract",
      scriptPath: "{{repo_root}}/harnesses/opencode/skills/opencode-conversation-analysis/scripts/extract.ts",
      envVar: "OPENCODE_CONVERSATION_EXTRACT_COMMAND",
    },
    {
      name: "air-opencode-session-analysis",
      scriptPath: "{{repo_root}}/packages/opencode-session-analysis/src/cli.ts",
      envVar: "OPENCODE_SESSION_ANALYSIS_COMMAND",
    },
    {
      name: "air-opencode-session-export",
      scriptPath: "{{repo_root}}/harnesses/opencode/skills/opencode-sessions/scripts/export.ts",
      envVar: "OPENCODE_SESSION_EXPORT_COMMAND",
    },
  ];

  for (const helper of helpers) {
    const helperPath = join(binDir, helper.name);
    const content = `#!/bin/bash
# Autogenerated ${helper.name} helper

exec env ${helper.envVar}="${helper.name}" \\
  bun "${helper.scriptPath}" "$@"
`;
    await writeFile(helperPath, content, { mode: 0o755 });
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

    await generateAirHelpers(context);
  } finally {
    await rm(agentStagingDir, { recursive: true, force: true });
    await rm(commandStagingDir, { recursive: true, force: true });
    await rm(skillStagingDir, { recursive: true, force: true });
  }
}

async function getBootstrapTargets(outputDir: string): Promise<Array<{ sourcePath: string; targetPath: string; description: string }>> {
  const getConfigHome = () => process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return [
    {
      sourcePath: join(outputDir, "opencode"),
      targetPath: process.env.OPENCODE_CONFIG_DIR?.trim() || join(getConfigHome(), "opencode"),
      description: "OpenCode config",
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: "opencode",
  stageProfile,
  finalizeOutput,
  getBootstrapTargets,
};

export default plugin;
