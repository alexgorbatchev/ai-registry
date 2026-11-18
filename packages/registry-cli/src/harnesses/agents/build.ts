import { mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import type { IBootstrapTarget, IHarnessBuildContext, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";

// Shared skills for every harness that reads `~/.agents/skills`: Codex, Pi, and
// OpenCode. Their own outputs carry only harness-specific skills. Claude Code does
// not read this folder, so its output keeps every skill.
const AGENTS_OUTPUT_DIR_NAME = "agents";

function getSharedSkillsOutputDir(outputDir: string): string {
  return join(outputDir, AGENTS_OUTPUT_DIR_NAME, "skills");
}

async function buildOutput(context: IHarnessBuildContext): Promise<void> {
  const skillsDir = getSharedSkillsOutputDir(context.outputDir);
  await mkdir(skillsDir, { recursive: true });
  await context.buildSupport.stageRegistryAssets(context, { skillsDir });
}

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  return [
    {
      kind: "home",
      sourcePath: getSharedSkillsOutputDir(outputDir),
      targetPath: join(homedir(), ".agents", "skills"),
      description: "Shared agent skills",
      // Orca and `npx skills add -g` install into this folder; read-only keeps
      // their copies from duplicating registry skills.
      readOnly: true,
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: AGENTS_OUTPUT_DIR_NAME,
  buildOutput,
  getBootstrapTargets,
};

export default plugin;
