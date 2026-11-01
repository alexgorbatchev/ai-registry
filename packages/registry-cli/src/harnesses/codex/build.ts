import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stageAssets, stageHarnessFiles, type IHarnessBuildContext, type IUnifiedHarnessPlugin } from "../../lib/harnessBuild";
import { mkdir } from "node:fs/promises";
import { getCommandSkillName } from "./getCommandSkillName";

// Codex keys that never reach the registry source: project trust levels, skill
// toggles, and hook trust hashes keyed by absolute local paths; entries Codex and the
// ChatGPT desktop app point at machine-local binaries and caches (the computer-use
// `notify` hook, the bundled and primary-runtime marketplaces, and the app's REPL MCP
// servers); acknowledgement notices and notice counters Codex stamps itself; and MCP
// server fields that can hold credentials.
const CODEX_LIVE_ONLY_KEY_PATHS = [
  ["projects"],
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


async function build(context: IHarnessBuildContext): Promise<void> {
  const targetDir = join(context.outputDir, "codex");
  await stageHarnessFiles(context, targetDir);
  const configPath = join(targetDir, "config.toml");
  if (!existsSync(configPath)) throw new Error(`Codex harness config does not exist: ${configPath}`);
  context.buildSupport.syncSettingsFile(configPath, { liveOnlyKeyPaths: CODEX_LIVE_ONLY_KEY_PATHS });
  const skillsDir = join(targetDir, "skills");
  await stageAssets(context, { skillsDir });
  for (const command of context.commands.matchedNames) {
    const sourcePath = context.commands.sourcePaths[command]!;
    const name = getCommandSkillName(command, await Bun.file(sourcePath).text());
    const skillDir = join(skillsDir, name);
    if (existsSync(skillDir)) throw new Error(`Codex command skill collides with another skill: ${name}`);
    await context.buildSupport.copyPathWithTemplateVariables(sourcePath, join(skillDir, "SKILL.md"), context.templateContext);
    await mkdir(join(skillDir, "agents"), { recursive: true });
    await Bun.write(join(skillDir, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
  }
}
const plugin: IUnifiedHarnessPlugin = {
  target: "codex", build,
  async getBootstrapTargets(outputDir) {
    return [{ kind: "home", sourcePath: join(outputDir, "codex"),
      targetPath: process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), description: "Codex home" }];
  },
};
export default plugin;
