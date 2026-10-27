import { existsSync } from "fs";
import { chmod, lstat, mkdir, rm, stat } from "fs/promises";
import { dirname, join } from "path";

import type { ITemplateContext } from "../harnessBuild";
import { reverseTemplateObject } from "../reverseTemplateContent";
import { applySettingsChanges } from "./applySettingsChanges";
import { listSettingsChanges } from "./listSettingsChanges";
import { mergeSettingsValues } from "./mergeSettingsValues";
import { parseSettingsText } from "./parseSettingsText";
import type { ISettingsConflict, ISettingsSourceRepository, ISyncedSettingsFile, JsonValue } from "./types";

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

// Returns the registry source path when the sync wrote harness changes into it.
async function syncSettingsFile(file: ISyncedSettingsFile, options: ISyncSettingsFilesOptions): Promise<string | null> {
  const sourcePath = getSourcePath(file, options);
  const stagedPath = join(options.stagingDir, file.relativePath);
  const livePath = join(options.outputDir, file.relativePath);
  // Recorded as JSON whatever the settings format, so the extension says how to read it.
  const basePath = join(options.stateDir, `${file.relativePath}.json`);
  const renderedSourceText = await Bun.file(stagedPath).text();
  const source = parseSettingsText(renderedSourceText, sourcePath);

  await mkdir(dirname(basePath), { recursive: true });
  await replaceSymlinkWithFile(livePath);

  if (!existsSync(livePath)) {
    await mkdir(dirname(livePath), { recursive: true });
    await Bun.write(livePath, renderedSourceText);
    await Bun.write(basePath, `${JSON.stringify(source, null, 2)}\n`);
    return null;
  }

  const liveText = await Bun.file(livePath).text();
  const live = parseSettingsText(liveText, livePath);
  const base = existsSync(basePath) ? parseSettingsText(await Bun.file(basePath).text(), basePath) : undefined;
  const result = mergeSettingsValues({ base, live, source, liveOnlyKeyPaths: file.liveOnlyKeyPaths });

  const nextLiveText = applySettingsChanges(liveText, listSettingsChanges(live, result.liveValue), livePath);
  if (nextLiveText !== liveText) {
    await Bun.write(livePath, nextLiveText);
  }

  for (const conflict of result.conflicts) {
    console.warn(formatConflict(file.relativePath, conflict));
  }

  const sourceChanges = listSettingsChanges(source, result.sourceValue).map((change) => ({
    keyPath: change.keyPath,
    value: change.value === undefined ? undefined : reverseTemplateObject(change.value, options.templateContext),
  }));
  let writtenSourcePath: string | null = null;
  if (sourceChanges.length > 0) {
    const sourceText = await Bun.file(sourcePath).text();
    await Bun.write(sourcePath, applySettingsChanges(sourceText, sourceChanges, sourcePath));
    const changeLabel = sourceChanges.length === 1 ? "change" : "changes";
    console.log(`  - ↩️ Synced ${sourceChanges.length} harness settings ${changeLabel} into ${sourcePath}`);
    writtenSourcePath = sourcePath;
  }

  await Bun.write(basePath, `${JSON.stringify(result.liveValue, null, 2)}\n`);
  return writtenSourcePath;
}

// Parses every staged settings file so a broken registry source stops the build
// before any generated output is replaced.
export async function validateStagedSettingsFiles(options: ISyncSettingsFilesOptions): Promise<void> {
  for (const file of options.syncedSettingsFiles) {
    const sourcePath = getSourcePath(file, options);
    parseSettingsText(await Bun.file(join(options.stagingDir, file.relativePath)).text(), sourcePath);
  }
}

// Reconciles every synced settings file after the managed outputs are in place:
// harness-made edits are written back to the registry source, registry edits are
// applied to the live file, and the merged result becomes the next build's base.
// Source files that had no uncommitted edits beforehand are committed, so harness
// changes are recorded without sweeping in work in progress.
export async function syncSettingsFiles(options: ISyncSettingsFilesOptions): Promise<void> {
  const committablePaths: string[] = [];

  for (const file of options.syncedSettingsFiles) {
    const sourceState = await options.sourceRepository.getSourceState(getSourcePath(file, options));
    const writtenSourcePath = await syncSettingsFile(file, options);
    if (writtenSourcePath === null || options.shouldCommitSourceChanges === false) continue;

    if (sourceState === "clean" && await options.sourceRepository.hasSecrets(writtenSourcePath)) {
      console.warn(`  - ⚠️ Left synced settings uncommitted in ${writtenSourcePath}: gitleaks found possible secrets.`);
    } else if (sourceState === "clean") {
      committablePaths.push(writtenSourcePath);
    } else if (sourceState === "dirty") {
      console.warn(`  - ⚠️ Left synced settings uncommitted in ${writtenSourcePath}: it already had uncommitted edits.`);
    }
  }

  if (committablePaths.length > 0) {
    await options.sourceRepository.commit(committablePaths);
    console.log(`  - 📝 Committed synced settings: ${committablePaths.join(", ")}`);
  }
}
