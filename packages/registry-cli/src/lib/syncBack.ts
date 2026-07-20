import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { isDeepStrictEqual } from "util";
import { parse as parseJsonc, modify as modifyJsonc, applyEdits as applyJsoncEdits } from "jsonc-parser";
import { reverseTemplateContent, reverseTemplateObject } from "./reverseTemplateContent";
import { stringifyTomlTable, type ITomlTable } from "../harnesses/codex/buildMutableCodexConfig";
import type { IUnifiedHarnessBuildContext } from "./harnessBuild";

export type ISyncBackTarget = {
  filename: string;
  desc?: string;
  activePath: string;
  sourcePath: string;
  compiledPath: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkObjectConflicts(
  source: Record<string, unknown>,
  active: Record<string, unknown>,
  compiled: Record<string, unknown>,
  desc: string,
  path: string[] = []
): void {
  const allKeys = new Set([...Object.keys(source), ...Object.keys(active)]);
  
  for (const key of allKeys) {
    const activeValue = active[key];
    const sourceValue = source[key];
    const compiledValue = compiled[key];

    if (activeValue !== undefined && compiledValue !== undefined && sourceValue !== undefined) {
      if (isRecord(sourceValue) && isRecord(activeValue) && isRecord(compiledValue)) {
        checkObjectConflicts(sourceValue, activeValue, compiledValue, desc, [...path, key]);
      } else {
        const isActiveChanged = !isDeepStrictEqual(activeValue, compiledValue);
        const isSourceChanged = !isDeepStrictEqual(sourceValue, compiledValue);

        if (isActiveChanged && isSourceChanged && !isDeepStrictEqual(activeValue, sourceValue)) {
          throw new Error(
            `Conflict detected in ${desc} at keys: ${[...path, key].join(".")}! Both repository source and active settings have changed. Please resolve manually.`
          );
        }
      }
    }
  }
}

function updateObjectKeys(source: Record<string, unknown>, active: Record<string, unknown>): boolean {
  let modified = false;
  const allKeys = new Set([...Object.keys(source), ...Object.keys(active)]);
  
  for (const key of allKeys) {
    const activeValue = active[key];
    const sourceValue = source[key];

    if (activeValue !== undefined) {
      if (isRecord(sourceValue) && isRecord(activeValue)) {
        if (updateObjectKeys(sourceValue, activeValue)) {
          modified = true;
        }
      } else if (!isDeepStrictEqual(sourceValue, activeValue)) {
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
    const { activePath, sourcePath, compiledPath, desc = target.filename } = target;

    if (!existsSync(activePath) || !existsSync(sourcePath)) {
      continue;
    }

    const activeRaw = await readFile(activePath, "utf-8");
    const sourceRaw = await readFile(sourcePath, "utf-8");
    
    const isToml = target.filename.endsWith(".toml");

    const parse = (content: string) => {
      if (isToml) {
        return Bun.TOML.parse(content);
      }
      return parseJsonc(content);
    };

    const activeParsed = parse(activeRaw);
    const sourceToml = parse(sourceRaw);
    const activeToml = reverseTemplateObject(activeParsed, context.templateContext) as Record<string, unknown>;

    let modified = false;

    if (existsSync(compiledPath) && isRecord(sourceToml) && isRecord(activeToml)) {
      const compiledRaw = await readFile(compiledPath, "utf-8");
      const compiledParsed = parse(compiledRaw);
      const compiledToml = reverseTemplateObject(compiledParsed, context.templateContext) as Record<string, unknown>;

      if (isRecord(compiledToml)) {
        checkObjectConflicts(sourceToml, activeToml, compiledToml, desc);
      }
    }

    if (isRecord(sourceToml) && isRecord(activeToml)) {
      modified = updateObjectKeys(sourceToml, activeToml);
    }

    if (modified) {
      let updatedRaw: string;
      if (isToml) {
        updatedRaw = `${stringifyTomlTable(sourceToml as ITomlTable)}\n`;
      } else {
        updatedRaw = sourceRaw;
        const originalSourceToml = parse(sourceRaw) as Record<string, unknown>;
        const allKeys = new Set([...Object.keys(sourceToml as Record<string, unknown>), ...Object.keys(activeToml as Record<string, unknown>)]);
        
        for (const key of allKeys) {
          const updatedValue = (sourceToml as Record<string, unknown>)[key];
          const originalValue = originalSourceToml[key];

          if (!isDeepStrictEqual(originalValue, updatedValue)) {
            const edits = modifyJsonc(updatedRaw, [key], updatedValue, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
            updatedRaw = applyJsoncEdits(updatedRaw, edits);
          }
        }
      }
      await writeFile(sourcePath, updatedRaw, "utf-8");
      console.log(`   🔄 Synced ${desc} back to ${sourcePath}`);
    }
  }
}
