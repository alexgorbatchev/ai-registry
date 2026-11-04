import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { IBootstrapTarget, IHarnessBuildContext, IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import { logHarnessSkillOverrides } from "../../lib/logHarnessSkillOverrides";
import { applySettingsChanges } from "../../lib/settingsSync/applySettingsChanges";
import { getCommandSkillName } from "./getCommandSkillName";
import { CODEX_TRUSTED_DIRS_ENV, discoverTrustedProjects } from "./discoverTrustedProjects";

const CODEX_OUTPUT_DIR_NAME = "codex";

const CONFIG_FILE_NAME = "config.toml";

// Codex keys that never reach the registry source: project trust levels (each
// project separately, so generated entries fill in projects Codex has not seen), skill
// toggles, and hook trust hashes keyed by absolute local paths; entries Codex and the
// ChatGPT desktop app point at machine-local binaries and caches (the computer-use
// `notify` hook, the bundled and primary-runtime marketplaces, and the app's REPL MCP
// servers); acknowledgement notices and notice counters Codex stamps itself; and MCP
// server fields that can hold credentials.
const CODEX_LIVE_ONLY_KEY_PATHS = [
  ["projects", "*"],
  ["notice"],
  ["skills", "config"],
  ["hooks", "state"],
  ["notify"],
  ["marketplaces", "openai-bundled"],
  ["marketplaces", "openai-primary-runtime"],
  ["mcp_servers", "node_repl"],
  ["mcp_servers", "cua_repl"],
  ["tui", "model_availability_nux"],
  ["mcp_servers", "*", "env"],
  ["mcp_servers", "*", "http_headers"],
];

// Marks every git checkout under the folders listed in the environment as trusted.
// `projects` is live-only, so these machine-specific paths reach the live file
// but never the registry source.
async function trustListedProjects(context: IHarnessBuildContext, configPath: string): Promise<void> {
  const trustedProjects = await discoverTrustedProjects(
    process.env[CODEX_TRUSTED_DIRS_ENV] ?? "",
    context.templateContext.repo_root,
  );
  if (trustedProjects.length === 0) {
    return;
  }

  const configText = await Bun.file(configPath).text();
  const trustChanges = trustedProjects.map((projectDir) => ({
    keyPath: ["projects", projectDir, "trust_level"],
    value: "trusted",
  }));
  await Bun.write(configPath, applySettingsChanges(configText, trustChanges, configPath));
  console.log(`   ↳ codex trusted projects (${trustedProjects.length}) from ${CODEX_TRUSTED_DIRS_ENV}`);
}

// Codex saves `/model`, MCP, and feature changes into this file; the build syncs
// them back into `harnesses/codex/config.toml`.
async function stageCodexConfig(context: IHarnessBuildContext, codexOutputDir: string): Promise<void> {
  const sourceConfigPath = join(context.harnessDir, CONFIG_FILE_NAME);
  if (!existsSync(sourceConfigPath)) {
    throw new Error(`Codex harness config does not exist: ${sourceConfigPath}`);
  }

  const configPath = join(codexOutputDir, CONFIG_FILE_NAME);
  await context.buildSupport.copyPathWithTemplateVariables(sourceConfigPath, configPath, context.templateContext);
  await trustListedProjects(context, configPath);
  context.buildSupport.syncSettingsFile(configPath, {
    liveOnlyKeyPaths: CODEX_LIVE_ONLY_KEY_PATHS,
    sourceJsonObjectKeyPaths: [["mcp_servers", "node_repl", "env", "NODE_REPL_TRUSTED_SERVICES"]],
  });
}

async function stageHarnessRules(context: IHarnessBuildContext, codexOutputDir: string): Promise<void> {
  const harnessRulesDir = join(context.harnessDir, "rules");
  if (!existsSync(harnessRulesDir)) {
    return;
  }

  await context.buildSupport.copyDirectoryWithTemplateVariables(
    harnessRulesDir,
    join(codexOutputDir, "rules"),
    context.templateContext,
  );
}

// Commands become native skills that only explicit invocation can load.
async function stageCommandSkills(context: IHarnessBuildContext, skillsDir: string): Promise<void> {
  const commandSkillNames = new Set<string>();
  for (const command of context.assets.commands) {
    const sourcePath = context.assets.commandSourcePaths[command] ?? join(context.templateContext.commands_dir, command);
    const skillName = getCommandSkillName(command, await Bun.file(sourcePath).text());
    if (commandSkillNames.has(skillName)) {
      throw new Error(`Duplicate Codex command skill name: ${skillName}`);
    }
    commandSkillNames.add(skillName);

    const skillDir = join(skillsDir, skillName);
    if (existsSync(skillDir)) {
      throw new Error(`Codex command skill ${skillName} collides with a skill of the same name.`);
    }

    await context.buildSupport.copyPathWithTemplateVariables(
      sourcePath,
      join(skillDir, "SKILL.md"),
      context.templateContext,
    );
    await mkdir(join(skillDir, "agents"), { recursive: true });
    await Bun.write(join(skillDir, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
  }
}

async function buildOutput(context: IHarnessBuildContext): Promise<void> {
  const codexOutputDir = join(context.outputDir, CODEX_OUTPUT_DIR_NAME);
  const skillsDir = join(codexOutputDir, "skills");

  await mkdir(skillsDir, { recursive: true });
  await context.buildSupport.copyPathWithTemplateVariables(
    context.systemPromptPath,
    join(codexOutputDir, "AGENTS.md"),
    context.templateContext,
  );
  await stageCodexConfig(context, codexOutputDir);
  await stageHarnessRules(context, codexOutputDir);
  await context.buildSupport.stageHarnessSkills(context, skillsDir);
  await context.buildSupport.stageRegistryAssets(context, { skillsDir });
  await stageCommandSkills(context, skillsDir);

  await logHarnessSkillOverrides(context, "codex");
}

async function getBootstrapTargets(outputDir: string): Promise<IBootstrapTarget[]> {
  return [
    {
      kind: "home",
      sourcePath: join(outputDir, CODEX_OUTPUT_DIR_NAME),
      targetPath: process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"),
      description: "Codex home",
    },
  ];
}

const plugin: IUnifiedHarnessPlugin = {
  target: CODEX_OUTPUT_DIR_NAME,
  buildOutput,
  getBootstrapTargets,
};

export default plugin;
