import { isJsonObject } from "./isJsonObject";
import { expandKeyPathPattern, getAtKeyPath, isUnderKeyPathPattern, setAtKeyPath } from "./keyPathUtils";
import type { IJsonObject, ISettingsConflict, ISettingsMergeResult, JsonValue, SettingsKeyPath } from "./types";

export interface IMergeSettingsValuesInput {
  // The settings as of the previous build; undefined when no build has recorded them yet.
  base: IJsonObject | undefined;
  live: IJsonObject;
  source: IJsonObject;
  // Key path patterns (`*` matches any key) kept in the live file only.
  liveOnlyKeyPaths: SettingsKeyPath[];
}

function isEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return Bun.deepEquals(left, right, true);
}

function includesValue(values: JsonValue[], value: JsonValue): boolean {
  return values.some((candidate) => isEqual(candidate, value));
}

// Applies both sides' edits to a list: items the harness removed since the base
// are dropped from the source list, and items it added are appended.
function mergeArrays(base: JsonValue | undefined, live: JsonValue[], source: JsonValue[]): JsonValue[] {
  const baseItems = Array.isArray(base) ? base : [];
  const removedItems = baseItems.filter((item) => !includesValue(live, item));
  const keptItems = source.filter((item) => !includesValue(removedItems, item));
  const addedItems = live.filter((item) => !includesValue(baseItems, item) && !includesValue(keptItems, item));
  return [...keptItems, ...addedItems];
}

function mergeValue(
  base: JsonValue | undefined,
  live: JsonValue | undefined,
  source: JsonValue | undefined,
  hasBase: boolean,
  keyPath: SettingsKeyPath,
  conflicts: ISettingsConflict[],
): JsonValue | undefined {
  if (hasBase && isEqual(live, base)) return source;
  if (hasBase && isEqual(source, base)) return live;
  if (isEqual(live, source)) return live;

  if (!hasBase && live === undefined) return source;
  if (!hasBase && source === undefined) return live;

  if (isJsonObject(live) && isJsonObject(source)) {
    return mergeObjects(isJsonObject(base) ? base : undefined, live, source, hasBase, keyPath, conflicts);
  }

  if (Array.isArray(live) && Array.isArray(source)) {
    return mergeArrays(base, live, source);
  }

  // Without a recorded base there is no way to tell which side changed, so the
  // value the user last saw in the harness wins.
  const kept = hasBase ? "source" : "live";
  conflicts.push({ keyPath, liveValue: live, sourceValue: source, kept });
  return kept === "source" ? source : live;
}

function mergeObjects(
  base: IJsonObject | undefined,
  live: IJsonObject,
  source: IJsonObject,
  hasBase: boolean,
  keyPath: SettingsKeyPath,
  conflicts: ISettingsConflict[],
): IJsonObject {
  const merged: IJsonObject = {};
  const keys = new Set([...Object.keys(source), ...Object.keys(live)]);

  for (const key of keys) {
    const value = mergeValue(base?.[key], live[key], source[key], hasBase, [...keyPath, key], conflicts);
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

// Three-way merge of a harness settings file. Keys changed on only one side since
// the base take that side's value, so harness-made changes flow into the source
// and source changes flow into the live file. When both sides changed the same
// key, nested objects merge key by key, lists combine both sides' edits, and any
// other value keeps the source version and is reported as a conflict.
export function mergeSettingsValues(input: IMergeSettingsValuesInput): ISettingsMergeResult {
  const conflicts: ISettingsConflict[] = [];
  const merged = mergeObjects(input.base, input.live, input.source, input.base !== undefined, [], conflicts);

  const liveValue = structuredClone(merged);
  const sourceValue = structuredClone(merged);
  const liveOnlyKeyPaths = input.liveOnlyKeyPaths.flatMap((pattern) =>
    expandKeyPathPattern(pattern, [input.live, input.source, merged]),
  );
  for (const keyPath of liveOnlyKeyPaths) {
    const liveOnlyValue = getAtKeyPath(input.live, keyPath);
    setAtKeyPath(liveValue, keyPath, liveOnlyValue !== undefined ? liveOnlyValue : getAtKeyPath(input.source, keyPath));
    setAtKeyPath(sourceValue, keyPath, getAtKeyPath(input.source, keyPath));
  }

  return {
    liveValue,
    sourceValue,
    conflicts: conflicts.filter(
      (conflict) => !input.liveOnlyKeyPaths.some((pattern) => isUnderKeyPathPattern(conflict.keyPath, pattern)),
    ),
  };
}
