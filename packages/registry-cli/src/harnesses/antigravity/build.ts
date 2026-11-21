import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import type { IBootstrapTarget, IHarnessBuildContext, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";
import { stageCommandSkills } from "../../lib/stageCommandSkills";
import { injectDisableModelInvocation } from "../../lib/userSkillUtils";

// The output mirrors Antigravity's global customization folder, `~/.gemini/config`,
// which the Antigravity CLI, app, and IDE read. The folder also holds runtime state
// (`projects/`, `.migrated`), so bootstrap links only the managed entries into it.
const ANTIGRAVITY_OUTPUT_DIR_NAME = "antigravity";
// Antigravity loads `~/.gemini/config/AGENTS.md` as a global rule.
const RULES_FILE_NAME = "AGENTS.md";
const SKILLS_DIR_NAME = "skills";
// `agy mcp add` rewrites this file by renaming a new copy over it, which replaces a
// symlink with a regular file. Bootstrap therefore writes its `mcpServers` entries into
// the live file instead of linking it, keeping servers added with `agy mcp add`.
const MCP_CONFIG_FILE_NAME = "mcp_config.json";
// MCP server fields that can hold credentials `agy mcp add --header/--env` stores.
const MCP_SERVER_LIVE_ONLY_KEYS = ["headers", "env"];

function getConfigDir(): string {
  return join(homedir(), ".gemini", "config");
}

// Antigravity turns every skill into a slash command and honors
// `disable-model-invocation`, so registry commands ship as skills only the user invokes.
async function finishCommandSkill(skillDir: string): Promise<void> {
  const skillFilePath = join(skillDir, "SKILL.md");
  await writeFile(skillFilePath, injectDisableModelInvocation(await readFile(skillFilePath, "utf-8")), "utf-8");
}

async function stageMcpConfig(context: IHarnessBuildContext, antigravityOutputDir: string): Promise<void> {
  const sourcePath = join(context.harnessDir, MCP_CONFIG_FILE_NAME);
  if (!existsSync(sourcePath)) {
    return;
  }

  const stagedPath = join(antigravityOutputDir, MCP_CONFIG_FILE_NAME);
  await context.buildSupport.stageSourcePath(sourcePath, stagedPath);
  context.buildSupport.syncSettingsFile(stagedPath, { shouldLinkIntoHome: false });
}

async function buildOutput(context: IHarnessBuildContext): Promise<void> {
  const antigravityOutputDir = join(context.outputDir, ANTIGRAVITY_OUTPUT_DIR_NAME);
  const skillsDir = join(antigravityOutputDir, SKILLS_DIR_NAME);

  await mkdir(skillsDir, { recursive: true });
  await context.buildSupport.stageSourcePath(context.systemPromptPath, join(antigravityOutputDir, RULES_FILE_NAME));
  await stageMcpConfig(context, antigravityOutputDir);

  // Antigravity reads neither `~/.agents/skills` nor `~/.claude/skills`, so its output
  // carries every registry skill. Harness skills stage first and win name collisions.
  await context.buildSupport.stageHarnessSkills(context, skillsDir);
  await context.buildSupport.stageRegistryAssets(context, { skillsDir });
  await stageCommandSkills(context, skillsDir, "Antigravity", finishCommandSkill);

  await logHarnessSkillOverrides(context, ANTIGRAVITY_OUTPUT_DIR_NAME);
}

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  const sourcePath = join(outputDir, ANTIGRAVITY_OUTPUT_DIR_NAME);
  const configDir = getConfigDir();
  return [
    {
      kind: "home",
      sourcePath,
      targetPath: configDir,
      description: "Antigravity config",
    },
    {
      kind: "entries",
      sourcePath: join(sourcePath, MCP_CONFIG_FILE_NAME),
      targetPath: join(configDir, MCP_CONFIG_FILE_NAME),
      description: "Antigravity MCP servers",
      tables: [["mcpServers"]],
      liveOnlyEntryKeys: MCP_SERVER_LIVE_ONLY_KEYS,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: ANTIGRAVITY_OUTPUT_DIR_NAME,
  buildOutput,
  getBootstrapTargets,
};

export default plugin;
