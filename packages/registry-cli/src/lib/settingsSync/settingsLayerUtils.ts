import { isJsonObject } from "./isJsonObject";
import { getAtKeyPath } from "./keyPathUtils";
import type { IJsonObject, ISettingsChange, JsonValue, SettingsKeyPath } from "./types";

function mergeLayerValue(lower: JsonValue | undefined, upper: JsonValue): JsonValue {
  if (!isJsonObject(lower) || !isJsonObject(upper)) {
    return structuredClone(upper);
  }

  const merged: IJsonObject = structuredClone(lower);
  for (const [key, value] of Object.entries(upper)) {
    merged[key] = mergeLayerValue(merged[key], value);
  }
  return merged;
}

// Merges settings layers in order: objects merge key by key, and any other value,
// lists included, replaces the one from an earlier layer.
export function mergeSettingsLayers(layers: IJsonObject[]): IJsonObject {
  return layers.reduce<IJsonObject>((merged, layer) => {
    const value = mergeLayerValue(merged, layer);
    return isJsonObject(value) ? value : merged;
  }, {});
}

// The number of leading keys of `keyPath` that `layer` defines.
function getDefinedPrefixLength(layer: IJsonObject, keyPath: SettingsKeyPath): number {
  let length = 0;
  while (length < keyPath.length && getAtKeyPath(layer, keyPath.slice(0, length + 1)) !== undefined) {
    length += 1;
  }
  return length;
}

// The layer a changed value belongs to: the one defining the longest part of its key
// path, with later layers winning ties because they override earlier ones. A key no
// layer defines yet, such as a new top-level setting, goes to the first layer.
export function findOwningLayerIndex(layers: IJsonObject[], keyPath: SettingsKeyPath): number {
  let ownerIndex = 0;
  let ownerLength = 0;
  layers.forEach((layer, index) => {
    const length = getDefinedPrefixLength(layer, keyPath);
    if (length > 0 && length >= ownerLength) {
      ownerIndex = index;
      ownerLength = length;
    }
  });
  return ownerIndex;
}

// Splits source changes between layers. A new or changed value goes to its owning
// layer; a removal clears the key from every layer that defines it, so a value from
// an earlier layer cannot reappear in the merged source.
export function routeSettingsChanges(layers: IJsonObject[], changes: ISettingsChange[]): ISettingsChange[][] {
  const changesByLayer = layers.map((): ISettingsChange[] => []);
  for (const change of changes) {
    if (change.value !== undefined) {
      changesByLayer[findOwningLayerIndex(layers, change.keyPath)]?.push(change);
      continue;
    }
    layers.forEach((layer, index) => {
      if (getAtKeyPath(layer, change.keyPath) !== undefined) {
        changesByLayer[index]?.push(change);
      }
    });
  }
  return changesByLayer;
}

// Keeps only the entries of `tables` named in `entryNames`, so the rest of a file
// the harness owns never takes part in the sync. A table with named entries is always
// selected, even when the value lacks it or holds none of them, so every change adds
// or removes single entries instead of replacing the harness's whole table.
export function selectManagedEntries(
  value: IJsonObject,
  tables: SettingsKeyPath[],
  entryNames: Map<string, Set<string>>,
): IJsonObject {
  const selected: IJsonObject = {};
  for (const table of tables) {
    const tableValue = getAtKeyPath(value, table);
    const names = entryNames.get(table.join("\0")) ?? new Set<string>();
    if (names.size === 0) continue;

    const entries = isJsonObject(tableValue) ? Object.entries(tableValue).filter(([name]) => names.has(name)) : [];
    let target = selected;
    for (const key of table.slice(0, -1)) {
      const child = target[key];
      const next: IJsonObject = isJsonObject(child) ? child : {};
      target[key] = next;
      target = next;
    }
    const lastKey = table[table.length - 1];
    if (lastKey !== undefined) {
      target[lastKey] = structuredClone(Object.fromEntries(entries));
    }
  }
  return selected;
}

// Names of the entries each table holds in any of the given values.
export function listManagedEntryNames(tables: SettingsKeyPath[], values: IJsonObject[]): Map<string, Set<string>> {
  const entryNames = new Map<string, Set<string>>();
  for (const table of tables) {
    const names = new Set<string>();
    for (const value of values) {
      const tableValue = getAtKeyPath(value, table);
      if (isJsonObject(tableValue)) {
        for (const name of Object.keys(tableValue)) names.add(name);
      }
    }
    entryNames.set(table.join("\0"), names);
  }
  return entryNames;
}
