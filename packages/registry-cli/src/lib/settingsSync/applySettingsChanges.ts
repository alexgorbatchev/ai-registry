import { patch } from "@decimalturn/toml-patch";
import { applyEdits, modify } from "jsonc-parser";
import type { FormattingOptions } from "jsonc-parser";

import { setAtKeyPath } from "./keyPathUtils";
import { parseSettingsText } from "./parseSettingsText";
import type { ISettingsChange } from "./types";

const FORMATTING_OPTIONS: FormattingOptions = { tabSize: 2, insertSpaces: true, eol: "\n" };

// A single key says nothing about the file's ordering convention, so sorting is
// only inferred from two or more keys.
function isSortedByCodePoint(keys: string[]): boolean {
  return keys.length > 1 && keys.every((key, index) => index === 0 || keys[index - 1] <= key);
}

// Keeps objects whose keys are already sorted (as `jq -S` writes them) sorted;
// other objects get new keys appended.
function createInsertionIndexResolver(newKey: string | undefined): (existingKeys: string[]) => number {
  return (existingKeys) => {
    if (newKey === undefined || !isSortedByCodePoint(existingKeys)) {
      return existingKeys.length;
    }
    const insertionIndex = existingKeys.findIndex((existingKey) => existingKey > newKey);
    return insertionIndex === -1 ? existingKeys.length : insertionIndex;
  };
}

function applyTomlChanges(text: string, changes: ISettingsChange[], filePath: string): string {
  const target = parseSettingsText(text, filePath);
  for (const change of changes) {
    setAtKeyPath(target, change.keyPath, change.value);
  }
  return patch(text, target);
}

// Edits JSON, JSONC, or (for `.toml` files) TOML text in place, so comments, key
// order, and formatting the harness or the registry chose survive the sync.
export function applySettingsChanges(text: string, changes: ISettingsChange[], filePath: string): string {
  if (changes.length === 0) {
    return text;
  }
  if (filePath.endsWith(".toml")) {
    return applyTomlChanges(text, changes, filePath);
  }

  return changes.reduce(
    (currentText, change) =>
      applyEdits(
        currentText,
        modify(currentText, change.keyPath, change.value, {
          formattingOptions: FORMATTING_OPTIONS,
          getInsertionIndex: createInsertionIndexResolver(change.keyPath[change.keyPath.length - 1]),
        }),
      ),
    text,
  );
}
