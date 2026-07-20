import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { IUnifiedHarnessBuildContext } from "../../../../scripts/lib/harnessBuild";
import { reverseTemplateContent } from "../../../../scripts/lib/reverseTemplateContent";

export async function syncBack(context: IUnifiedHarnessBuildContext): Promise<void> {
  const getConfigHome = () => process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  const activeDir = process.env.OPENCODE_CONFIG_DIR?.trim() || join(getConfigHome(), "opencode");

  const targets = [
    { 
      filename: "opencode.jsonc", 
      desc: "OpenCode config",
      compiledPath: join(context.outputDir, "opencode", "opencode.jsonc"),
    },
    { 
      filename: "dcp.jsonc", 
      desc: "OpenCode DCP config",
      compiledPath: join(context.outputDir, "opencode", "dcp.jsonc"),
    },
  ];

  for (const target of targets) {
    const activePath = join(activeDir, target.filename);
    const sourcePath = join(context.harnessDir, target.filename);

    if (existsSync(activePath)) {
      const activeRaw = await readFile(activePath, "utf-8");
      const activeProcessed = reverseTemplateContent(activeRaw, context.templateContext).trim();

      const sourceContent = existsSync(sourcePath)
        ? (await readFile(sourcePath, "utf-8")).trim()
        : null;

      const compiledContent = existsSync(target.compiledPath)
        ? reverseTemplateContent(await readFile(target.compiledPath, "utf-8"), context.templateContext).trim()
        : null;

      if (sourceContent !== null && compiledContent !== null) {
        const isActiveChanged = activeProcessed !== compiledContent;
        const isSourceChanged = sourceContent !== compiledContent;

        if (isActiveChanged && isSourceChanged && activeProcessed !== sourceContent) {
          throw new Error(
            `Conflict detected in ${target.desc} (${target.filename})! Both repository source and active settings have changed. Please resolve manually.`
          );
        }
      }

      if (sourceContent !== activeProcessed) {
        await writeFile(sourcePath, activeProcessed + "\n", "utf-8");
        console.log(`   🔄 Synced ${target.desc} (${target.filename}) back to harnesses/opencode/${target.filename}`);
      }
    }
  }
}
