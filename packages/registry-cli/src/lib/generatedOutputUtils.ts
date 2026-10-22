import { createHash } from "crypto";
import { existsSync } from "fs";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rmdir,
  rm,
  symlink,
  writeFile,
} from "fs/promises";
import { dirname, isAbsolute, join, relative } from "path";

export const GENERATED_OUTPUT_MANIFEST_VERSION = 2;
export const GENERATED_OUTPUT_MANIFEST_NAME = "manifest.json";
export const LEGACY_GENERATED_OUTPUT_MANIFEST_NAME = ".generated-output-manifest.json";

const GENERATED_OUTPUT_IGNORED_PATH_PARTS = new Set(["node_modules"]);
const GENERATED_OUTPUT_IGNORED_BASENAMES = new Set([
  ".gitignore",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
]);

export type IGeneratedOutputManifestEntry =
  | { kind: "directory" }
  | { kind: "file"; checksum: string }
  | { kind: "symlink"; target: string };

export interface IGeneratedOutputManifest {
  version: number;
  generatedAt: string;
  entries: Record<string, IGeneratedOutputManifestEntry>;
  sourcePaths?: Record<string, string>;
  sourceChecksums?: Record<string, string>;
}

export interface IGeneratedOutputDrift {
  path: string;
  reason: "missing" | "modified";
}

export interface IUnmanagedOutputPaths {
  // Output-relative directory paths that a harness tool owns at runtime. They and
  // everything under them are left out of the collected entries, so the manifest
  // never tracks them and their disappearance is never reported as drift.
  runtimeDirectoryPaths?: readonly string[];
  // Output-relative settings files that the harness edits and the build reconciles
  // with their registry source. They are neither tracked, reported, nor removed.
  syncedFilePaths?: readonly string[];
}

export interface ISyncManagedGeneratedOutputsOptions extends IUnmanagedOutputPaths {
  nextEntries: Record<string, IGeneratedOutputManifestEntry>;
  nextOutputDir: string;
  outputDir: string;
  previousManifest: IGeneratedOutputManifest | null;
  expectedCurrentEntries?: Record<string, IGeneratedOutputManifestEntry>;
}

// Registers the directories a harness build materializes only so that every
// generated profile shares them (session stores, todo lists, logs). The tool
// creates, fills, and prunes them afterwards, so they are "ensure-present,
// unmanaged": created in staging, recreated on sync, excluded from the manifest.
export interface IRuntimeDirectoryRegistry {
  ensureRuntimeDirectory(dirPath: string): Promise<void>;
  getRuntimeDirectoryPaths(): string[];
}

function createFileChecksum(fileBuffer: Buffer): string {
  return createHash("sha256").update(fileBuffer).digest("hex");
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function shouldIgnoreGeneratedOutputPath(relativePath: string): boolean {
  const pathParts = relativePath.split("/");
  const basename = pathParts[pathParts.length - 1];

  return (
    GENERATED_OUTPUT_IGNORED_BASENAMES.has(basename) ||
    pathParts.some((part) => GENERATED_OUTPUT_IGNORED_PATH_PARTS.has(part))
  );
}

function isUnmanagedPath(relativePath: string, unmanagedPaths: IUnmanagedOutputPaths): boolean {
  const runtimeDirectoryPaths = unmanagedPaths.runtimeDirectoryPaths ?? [];
  const syncedFilePaths = unmanagedPaths.syncedFilePaths ?? [];
  return (
    syncedFilePaths.includes(relativePath) ||
    runtimeDirectoryPaths.some(
      (runtimeDirectoryPath) => relativePath === runtimeDirectoryPath || relativePath.startsWith(`${runtimeDirectoryPath}/`),
    )
  );
}

export function createRuntimeDirectoryRegistry(rootDir: string): IRuntimeDirectoryRegistry {
  const runtimeDirectoryPaths = new Set<string>();

  return {
    async ensureRuntimeDirectory(dirPath: string): Promise<void> {
      const relativePath = normalizeRelativePath(relative(rootDir, dirPath));
      if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new Error(`Runtime directory must be inside the generated output root ${rootDir}: ${dirPath}`);
      }

      await mkdir(dirPath, { recursive: true });
      runtimeDirectoryPaths.add(relativePath);
    },
    getRuntimeDirectoryPaths(): string[] {
      return [...runtimeDirectoryPaths].sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
    },
  };
}

