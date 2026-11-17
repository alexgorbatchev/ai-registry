import { isJsonObject } from "./isJsonObject";
import { getAtKeyPath } from "./keyPathUtils";
import type { IJsonObject, ISettingsChange, JsonValue, SettingsKeyPath } from "./types";

function isEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return Bun.deepEquals(left, right, true);
}

function includesValue(values: JsonValue[], value: JsonValue): boolean {
  return values.some((candidate) => isEqual(candidate, value));
}

function mergeLayerValue(lower: JsonValue | undefined, upper: JsonValue): JsonValue {
  if (Array.isArray(lower) && Array.isArray(upper)) {
    return [...structuredClone(lower), ...structuredClone(upper.filter((item) => !includesValue(lower, item)))];
  }
  if (!isJsonObject(lower) || !isJsonObject(upper)) {
    return structuredClone(upper);
  }

  const merged: IJsonObject = structuredClone(lower);
  for (const [key, value] of Object.entries(upper)) {
    merged[key] = mergeLayerValue(merged[key], value);
  }
  return merged;
}

// Merges settings layers in order: objects merge key by key, lists append the items an
// earlier layer does not already hold, and any other value replaces the earlier one.
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
// path. On a tie a registry or overlay layer beats a tool layer, so a tool only takes
// edits inside what it defines and stays removable; otherwise later layers win because
// they override earlier ones. A key no layer defines yet, such as a new top-level
// setting, goes to the first layer.
export function findOwningLayerIndex(
  layers: IJsonObject[],
  keyPath: SettingsKeyPath,
  isToolLayer: readonly boolean[] = [],
): number {
  let ownerIndex = 0;
  let ownerLength = 0;
  layers.forEach((layer, index) => {
    const length = getDefinedPrefixLength(layer, keyPath);
    if (length === 0) return;
    const isLonger = length > ownerLength;
    const isTie = length === ownerLength;
    const isToolLosingTie = isTie && isToolLayer[index] === true && isToolLayer[ownerIndex] !== true;
    if (isLonger || (isTie && !isToolLosingTie)) {
      ownerIndex = index;
      ownerLength = length;
    }
  });
  return ownerIndex;
}

// The layer that takes items the harness added to a list. Tool layers never take
// them while another layer can, so deleting a tool cannot drop unrelated edits.
function findListAdditionOwnerIndex(
  layers: IJsonObject[],
  keyPath: SettingsKeyPath,
  isToolLayer: readonly boolean[],
): number {
  const candidateIndexes = layers.map((_, index) => index).filter((index) => isToolLayer[index] !== true);
  if (candidateIndexes.length === 0) return findOwningLayerIndex(layers, keyPath);
  const candidateOwner = findOwningLayerIndex(
    candidateIndexes.map((index) => layers[index] ?? {}),
    keyPath,
  );
  return candidateIndexes[candidateOwner] ?? 0;
}

// Splits a changed list between the layers whose items make it up: each layer keeps
// its items still present, in the list's new order, and the items no layer held go to
// the addition owner. A layer left with no items loses the key, except the owner,
// which keeps an emptied list. Returns undefined when a layer defines something other
// than a list at that key, which merges by replacement and routes whole.
function routeListChange(
  layers: IJsonObject[],
  keyPath: SettingsKeyPath,
  nextItems: JsonValue[],
  isToolLayer: readonly boolean[],
): Map<number, ISettingsChange> | undefined {
  const layerItems = layers.map((layer) => getAtKeyPath(layer, keyPath));
  if (layerItems.some((items) => items !== undefined && !Array.isArray(items))) return undefined;

  const listLayerIndexes = layerItems.flatMap((items, index) => (Array.isArray(items) ? [index] : []));
  const heldItems = listLayerIndexes.flatMap((index) => {
    const items = layerItems[index];
    return Array.isArray(items) ? items : [];
  });
  const addedItems = nextItems.filter((item) => !includesValue(heldItems, item));
  const ownerIndex = findListAdditionOwnerIndex(layers, keyPath, isToolLayer);

  const changes = new Map<number, ISettingsChange>();
  for (const index of new Set([...listLayerIndexes, ownerIndex])) {
    const currentItems = layerItems[index];
    const ownItems = Array.isArray(currentItems) ? currentItems : [];
    const isOwner = index === ownerIndex;
    const keptItems = nextItems.filter(
      (item) => includesValue(ownItems, item) || (isOwner && includesValue(addedItems, item)),
    );
    const nextValue = keptItems.length > 0 || (isOwner && currentItems !== undefined) ? keptItems : undefined;
    if (!isEqual(nextValue, currentItems)) {
      changes.set(index, { keyPath, value: nextValue });
    }
  }
  return changes;
}

// Splits source changes between layers. A new or changed value goes to its owning
// layer, and a changed list is split between the layers its items came from; a
// removal clears the key from every layer that defines it, so a value from an
// earlier layer cannot reappear in the merged source.
export function routeSettingsChanges(
  layers: IJsonObject[],
  changes: ISettingsChange[],
  isToolLayer: readonly boolean[] = [],
): ISettingsChange[][] {
  const changesByLayer = layers.map((): ISettingsChange[] => []);
  for (const change of changes) {
    if (change.value === undefined) {
      layers.forEach((layer, index) => {
        if (getAtKeyPath(layer, change.keyPath) !== undefined) {
          changesByLayer[index]?.push(change);
        }
      });
      continue;
    }

    const listChanges = Array.isArray(change.value)
      ? routeListChange(layers, change.keyPath, change.value, isToolLayer)
      : undefined;
    if (listChanges === undefined) {
      changesByLayer[findOwningLayerIndex(layers, change.keyPath, isToolLayer)]?.push(change);
      continue;
    }
    for (const [index, listChange] of listChanges) {
      changesByLayer[index]?.push(listChange);
    }
  }
  return changesByLayer;
}
