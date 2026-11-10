import { existsSync } from "fs";
import { chmod, lstat, mkdir, rm, stat } from "fs/promises";
import { dirname, join } from "path";

import type { ITemplateContext } from "../harnessBuild";
import { reverseTemplateObject } from "../reverseTemplateContent";
import { applySettingsChanges } from "./applySettingsChanges";
import { listSettingsChanges } from "./listSettingsChanges";
import { mergeSettingsValues } from "./mergeSettingsValues";
import { parseSettingsText } from "./parseSettingsText";
import { mergeSettingsLayers, routeSettingsChanges } from "./settingsLayerUtils";
import type {
  IJsonObject,
  ISettingsChange,
  ISettingsConflict,
  ISettingsSourceLayer,
  ISettingsSourceRepository,
  ISyncedSettingsFile,
  JsonValue,
  SettingsSourceState,
} from "./types";

export interface ISyncSettingsFilesOptions {
  syncedSettingsFiles: ISyncedSettingsFile[];
  // Build staging root holding each file rendered from its registry source.
  stagingDir: string;
  // Generated output root holding the live files the harnesses read and edit.
  outputDir: string;
  // Directory that records each file's settings as of the previous build.
  stateDir: string;
  sourcePathByOutputPath: Map<string, string>;
  templateContext: ITemplateContext;
  sourceRepository: ISettingsSourceRepository;
  // Scheduled updates sync edits without creating commits. Defaults to true.
  shouldCommitSourceChanges?: boolean;
  // Private overlay layers merged over each file's registry source, keyed by the
  // file's relative path.
  overlayLayers?: ReadonlyMap<string, ISettingsSourceLayer[]>;
}

function formatValue(value: JsonValue | undefined): string {
  return value === undefined ? "(removed)" : JSON.stringify(value);
}

function formatConflict(relativePath: string, conflict: ISettingsConflict): string {
  const keptSide = conflict.kept === "source" ? "registry" : "harness";
  return `  - ⚠️ ${relativePath}: \`${conflict.keyPath.join(".")}\` differs between the registry and the harness; kept the ${keptSide} value (registry: ${formatValue(conflict.sourceValue)}, harness: ${formatValue(conflict.liveValue)})`;
}

function getSourcePath(file: ISyncedSettingsFile, options: ISyncSettingsFilesOptions): string {
  const sourcePath = options.sourcePathByOutputPath.get(join(options.stagingDir, file.relativePath));
  if (!sourcePath) {
    throw new Error(`Cannot sync settings file ${file.relativePath}: no registry source file produced it.`);
  }
  return sourcePath;
}

// Earlier layouts linked some live settings files (Codex `config.toml`) to state
// outside the generated output. A synced file must be a regular file, so a link is
// replaced by a copy of what it points to, keeping its permissions; a dangling link
// is removed so the file is installed fresh.
async function replaceSymlinkWithFile(livePath: string): Promise<void> {
  const linkStats = await lstat(livePath).catch(() => null);
  if (!linkStats?.isSymbolicLink()) return;

  const targetStats = await stat(livePath).catch(() => null);
  const content = targetStats ? await Bun.file(livePath).bytes() : null;
  await rm(livePath);
  if (targetStats && content) {
    await Bun.write(livePath, content);
    await chmod(livePath, targetStats.mode);
  }
}

// The registry layers of a synced file: the public source the build staged, then the
// private overlay layers merged over it.
async function getSourceLayers(
  file: ISyncedSettingsFile,
  options: ISyncSettingsFilesOptions,
): Promise<ISettingsSourceLayer[]> {
  const renderedText = await Bun.file(join(options.stagingDir, file.relativePath)).text();
  return [
    { sourcePath: getSourcePath(file, options), renderedText },
    ...(options.overlayLayers?.get(file.relativePath) ?? []),
  ];
}

// Writes each layer's share of the harness edits into its registry file and returns
// the files it changed.
async function writeSourceChanges(
  layers: ISettingsSourceLayer[],
  layerValues: IJsonObject[],
  sourceChanges: ISettingsChange[],
): Promise<string[]> {
  const writtenSourcePaths: string[] = [];
  const changesByLayer = routeSettingsChanges(layerValues, sourceChanges);
  for (const [index, layer] of layers.entries()) {
    const layerChanges = changesByLayer[index] ?? [];
    if (layerChanges.length === 0) continue;
    const sourceText = await Bun.file(layer.sourcePath).text();
    await Bun.write(layer.sourcePath, applySettingsChanges(sourceText, layerChanges, layer.sourcePath));
    const changeLabel = layerChanges.length === 1 ? "change" : "changes";
    console.log(`  - ↩️ Synced ${layerChanges.length} harness settings ${changeLabel} into ${layer.sourcePath}`);
    writtenSourcePaths.push(layer.sourcePath);
  }
  return writtenSourcePaths;
}