function sortManifestEntries(
  entries: Record<string, IGeneratedOutputManifestEntry>,
): Record<string, IGeneratedOutputManifestEntry> {
  return Object.fromEntries(
    Object.entries(entries).sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)),
  );
}

function getManifestPathDepth(relativePath: string): number {
  return relativePath.split("/").length;
}

function resolveManifestPath(rootDir: string, relativePath: string): string {
  return join(rootDir, ...relativePath.split("/"));
}

async function getExistingPathKind(path: string): Promise<IGeneratedOutputManifestEntry["kind"] | null> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      return "symlink";
    }

    if (stat.isDirectory()) {
      return "directory";
    }

    return "file";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function removeManagedPath(outputDir: string, relativePath: string): Promise<void> {
  const absolutePath = resolveManifestPath(outputDir, relativePath);
  const existingKind = await getExistingPathKind(absolutePath);
  if (!existingKind) {
    return;
  }

  if (existingKind === "directory") {
    try {
      await rmdir(absolutePath);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOTEMPTY") {
        return;
      }

      throw error;
    }

    return;
  }

  await rm(absolutePath, { force: true, recursive: true });
}

function remapSymlinkTarget(target: string, nextOutputDir: string, outputDir: string): string {
  if (!target.startsWith(nextOutputDir)) {
    return target;
  }

  const relativeTargetPath = normalizeRelativePath(relative(nextOutputDir, target));
  if (relativeTargetPath === "") {
    return outputDir;
  }

  return resolveManifestPath(outputDir, relativeTargetPath);
}

async function writeManagedEntry(
  nextOutputDir: string,
  outputDir: string,
  relativePath: string,
  entry: IGeneratedOutputManifestEntry,
): Promise<void> {
  const sourcePath = resolveManifestPath(nextOutputDir, relativePath);
  const destinationPath = resolveManifestPath(outputDir, relativePath);

  if (entry.kind === "directory") {
    const existingKind = await getExistingPathKind(destinationPath);
    if (existingKind && existingKind !== "directory") {
      await rm(destinationPath, { force: true, recursive: true });
    }

    await mkdir(destinationPath, { recursive: true });
    return;
  }

  await mkdir(dirname(destinationPath), { recursive: true });
  await rm(destinationPath, { force: true, recursive: true });

  if (entry.kind === "symlink") {
    const target = remapSymlinkTarget(entry.target, nextOutputDir, outputDir);
    await symlink(target, destinationPath);
    return;
  }

  const fileContent = await readFile(sourcePath);
  const sourceStat = await lstat(sourcePath);
  await writeFile(destinationPath, fileContent);
  await chmod(destinationPath, sourceStat.mode);
}

export function createGeneratedOutputManifest(
  entries: Record<string, IGeneratedOutputManifestEntry>,
): IGeneratedOutputManifest {
  return {
    version: GENERATED_OUTPUT_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    entries: sortManifestEntries(entries),
  };
}

export async function collectGeneratedOutputEntries(
  rootDir: string,
  options: IUnmanagedOutputPaths = {},
  currentDir: string = rootDir,
): Promise<Record<string, IGeneratedOutputManifestEntry>> {
  if (!existsSync(currentDir)) {
    return {};
  }

  const collectedEntries: Record<string, IGeneratedOutputManifestEntry> = {};
  const directoryEntries = await readdir(currentDir, { withFileTypes: true });
  for (const directoryEntry of directoryEntries) {
    const entryPath = join(currentDir, directoryEntry.name);
    const relativePath = normalizeRelativePath(entryPath.slice(rootDir.length + 1));

    if (
      relativePath === GENERATED_OUTPUT_MANIFEST_NAME ||
      relativePath === LEGACY_GENERATED_OUTPUT_MANIFEST_NAME ||
      shouldIgnoreGeneratedOutputPath(relativePath) ||
      isUnmanagedPath(relativePath, options)
    ) {
      continue;
    }

    if (directoryEntry.isSymbolicLink()) {
      collectedEntries[relativePath] = {
        kind: "symlink",
        target: await readlink(entryPath),
      };
      continue;
    }

    if (directoryEntry.isDirectory()) {
      collectedEntries[relativePath] = { kind: "directory" };
      Object.assign(
        collectedEntries,
        await collectGeneratedOutputEntries(rootDir, options, entryPath),
      );
      continue;
    }

    if (!directoryEntry.isFile()) {
      continue;
    }

    const fileBuffer = await readFile(entryPath);
    collectedEntries[relativePath] = {
      kind: "file",
      checksum: createFileChecksum(fileBuffer),
    };
  }

  return sortManifestEntries(collectedEntries);
}

