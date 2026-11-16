import { existsSync, realpathSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join, sep } from "path";

import type { IGeneratedOutputManifest } from "./generatedOutputUtils";

// Records which checkout root the settings-sync merge bases were taken for.
const SETTINGS_STATE_ROOT_FILE = "checkout-root.json";

// The same checkout reached through a symbolic link compares equal.
function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

export function isSameCheckoutRoot(left: string, right: string): boolean {
  return canonicalPath(left) === canonicalPath(right);
}

function isUnderRoot(path: string, root: string): boolean {
  return canonicalPath(path).startsWith(`${canonicalPath(root)}${sep}`);
}

// Whether an existing generated output was rendered for `root`, or undefined when its manifest cannot tell. A
// manifest records its root; one written before the root was recorded is judged by the absolute source paths it
// mapped: an output this checkout rendered maps at least one output path to the source file this build stages for
// it, while an output copied from another checkout maps each of them to that checkout's file. Sources outside `root`,
// such as private overlays, are the same for every checkout and prove nothing.
export function isOutputRenderedFor(
  manifest: IGeneratedOutputManifest,
  root: string,
  currentSourcePaths: ReadonlyMap<string, string>,
): boolean | undefined {
  if (manifest.root !== undefined) return isSameCheckoutRoot(manifest.root, root);
  let comparable = 0;
  for (const [outputPath, recordedSource] of Object.entries(manifest.sourcePaths ?? {})) {
    const currentSource = currentSourcePaths.get(outputPath);
    if (currentSource === undefined || !isUnderRoot(currentSource, root)) continue;
    if (canonicalPath(recordedSource) === canonicalPath(currentSource)) return true;
    comparable++;
  }
  return comparable > 0 ? false : undefined;
}

// Whether the settings-sync merge bases in `stateDir` were taken for `root`, or undefined when no root is recorded.
export async function isSettingsStateFor(stateDir: string, root: string): Promise<boolean | undefined> {
  const path = join(stateDir, SETTINGS_STATE_ROOT_FILE);
  if (!existsSync(path)) return undefined;
  const recorded: unknown = JSON.parse(await readFile(path, "utf-8"));
  const recordedRoot = typeof recorded === "object" && recorded !== null ? Reflect.get(recorded, "root") : undefined;
  return typeof recordedRoot === "string" && isSameCheckoutRoot(recordedRoot, root);
}

export async function recordSettingsStateRoot(stateDir: string, root: string): Promise<void> {
  await writeFile(join(stateDir, SETTINGS_STATE_ROOT_FILE), `${JSON.stringify({ root }, null, 2)}\n`, "utf-8");
}
