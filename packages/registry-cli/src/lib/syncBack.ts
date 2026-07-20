import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { reverseTemplateContent } from "./reverseTemplateContent";
import { stringifyTomlTable, type ITomlTable } from "../harnesses/codex/buildMutableCodexConfig";
import type { IUnifiedHarnessBuildContext } from "./harnessBuild";

export type ISyncBackTarget = {
  filename: string;
  desc?: string;
  activePath: string;
  sourcePath: string;
  compiledPath: string;
  mergeStrategy?: "string" | "toml";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkTomlConflicts(
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
        checkTomlConflicts(sourceValue, activeValue, compiledValue, [...path, key]);
      } else {
        const isActiveChanged = JSON.stringify(activeValue) !== JSON.stringify(compiledValue);
        const isSourceChanged = JSON.stringify(sourceValue) !== JSON.stringify(compiledValue);

        if (isActiveChanged && isSourceChanged && JSON.stringify(activeValue) !== JSON.stringify(sourceValue)) {
          throw new Error(
            `Conflict detected in config.toml at keys: ${[...path, key].join(".")}! Both repository source and active settings have changed. Please resolve manually.`
          );
        }
      }
    }
  }
}

function updateTomlKeys(source: Record<string, unknown>, active: Record<string, unknown>): boolean {
  let modified = false;
  for (const key of Object.keys(source)) {
    const activeValue = active[key];
    const sourceValue = source[key];

    if (activeValue !== undefined) {
      if (isRecord(sourceValue) && isRecord(activeValue)) {
        if (updateTomlKeys(sourceValue, activeValue)) {
          modified = true;
        }
      } else if (JSON.stringify(sourceValue) !== JSON.stringify(activeValue)) {
        source[key] = activeValue;
        modified = true;
      }
    }
  }
  return modified;
}

export async function syncBackFiles(
  context: IUnifiedHarnessBuildContext,
  targets: ISyncBackTarget[]
): Promise<void> {
  for (const target of targets) {
    const { activePath, sourcePath, compiledPath, mergeStrategy = "string", desc = target.filename } = target;

    if (!existsSync(activePath) || !existsSync(sourcePath)) {
      continue;
    }

    const activeRaw = await readFile(activePath, "utf-8");
    const activeProcessed = reverseTemplateContent(activeRaw, context.templateContext).trim();

    if (mergeStrategy === "toml") {
      const sourceRaw = await readFile(sourcePath, "utf-8");
      const activeToml = Bun.TOML.parse(activeProcessed);
      const sourceToml = Bun.TOML.parse(sourceRaw);

      let modified = false;

      if (existsSync(compiledPath) && isRecord(sourceToml) && isRecord(activeToml)) {
        const compiledRaw = await readFile(compiledPath, "utf-8");
        const compiledProcessed = reverseTemplateContent(compiledRaw, context.templateContext);
        const compiledToml = Bun.TOML.parse(compiledProcessed);

        if (isRecord(compiledToml)) {
          checkTomlConflicts(sourceToml, activeToml, compiledToml);
        }
      }

      if (isRecord(sourceToml) && isRecord(activeToml)) {
        modified = updateTomlKeys(sourceToml, activeToml);
      }

      if (modified) {
        const updatedRaw = `${stringifyTomlTable(sourceToml as ITomlTable)}\n`;
        await writeFile(sourcePath, updatedRaw, "utf-8");
        console.log(`   🔄 Synced ${desc} back to ${sourcePath}`);
      }
    } else {
      const sourceContent = existsSync(sourcePath)
        ? (await readFile(sourcePath, "utf-8")).trim()
        : null;

      const compiledContent = existsSync(compiledPath)
        ? reverseTemplateContent(await readFile(compiledPath, "utf-8"), context.templateContext).trim()
        : null;

      if (sourceContent !== null && compiledContent !== null) {
        const isActiveChanged = activeProcessed !== compiledContent;
        const isSourceChanged = sourceContent !== compiledContent;

        if (isActiveChanged && isSourceChanged && activeProcessed !== sourceContent) {
          throw new Error(
            `Conflict detected in ${desc}! Both repository source and active settings have changed. Please resolve manually.`
          );
        }
      }

      if (sourceContent !== activeProcessed) {
        await writeFile(sourcePath, activeProcessed + "\n", "utf-8");
        console.log(`   🔄 Synced ${desc} back to ${sourcePath}`);
      }
    }
  }
}