// Returns the registry source files the sync wrote harness changes into.
async function syncSettingsFile(
  file: ISyncedSettingsFile,
  layers: ISettingsSourceLayer[],
  options: ISyncSettingsFilesOptions,
): Promise<string[]> {
  const livePath = join(options.outputDir, file.relativePath);
  // Recorded as JSON whatever the settings format, so the extension says how to read it.
  const basePath = join(options.stateDir, `${file.relativePath}.json`);
  const layerValues = layers.map((layer) => parseSettingsText(layer.renderedText, layer.sourcePath));
  const source = mergeSettingsLayers(layerValues);

  await mkdir(dirname(basePath), { recursive: true });
  await replaceSymlinkWithFile(livePath);

  // A first build installs the rendered public source with the overlays merged over it,
  // still merged so that source entries conditioned on harness-written tables are left out.
  const hasLiveFile = existsSync(livePath);
  const [publicLayer] = layers;
  const [publicValue] = layerValues;
  const initialLiveText =
    publicLayer === undefined || publicValue === undefined
      ? "{}\n"
      : applySettingsChanges(publicLayer.renderedText, listSettingsChanges(publicValue, source), livePath);
  const liveText = hasLiveFile ? await Bun.file(livePath).text() : initialLiveText;
  const live = parseSettingsText(liveText, livePath);
  const base =
    hasLiveFile && existsSync(basePath) ? parseSettingsText(await Bun.file(basePath).text(), basePath) : undefined;
  const result = mergeSettingsValues({
    base,
    live,
    source,
    liveOnlyKeyPaths: file.liveOnlyKeyPaths,
    sourceJsonObjects: file.sourceJsonObjects,
  });

  const nextLiveText = applySettingsChanges(liveText, listSettingsChanges(live, result.liveValue), livePath);
  if (!hasLiveFile || nextLiveText !== liveText) {
    await mkdir(dirname(livePath), { recursive: true });
    await Bun.write(livePath, nextLiveText);
  }

  for (const conflict of result.conflicts) {
    console.warn(formatConflict(file.relativePath, conflict));
  }

  const sourceChanges = listSettingsChanges(source, result.sourceValue).map((change) => ({
    keyPath: change.keyPath,
    value: change.value === undefined ? undefined : reverseTemplateObject(change.value, options.templateContext),
  }));
  const writtenSourcePaths = await writeSourceChanges(layers, layerValues, sourceChanges);

  await Bun.write(basePath, `${JSON.stringify(result.liveValue, null, 2)}\n`);
  return writtenSourcePaths;
}

// Parses every staged settings file so a broken registry source stops the build
// before any generated output is replaced.
export async function validateStagedSettingsFiles(options: ISyncSettingsFilesOptions): Promise<void> {
  for (const file of options.syncedSettingsFiles) {
    for (const layer of await getSourceLayers(file, options)) {
      parseSettingsText(layer.renderedText, layer.sourcePath);
    }
  }
}

// Reconciles every synced settings file after the managed outputs are in place:
// harness-made edits are written back to the registry layer that owns each key,
// registry edits are applied to the live file, and the merged result becomes the
// next build's base. Source files that had no uncommitted edits beforehand are
// committed, so harness changes are recorded without sweeping in work in progress.
export async function syncSettingsFiles(options: ISyncSettingsFilesOptions): Promise<void> {
  const committablePaths: string[] = [];

  for (const file of options.syncedSettingsFiles) {
    const layers = await getSourceLayers(file, options);
    const sourceStates = new Map<string, SettingsSourceState>();
    for (const layer of layers) {
      sourceStates.set(layer.sourcePath, await options.sourceRepository.getSourceState(layer.sourcePath));
    }
    const writtenSourcePaths = await syncSettingsFile(file, layers, options);
    if (options.shouldCommitSourceChanges === false) continue;

    for (const writtenSourcePath of writtenSourcePaths) {
      const sourceState = sourceStates.get(writtenSourcePath);
      if (sourceState === "clean" && (await options.sourceRepository.hasSecrets(writtenSourcePath))) {
        console.warn(
          `  - ⚠️ Left synced settings uncommitted in ${writtenSourcePath}: gitleaks found possible secrets.`,
        );
      } else if (sourceState === "clean") {
        committablePaths.push(writtenSourcePath);
      } else if (sourceState === "dirty") {
        console.warn(
          `  - ⚠️ Left synced settings uncommitted in ${writtenSourcePath}: it already had uncommitted edits.`,
        );
      }
    }
  }

  if (committablePaths.length > 0) {
    await options.sourceRepository.commit(committablePaths);
    console.log(`  - 📝 Committed synced settings: ${committablePaths.join(", ")}`);
  }
}
