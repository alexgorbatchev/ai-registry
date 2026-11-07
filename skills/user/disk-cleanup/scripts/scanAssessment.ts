import { lstat, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import pLimit from 'p-limit';
import { pMapIterable } from 'p-map';
import { isMissing, isWithin } from './filesystemUtils';
import { formatBytes } from './inspectFolders';
import type { AssessmentScanOptions, AssessmentScanProgress, DiskUsage, Inventory, StaleFolder } from './types';
import type { Stats } from 'node:fs';

type Summary = {
  bytes: number;
  allocated: number;
  fileBytes: number;
  mtime: number;
  atime: number;
  complete: boolean;
  links: Map<string, number>;
};
export type AssessmentScan = {
  inventory: Inventory;
  largePaths: DiskUsage[];
  /** Permission-denied paths below the scan root: declared exclusions, not inspection failures. */
  restricted: string[];
  staleFolders: StaleFolder[];
  allocations: Map<string, number | null>;
};

function isPermissionDenied(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'EACCES' || error.code === 'EPERM');
}

async function readDirectory(path: string) {
  return readdir(path, { withFileTypes: true });
}

export async function scanAssessment(
  root: string,
  minimumBytes: number,
  days: number,
  read: typeof readDirectory = readDirectory,
  reportRoot: string = root,
  progress: (value: AssessmentScanProgress) => void = () => {},
  { concurrency = 64, stat = lstat }: AssessmentScanOptions = {},
): Promise<AssessmentScan> {
  const metadata = pLimit(concurrency);
  const result: AssessmentScan = {
    inventory: { repositories: [], dependencies: [], workspaces: [], errors: [] },
    largePaths: [],
    restricted: [],
    staleFolders: [],
    allocations: new Map(),
  };
  const rootInfo = await stat(root);
  const device = rootInfo.dev;
  const seen = new Set<string>();
  const now = Date.now();
  const cutoff = now - days * 86400000;
  let entries = 0;
  async function walk(
    path: string,
    metadataResult: PromiseSettledResult<Stats>,
    repository: string | null,
    discover: boolean,
  ): Promise<Summary> {
    progress({ root, entries: ++entries });
    const staleStart = result.staleFolders.length;
    const summary: Summary = {
      bytes: 0,
      allocated: 0,
      fileBytes: 0,
      mtime: 0,
      atime: 0,
      complete: true,
      links: new Map(),
    };
    try {
      if (metadataResult.status === 'rejected') throw metadataResult.reason;
      const info = metadataResult.value;
      if (info.dev !== device) return summary;
      const bytes = info.blocks * 512;
      const key = `${info.dev}:${info.ino}`;
      summary.allocated = bytes;

      if (info.nlink > 1 && !info.isDirectory()) {
        summary.links.set(key, bytes);
        if (!seen.has(key)) summary.bytes = bytes;
        seen.add(key);
      } else summary.bytes = bytes;
      if (info.isFile()) {
        summary.fileBytes = bytes;
        summary.mtime = info.mtimeMs;
        summary.atime = info.atimeMs;
      }
      if (info.isDirectory()) {
        const entries = await read(path);
        if (path === reportRoot) {
          discover = true;
          repository = null;
        }
        if (discover && entries.some((entry) => entry.name === '.git')) {
          repository = path;
          result.inventory.repositories.push(path);
        }
        // Prefetch metadata only. Ordered traversal owns hard-link attribution and stale-parent pruning.
        const children = pMapIterable(
          entries,
          async (entry) => {
            const [info] = await Promise.allSettled([metadata(stat, join(path, entry.name))]);
            return { entry, info };
          },
          { concurrency, backpressure: concurrency },
        );
        for await (const { entry, info } of children) {
          const childPath = join(path, entry.name);
          if (discover && basename(path) === '.workspaces' && entry.isDirectory())
            result.inventory.workspaces.push({ path: childPath, repository });
          if (discover && entry.name === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink()))
            result.inventory.dependencies.push({ path: childPath, repository, isSymlink: entry.isSymbolicLink() });
          const child = await walk(
            childPath,
            info,
            repository,
            discover && entry.name !== '.git' && entry.name !== 'node_modules' && !entry.isSymbolicLink(),
          );
          summary.bytes += child.bytes;
          summary.allocated += child.allocated;
          for (const [inode, allocation] of child.links) {
            if (summary.links.has(inode)) summary.allocated -= allocation;
            else summary.links.set(inode, allocation);
          }
          summary.fileBytes += child.fileBytes;
          summary.mtime = Math.max(summary.mtime, child.mtime);
          summary.atime = Math.max(summary.atime, child.atime);
          summary.complete &&= child.complete;
        }
        result.allocations.set(path, summary.complete ? summary.allocated : null);
        if (
          isWithin(reportRoot, path) &&
          summary.complete &&
          summary.fileBytes >= minimumBytes &&
          summary.mtime <= cutoff &&
          summary.atime <= cutoff
        ) {
          result.staleFolders.splice(staleStart);
          result.staleFolders.push({
            path,
            bytes: summary.fileBytes,
            formattedSize: formatBytes(summary.fileBytes),
            latestMtimeMs: summary.mtime,
            latestAtimeMs: summary.atime,
            daysSinceModified: summary.mtime > 0 ? Math.floor((now - summary.mtime) / 86400000) : -1,
            daysSinceAccessed: summary.atime > 0 ? Math.floor((now - summary.atime) / 86400000) : -1,
          });
        }
      } else if (info.isSymbolicLink() && basename(path) === 'node_modules') {
        result.allocations.set(path, bytes);
      }
      if (summary.bytes >= minimumBytes) result.largePaths.push({ path, bytes: summary.bytes });
    } catch (error) {
      // A descendant removed after its parent was listed no longer occupies space: count nothing for it.
      if (path !== root && isMissing(error)) {
        result.staleFolders.splice(staleStart);
        return { bytes: 0, allocated: 0, fileBytes: 0, mtime: 0, atime: 0, complete: true, links: new Map() };
      }
      summary.complete = false;
      result.allocations.set(path, null);
      // An unreadable scan root is a failure; an unreadable descendant is a reported exclusion.
      if (path !== root && isPermissionDenied(error)) result.restricted.push(path);
      else result.inventory.errors.push({ repository: path, message: String(error) });
    }
    return summary;
  }
  await walk(root, { status: 'fulfilled', value: rootInfo }, null, root === reportRoot);
  result.largePaths.sort((a, b) => b.bytes - a.bytes);
  result.staleFolders.sort((a, b) => b.bytes - a.bytes);
  return result;
}

/** Reads a directory allocation recorded by a scan; incomplete or unscanned paths are unavailable. */
export function allocationReader(allocations: Map<string, number | null>): (path: string) => Promise<number> {
  return async (path) => {
    const bytes = allocations.get(path);
    if (bytes === null || bytes === undefined) throw new Error(`Allocation unavailable: ${path}`);
    return bytes;
  };
}

export type Discovery = { inventory: Inventory; restricted: string[]; measure: (path: string) => Promise<number> };

/** Discovers repositories, dependencies, and workspaces with their allocations in one traversal. */
export async function discover(root: string): Promise<Discovery> {
  const scan = await scanAssessment(root, Number.POSITIVE_INFINITY, 0);
  return { inventory: scan.inventory, restricted: scan.restricted, measure: allocationReader(scan.allocations) };
}