function areManifestEntriesEqual(
  leftEntry: IGeneratedOutputManifestEntry,
  rightEntry: IGeneratedOutputManifestEntry,
): boolean {
  switch (leftEntry.kind) {
    case "directory": {
      return rightEntry.kind === "directory";
    }
    case "file": {
      return rightEntry.kind === "file" && leftEntry.checksum === rightEntry.checksum;
    }
    case "symlink": {
      return rightEntry.kind === "symlink" && leftEntry.target === rightEntry.target;
    }
  }
}

// Manifest entries under unmanaged paths are skipped: a manifest written before a
// path became unmanaged still lists it, and its absence or change is not drift.
export function getGeneratedOutputDrift(
  manifest: IGeneratedOutputManifest,
  currentEntries: Record<string, IGeneratedOutputManifestEntry>,
  options: IUnmanagedOutputPaths = {},
): IGeneratedOutputDrift[] {
  const drift: IGeneratedOutputDrift[] = [];

  for (const [relativePath, expectedEntry] of Object.entries(manifest.entries)) {
    if (isUnmanagedPath(relativePath, options)) {
      continue;
    }

    const currentEntry = currentEntries[relativePath];
    if (!currentEntry) {
      drift.push({ path: relativePath, reason: "missing" });
      continue;
    }

    if (!areManifestEntriesEqual(expectedEntry, currentEntry)) {
      drift.push({ path: relativePath, reason: "modified" });
    }
  }

  return drift.sort((leftEntry, rightEntry) => leftEntry.path.localeCompare(rightEntry.path));
}

// Unmanaged paths are never removed, even when an older manifest still lists them
// as managed entries; runtime directories are also ensured to exist afterwards.
export async function syncManagedGeneratedOutputs(
  options: ISyncManagedGeneratedOutputsOptions,
): Promise<void> {
  const runtimeDirectoryPaths = options.runtimeDirectoryPaths ?? [];
  if (options.expectedCurrentEntries) {
    const currentEntries = await collectGeneratedOutputEntries(options.outputDir, options);
    const affectedPaths = new Set([
      ...Object.keys(options.previousManifest?.entries ?? {}),
      ...Object.keys(options.nextEntries),
    ]);
    for (const path of affectedPaths) {
      if (isUnmanagedPath(path, options)) continue;
      const expected = options.expectedCurrentEntries[path];
      const current = currentEntries[path];
      const isUnchanged = expected === undefined ? current === undefined
        : current !== undefined && areManifestEntriesEqual(expected, current);
      if (!isUnchanged) {
        throw new Error(`Output application suspended: ${path} changed after recovery preflight. Preserve its edits and retry reconciliation.`);
      }
    }
  }
  await mkdir(options.outputDir, { recursive: true });

  if (options.previousManifest) {
    const previousPaths = Object.keys(options.previousManifest.entries).sort(
      (leftPath, rightPath) => getManifestPathDepth(rightPath) - getManifestPathDepth(leftPath),
    );

    for (const previousPath of previousPaths) {
      if (previousPath in options.nextEntries || isUnmanagedPath(previousPath, options)) {
        continue;
      }

      await removeManagedPath(options.outputDir, previousPath);
    }
  }

  const nextPaths = Object.keys(options.nextEntries).sort(
    (leftPath, rightPath) => getManifestPathDepth(leftPath) - getManifestPathDepth(rightPath),
  );

  for (const nextPath of nextPaths) {
    const nextEntry = options.nextEntries[nextPath];
    await writeManagedEntry(options.nextOutputDir, options.outputDir, nextPath, nextEntry);
  }

  for (const runtimeDirectoryPath of runtimeDirectoryPaths) {
    await mkdir(resolveManifestPath(options.outputDir, runtimeDirectoryPath), { recursive: true });
  }
}
