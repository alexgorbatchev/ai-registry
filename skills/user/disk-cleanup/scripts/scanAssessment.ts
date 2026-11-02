import { lstat, readdir } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { isWithin } from './filesystemUtils';
import { formatBytes } from './inspectFolders';
import type { DiskUsage, Inventory, StaleFolder } from './types';

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
  overview: DiskUsage[];
  largePaths: DiskUsage[];
  staleFolders: StaleFolder[];
  allocations: Map<string, number | null>;
};

async function readDirectory(path: string) {
  return readdir(path, { withFileTypes: true });
}

export async function scanAssessment(
  root: string,
  minimumBytes: number,
  days: number,
  read: typeof readDirectory = readDirectory,
  reportRoot: string = root,
): Promise<AssessmentScan> {
  const result: AssessmentScan = {
    inventory: { repositories: [], dependencies: [], workspaces: [], errors: [] },
    overview: [],
    largePaths: [],
    staleFolders: [],
    allocations: new Map(),
  };
  const rootInfo = await lstat(root);
  const device = rootInfo.dev;
  const seen = new Set<string>();
  const now = Date.now();
  const cutoff = now - days * 86400000;
  async function walk(path: string, depth: number, repository: string | null, discover: boolean): Promise<Summary> {
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
      const info = depth === 0 ? rootInfo : await lstat(path);
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
        for (const entry of entries) {
          const childPath = join(path, entry.name);
          if (discover && basename(path) === '.workspaces' && entry.isDirectory())
            result.inventory.workspaces.push({ path: childPath, repository });
          if (discover && entry.name === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink()))
            result.inventory.dependencies.push({ path: childPath, repository, isSymlink: entry.isSymbolicLink() });
          const child = await walk(
            childPath,
            depth + 1,
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
        const inReport = path === reportRoot || isWithin(reportRoot, path);
        const reportDepth = path === reportRoot ? 0 : relative(reportRoot, path).split(sep).length;
        if (inReport && reportDepth <= 3) result.overview.push({ path, bytes: summary.bytes });
        if (
          inReport &&
          path !== reportRoot &&
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
      summary.complete = false;
      result.allocations.set(path, null);
      result.inventory.errors.push({ repository: path, message: String(error) });
    }
    return summary;
  }
  await walk(root, 0, null, root === reportRoot);
  result.overview.sort((a, b) => b.bytes - a.bytes);
  result.largePaths.sort((a, b) => b.bytes - a.bytes);
  result.staleFolders.sort((a, b) => b.bytes - a.bytes);
  return result;
}
