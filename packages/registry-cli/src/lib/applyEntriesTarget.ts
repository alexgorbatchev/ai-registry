import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname } from "path";

import type { IBootstrapTarget } from "./harnessBuild";
import { applySettingsChanges } from "./settingsSync/applySettingsChanges";
import { isJsonObject } from "./settingsSync/isJsonObject";
import { getAtKeyPath } from "./settingsSync/keyPathUtils";
import { parseSettingsText } from "./settingsSync/parseSettingsText";
import type { IJsonObject, ISettingsChange, JsonValue } from "./settingsSync/types";

type IEntriesBootstrapTarget = Extract<IBootstrapTarget, { kind: "entries" }>;

export interface IEntriesApplyResult {
  added: string[];
  updated: string[];
  removed: string[];
  // Entries changed outside the registry since the last apply: replaced with the
  // registry value, or left in place once the registry stopped declaring them.
  replacedExternalEdits: string[];
  keptExternalEdits: string[];
}

function isEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return Bun.deepEquals(left, right, true);
}

function getTable(value: IJsonObject, keyPath: string[]): IJsonObject {
  const table = getAtKeyPath(value, keyPath);
  return isJsonObject(table) ? table : {};
}

function withoutKeys(value: JsonValue | undefined, keys: string[]): JsonValue | undefined {
  if (!isJsonObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

// The registry entry with the target's own values for live-only fields kept.
function withLiveOnlyFields(desired: JsonValue, current: JsonValue | undefined, keys: string[]): JsonValue {
  if (!isJsonObject(desired) || !isJsonObject(current)) return desired;
  const kept = Object.entries(current).filter(([key]) => keys.includes(key) && desired[key] === undefined);
  return { ...desired, ...Object.fromEntries(kept) };
}

async function readJsonObject(filePath: string): Promise<IJsonObject> {
  return existsSync(filePath) ? parseSettingsText(await Bun.file(filePath).text(), filePath) : {};
}

// Writes the entries a generated settings file declares into a settings file the harness
// owns, leaving every other key alone. `statePath` records the entries this target
// applied, so bootstrap removes entries the registry stops declaring without touching
// entries the harness added itself. Entries changed outside the registry since the last
// apply are replaced by the registry value, or kept once the registry no longer declares
// them, and reported either way.
export async function applyEntriesTarget(
  target: IEntriesBootstrapTarget,
  statePath: string,
): Promise<IEntriesApplyResult> {
  const result: IEntriesApplyResult = {
    added: [],
    updated: [],
    removed: [],
    replacedExternalEdits: [],
    keptExternalEdits: [],
  };
  const source = parseSettingsText(await Bun.file(target.sourcePath).text(), target.sourcePath);
  const applied = await readJsonObject(statePath);
  const hasTargetFile = existsSync(target.targetPath);
  const targetText = hasTargetFile ? await Bun.file(target.targetPath).text() : "{}\n";
  const live = parseSettingsText(targetText, target.targetPath);
  const changes: ISettingsChange[] = [];
  const nextApplied: IJsonObject = {};

  for (const table of target.tables) {
    const tableKey = table.join(".");
    const desiredEntries = getTable(source, table);
    const appliedEntries = getTable(applied, [tableKey]);
    const liveEntries = getTable(live, table);
    nextApplied[tableKey] = desiredEntries;

    for (const name of new Set([...Object.keys(desiredEntries), ...Object.keys(appliedEntries)])) {
      const label = `${tableKey}.${name}`;
      const desired = desiredEntries[name];
      const previous = appliedEntries[name];
      const current = liveEntries[name];
      const isExternallyEdited =
        previous !== undefined &&
        current !== undefined &&
        !isEqual(withoutKeys(current, target.liveOnlyEntryKeys), previous);

      if (desired === undefined) {
        if (current === undefined) continue;
        if (isExternallyEdited) {
          result.keptExternalEdits.push(label);
          continue;
        }
        changes.push({ keyPath: [...table, name], value: undefined });
        result.removed.push(label);
        continue;
      }

      const next = withLiveOnlyFields(desired, current, target.liveOnlyEntryKeys);
      if (isEqual(current, next)) continue;
      changes.push({ keyPath: [...table, name], value: next });
      if (current === undefined) {
        result.added.push(label);
      } else {
        result.updated.push(label);
        if (isExternallyEdited) result.replacedExternalEdits.push(label);
      }
    }
  }

  if (changes.length > 0) {
    await mkdir(dirname(target.targetPath), { recursive: true });
    await Bun.write(target.targetPath, applySettingsChanges(targetText, changes, target.targetPath));
  }
  await mkdir(dirname(statePath), { recursive: true });
  await Bun.write(statePath, `${JSON.stringify(nextApplied, null, 2)}\n`);
  return result;
}
