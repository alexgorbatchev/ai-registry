import { chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stageAssets, stageHarnessFiles, type IHarnessBuildContext, type IUnifiedHarnessPlugin } from "../../lib/harnessBuild";

async function build(context: IHarnessBuildContext): Promise<void> {
  const targetDir = join(context.outputDir, "pi");
  await stageHarnessFiles(context, targetDir);
  await stageAssets(context, { skillsDir: join(targetDir, "skills"), commandsDir: join(targetDir, "prompts") });
  const settingsPath = join(targetDir, "settings.json");
  if (!existsSync(settingsPath)) throw new Error(`Pi harness settings do not exist: ${settingsPath}`);
  context.buildSupport.syncSettingsFile(settingsPath, { liveOnlyKeyPaths: [["lastChangelogVersion"]] });
  for (const name of ["pi-install", "pi-uninstall", "pi-update"]) {
    // Helper templates are build inputs, including ignored source-only templates.
    let sourcePath: string | undefined;
    for (const dir of context.harnessDirs) {
      const candidate = join(dir, "templates", `${name}.sh`);
      if (existsSync(candidate)) sourcePath = candidate;
    }
    if (!sourcePath) throw new Error(`Missing Pi helper template: ${name}.sh`);
    await context.buildSupport.copyPathWithTemplateVariables(sourcePath, join(context.outputDir, "bin", name), context.templateContext);
    await chmod(join(context.outputDir, "bin", name), 0o755);
  }
}
const plugin: IUnifiedHarnessPlugin = {
  target: "pi", build,
  async getBootstrapTargets(outputDir) {
    const sourcePath = join(outputDir, "pi");
    const targets: import("../../lib/harnessBuild").IBootstrapTarget[] = [{ kind: "home", sourcePath,
      targetPath: process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent"), description: "Pi config" }];
    const webSearchSource = join(sourcePath, "web-search.json");
    if (existsSync(webSearchSource)) targets.push({ kind: "link", sourcePath: webSearchSource,
      targetPath: join(homedir(), ".pi", "web-search.json"), description: "Pi web search config" });
    return targets;
  },
};
export default plugin;
