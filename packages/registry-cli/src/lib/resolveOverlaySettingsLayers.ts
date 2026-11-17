import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { isAbsolute, join, relative } from "path";

import { readToolManifest } from "./getRegistryPaths";
import type { ISettingsSourceLayer, ISyncedSettingsFile } from "./settingsSync/types";

export interface IResolveOverlaySettingsLayersOptions {
  // The public registry's `harnesses/` directory.
  harnessesDir: string;
  // Every overlay in layering order: tool overlays first, then private overlays.
  overlayDirs: string[];
  // The overlays in `overlayDirs` that are the registry's own tool overlays.
  toolDirs?: string[];
  syncedSettingsFiles: ISyncedSettingsFile[];
  stagingDir: string;
  sourcePathByOutputPath: Map<string, string>;
  // Renders an overlay file's template tags the way the build renders staged files.
  renderLayer(sourcePath: string, content: string): Promise<string>;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

function getEmptySettingsText(filePath: string): string {
  return filePath.endsWith(".toml") ? "" : "{}\n";
}

function getToolTraits(toolDir: string): Pick<ISettingsSourceLayer, "isTool" | "ownedMarkers"> {
  const { owns } = readToolManifest(toolDir);
  return owns.length > 0 ? { isTool: true, ownedMarkers: owns } : { isTool: true };
}

// Finds the overlay layers of every synced settings file: an overlay file at
// `harnesses/<path>` layers the public `harnesses/<path>` source, in overlay order.
// Overlays carry only such layers, so any other file under an overlay's `harnesses/`
// fails the build instead of being silently ignored.
export async function resolveOverlaySettingsLayers(
  options: IResolveOverlaySettingsLayersOptions,
): Promise<Map<string, ISettingsSourceLayer[]>> {
  const layersByFile = new Map<string, ISettingsSourceLayer[]>();
  const layerPaths = new Set<string>();

  for (const file of options.syncedSettingsFiles) {
    const sourcePath = options.sourcePathByOutputPath.get(join(options.stagingDir, file.relativePath));
    if (sourcePath === undefined) continue;
    const harnessPath = relative(options.harnessesDir, sourcePath);
    if (harnessPath.startsWith("..") || isAbsolute(harnessPath)) continue;

    const layers: ISettingsSourceLayer[] = [];
    for (const overlayDir of options.overlayDirs) {
      const layerPath = join(overlayDir, "harnesses", harnessPath);
      const toolTraits = options.toolDirs?.includes(overlayDir) ? getToolTraits(overlayDir) : undefined;
      if (!existsSync(layerPath)) {
        // A tool that owns settings values takes them even before it has a file for this
        // settings file, so running its installer once is enough to capture its entries.
        if (toolTraits?.ownedMarkers !== undefined) {
          layers.push({ sourcePath: layerPath, renderedText: getEmptySettingsText(layerPath), ...toolTraits });
        }
        continue;
      }
      layers.push({
        sourcePath: layerPath,
        renderedText: await options.renderLayer(layerPath, await Bun.file(layerPath).text()),
        ...toolTraits,
      });
      layerPaths.add(layerPath);
    }
    if (layers.length > 0) {
      layersByFile.set(file.relativePath, layers);
    }
  }

  const unmatchedPaths: string[] = [];
  for (const overlayDir of options.overlayDirs) {
    const overlayHarnessesDir = join(overlayDir, "harnesses");
    if (!existsSync(overlayHarnessesDir)) continue;
    for (const filePath of await listFiles(overlayHarnessesDir)) {
      if (!layerPaths.has(filePath)) unmatchedPaths.push(filePath);
    }
  }
  if (unmatchedPaths.length > 0) {
    throw new Error(
      `Overlay harness files must layer a synced settings file at the same path under the registry's harnesses/: ${unmatchedPaths.sort().join(", ")}`,
    );
  }

  return layersByFile;
}
