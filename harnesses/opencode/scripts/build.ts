/**
 * OpenCode unified-output build plugin.
 *
 * Final output tree and canonical sources:
 *
 * .output/opencode/
 * |-- command/                  <-- entries from `commands/` selected by `profiles/<profile>/profile.yaml|json`
 * |-- skill/                    <-- entries from `skills/` selected by `profiles/<profile>/profile.yaml|json`
 * |-- agent/
 * |   `-- <profile>.md          <-- `profiles/<profile>/profile.yaml|json`
 * |-- commands/                 <-- `harnesses/opencode/commands/`
 * |-- skills/                   <-- `harnesses/opencode/skills/`
 * |-- opencode.jsonc            <-- `harnesses/opencode/opencode.jsonc`
 * |-- dcp.jsonc                 <-- `harnesses/opencode/dcp.jsonc`
 * `-- package.json              <-- `harnesses/opencode/package.json`
 *
 * Build flow:
 *
 * - `scripts/build.ts` stages the unified Rulesync-generated OpenCode output under `.output/.opencode/`
 * - `stageProfile()` materializes profile agent markdown from each profile manifest into `.output/.opencode-agents/`
 * - `finalizeOutput()` renames `.output/.opencode/` to `.output/opencode/`, copies shipped harness files,
 *   and copies staged profile agents into `.output/opencode/agent/`
 */
import { copyFile, mkdir, readdir, rename, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { dedentTemplate } from "@alexgorbatchev/dedent-string";

import type {
  IProfileBuildContext,
  IUnifiedHarnessBuildContext,
  IUnifiedHarnessPlugin,
} from "../../../scripts/harnessBuild";

const AGENT_STAGING_DIR_NAME = ".opencode-agents";

function getAgentStagingDir(outputDir: string): string {
  return join(outputDir, AGENT_STAGING_DIR_NAME);
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
  const stagingDir = getAgentStagingDir(context.outputDir);
  await mkdir(stagingDir, { recursive: true });
  await writeFile(join(stagingDir, `${context.profileName}.md`), createAgentMarkdown(context), "utf-8");
}

async function finalizeOutput(context: IUnifiedHarnessBuildContext): Promise<void> {
  const hiddenOutputDir = join(context.outputDir, ".opencode");
  const visibleOutputDir = join(context.outputDir, "opencode");
  const agentStagingDir = getAgentStagingDir(context.outputDir);

  try {
    if (existsSync(hiddenOutputDir) && !existsSync(visibleOutputDir)) {
      await rename(hiddenOutputDir, visibleOutputDir);
    }

    await mkdir(visibleOutputDir, { recursive: true });
    await context.buildSupport.copyDirectoryWithTemplateVariables(
      context.harnessDir,
      visibleOutputDir,
      context.templateContext,
    );

    if (!existsSync(agentStagingDir)) {
      return;
    }

    const agentOutputDir = join(visibleOutputDir, "agent");
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
  }
}

const plugin: IUnifiedHarnessPlugin = {
  target: "opencode",
  stageProfile,
  finalizeOutput,
};

export default plugin;
