import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { IUnifiedHarnessBuildContext } from "../../../../scripts/lib/harnessBuild";
import { reverseTemplateContent } from "../../../../scripts/lib/reverseTemplateContent";

export async function syncBack(context: IUnifiedHarnessBuildContext): Promise<void> {
  const activeDir = process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent");
  
  const files = [
    {
      filename: "settings.json",
      compiledPath: join(context.outputDir, "pi", "default", "settings.json"),
      sourcePath: join(context.harnessDir, "settings.json"),
    },
    {
      filename: "models.json",
      compiledPath: join(context.outputDir, "pi", "default", "models.json"),
      sourcePath: join(context.harnessDir, "models.json"),
    },
  ];

  for (const file of files) {
    const activePath = join(activeDir, file.filename);

    if (existsSync(activePath)) {
      const activeRaw = await readFile(activePath, "utf-8");
      const activeContent = reverseTemplateContent(activeRaw, context.templateContext).trim();

      const sourceContent = existsSync(file.sourcePath) 
        ? (await readFile(file.sourcePath, "utf-8")).trim()
        : null;

      const compiledContent = existsSync(file.compiledPath)
        ? reverseTemplateContent(await readFile(file.compiledPath, "utf-8"), context.templateContext).trim()
        : null;

      if (sourceContent !== null && compiledContent !== null) {
        const isActiveChanged = activeContent !== compiledContent;
        const isSourceChanged = sourceContent !== compiledContent;

        if (isActiveChanged && isSourceChanged && activeContent !== sourceContent) {
          throw new Error(
            `Conflict detected in Pi ${file.filename}! Both repository source and active settings have changed. Please resolve manually.`
          );
        }
      }

      if (sourceContent !== activeContent) {
        await writeFile(file.sourcePath, activeContent + "\n", "utf-8");
        console.log(`   🔄 Synced Pi ${file.filename} back to harnesses/pi/${file.filename}`);
      }
    }
  }
}
