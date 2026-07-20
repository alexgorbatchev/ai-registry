import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { IUnifiedHarnessBuildContext } from "../../../../scripts/lib/harnessBuild";
import { stringifyTomlTable, type ITomlTable } from "../buildMutableCodexConfig";
import { reverseTemplateContent } from "../../../../scripts/lib/reverseTemplateContent";

export async function syncBack(context: IUnifiedHarnessBuildContext): Promise<void> {
  const repositoryRoot = context.templateContext.repo_root;
  const activePath = join(repositoryRoot, ".tmp", "codex", "config.toml");
  const sourcePath = join(context.harnessDir, "config.toml");
  const compiledPath = join(context.outputDir, "codex", "default", "config.toml");

  if (!existsSync(activePath) || !existsSync(sourcePath)) {
    return;
  }

  const activeRaw = await readFile(activePath, "utf-8");
  const activeProcessed = reverseTemplateContent(activeRaw, context.templateContext);
  const sourceRaw = await readFile(sourcePath, "utf-8");

  const activeToml = Bun.TOML.parse(activeProcessed);
  const sourceToml = Bun.TOML.parse(sourceRaw);

  let modified = false;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // Conflict detection
  if (existsSync(compiledPath) && isRecord(sourceToml) && isRecord(activeToml)) {
    const compiledRaw = await readFile(compiledPath, "utf-8");
    const compiledProcessed = reverseTemplateContent(compiledRaw, context.templateContext);
    const compiledToml = Bun.TOML.parse(compiledProcessed);

    if (isRecord(compiledToml)) {
      function checkConflicts(
        source: Record<string, unknown>,
        active: Record<string, unknown>,
        compiled: Record<string, unknown>,
        path: string[] = []
      ): void {
        for (const key of Object.keys(source)) {
          const activeValue = active[key];
          const sourceValue = source[key];
          const compiledValue = compiled[key];

          if (activeValue !== undefined && compiledValue !== undefined) {
            if (isRecord(sourceValue) && isRecord(activeValue) && isRecord(compiledValue)) {
              checkConflicts(sourceValue, activeValue, compiledValue, [...path, key]);
            } else {
              const isActiveChanged = JSON.stringify(activeValue) !== JSON.stringify(compiledValue);
              const isSourceChanged = JSON.stringify(sourceValue) !== JSON.stringify(compiledValue);

              if (isActiveChanged && isSourceChanged && JSON.stringify(activeValue) !== JSON.stringify(sourceValue)) {
                throw new Error(
                  `Conflict detected in Codex config.toml at keys: ${[...path, key].join(".")}! Both repository source and active settings have changed. Please resolve manually.`
                );
              }
            }
          }
        }
      }

      checkConflicts(sourceToml, activeToml, compiledToml);
    }
  }

  function updateKeys(source: Record<string, unknown>, active: Record<string, unknown>): void {
    for (const key of Object.keys(source)) {
      const activeValue = active[key];
      const sourceValue = source[key];

      if (activeValue !== undefined) {
        if (isRecord(sourceValue) && isRecord(activeValue)) {
          updateKeys(sourceValue, activeValue);
        } else if (sourceValue !== activeValue) {
          source[key] = activeValue;
          modified = true;
        }
      }
    }
  }

  if (isRecord(sourceToml) && isRecord(activeToml)) {
    updateKeys(sourceToml, activeToml);
  }

  if (modified) {
    const updatedRaw = `${stringifyTomlTable(sourceToml as ITomlTable)}\n`;
    await writeFile(sourcePath, updatedRaw, "utf-8");
    console.log(`   🔄 Synced Codex config.toml back to harnesses/codex/config.toml`);
  }
}
