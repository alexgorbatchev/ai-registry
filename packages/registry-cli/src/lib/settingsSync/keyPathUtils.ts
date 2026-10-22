import { isJsonObject } from "./isJsonObject";
import type { IJsonObject, JsonValue, SettingsKeyPath } from "./types";

// Matches any single key in a key path pattern, such as `["mcp", "*", "headers"]`.
export const ANY_KEY = "*";

export function getAtKeyPath(value: IJsonObject, keyPath: SettingsKeyPath): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const key of keyPath) {
    if (!isJsonObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

// Sets or, for an undefined value, removes the value at a concrete key path,
// creating intermediate objects only when there is a value to store.
export function setAtKeyPath(target: IJsonObject, keyPath: SettingsKeyPath, value: JsonValue | undefined): void {
  const key = keyPath[keyPath.length - 1];
  if (key === undefined) return;

  let parent = target;
  for (const parentKey of keyPath.slice(0, -1)) {
    const child = parent[parentKey];
    if (isJsonObject(child)) {
      parent = child;
      continue;
    }
    if (value === undefined) return;
    const created: IJsonObject = {};
    parent[parentKey] = created;
    parent = created;
  }

  if (value === undefined) {
    delete parent[key];
    return;
  }
  parent[key] = value;
}

// Whether `keyPath` is the pattern's location or lies inside it.
export function isUnderKeyPathPattern(keyPath: SettingsKeyPath, pattern: SettingsKeyPath): boolean {
  return pattern.length <= keyPath.length && pattern.every((key, index) => key === ANY_KEY || keyPath[index] === key);
}

// Resolves wildcard segments against the keys present in any of the given values.
export function expandKeyPathPattern(pattern: SettingsKeyPath, values: IJsonObject[]): SettingsKeyPath[] {
  const [key, ...rest] = pattern;
  if (key === undefined) return [[]];

  const keys =
    key === ANY_KEY ? [...new Set(values.flatMap((value) => Object.keys(value)))].sort() : [key];
  return keys.flatMap((concreteKey) => {
    const children = values.map((value) => value[concreteKey]).filter((child) => isJsonObject(child));
    if (rest.length === 0) return [[concreteKey]];
    return expandKeyPathPattern(rest, children).map((childPath) => [concreteKey, ...childPath]);
  });
}
