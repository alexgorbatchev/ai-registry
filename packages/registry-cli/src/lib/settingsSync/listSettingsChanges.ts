import { isJsonObject } from "./isJsonObject";
import type { ISettingsChange, JsonValue, SettingsKeyPath } from "./types";

// Lists the smallest set of key-level edits that turns `current` into `target`.
// Objects are compared key by key; any other value that differs is replaced whole,
// and a key missing from `target` is reported with an undefined value.
export function listSettingsChanges(
  current: JsonValue | undefined,
  target: JsonValue | undefined,
  keyPath: SettingsKeyPath = [],
): ISettingsChange[] {
  if (Bun.deepEquals(current, target, true)) {
    return [];
  }

  if (!isJsonObject(current) || !isJsonObject(target)) {
    return [{ keyPath, value: target }];
  }

  const keys = new Set([...Object.keys(current), ...Object.keys(target)]);
  return [...keys].flatMap((key) => listSettingsChanges(current[key], target[key], [...keyPath, key]));
}
