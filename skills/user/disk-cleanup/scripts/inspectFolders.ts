import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FolderOptions, StaleFolder } from './types';

interface DirectorySummary {
  bytes: number;
  latestMtimeMs: number;
  latestAtimeMs: number;
  staleMatches: StaleFolder[];
}

class ConcurrencyLimiter {
  private activeCount = 0;
  private readonly waitingQueue: (() => void)[] = [];

  constructor(private readonly maxConcurrency: number) {}

  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolveWaiting) => {
        this.waitingQueue.push(resolveWaiting);
      });
    }
    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      const nextWaiting = this.waitingQueue.shift();
      if (nextWaiting) {
        nextWaiting();
      }
    }
  }
}

export function parseSizeToBytes(rawInput: string): number {
  const trimmed = rawInput.trim();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)$/);
  if (!match) {
    throw new Error(`Invalid size specification: "${rawInput}". Examples: 1, 1.5, 500M, 2GB`);
  }

  const numericValue = parseFloat(match[1] ?? '0');
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    throw new Error(`Size must be a positive number: "${rawInput}"`);
  }

  const rawUnit = (match[2] ?? '').toUpperCase();
  switch (rawUnit) {
    case '':
    case 'G':
    case 'GB':
      return Math.round(numericValue * 1024 * 1024 * 1024);
    case 'M':
    case 'MB':
      return Math.round(numericValue * 1024 * 1024);
    case 'K':
    case 'KB':
      return Math.round(numericValue * 1024);
    case 'T':
    case 'TB':
      return Math.round(numericValue * 1024 * 1024 * 1024 * 1024);
    case 'B':
      return Math.round(numericValue);
    default:
      throw new Error(`Unknown size unit: "${rawUnit}". Supported units: B, K, M, G, T`);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

export async function inspectStaleFolders(options: FolderOptions): Promise<StaleFolder[]> {
  const minSizeBytes = parseSizeToBytes(options.size);
  const limiter = new ConcurrencyLimiter(96);
  const currentTimeMs = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const stalenessThresholdMs = options.days * dayInMs;

  async function inspectDirectory(currentPath: string, currentDepth: number): Promise<DirectorySummary> {
    let accumulatedSize = 0;
    let maxMtimeMs = 0;
    let maxAtimeMs = 0;
    const collectedMatches: StaleFolder[] = [];

    let dirEntries: Dirent[] = [];
    try {
      dirEntries = await limiter.run(() => readdir(currentPath, { withFileTypes: true }));
    } catch {
      return {
        bytes: 0,
        latestMtimeMs: 0,
        latestAtimeMs: 0,
        staleMatches: [],
      };
    }

    const subDirectoryPromises: Promise<DirectorySummary>[] = [];
    const fileStatPromises: Promise<{ size: number; mtime: number; atime: number } | null>[] = [];

    for (const entry of dirEntries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryFullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (options.depth === undefined || currentDepth < options.depth) {
          subDirectoryPromises.push(inspectDirectory(entryFullPath, currentDepth + 1));
        }
      } else if (entry.isFile()) {
        fileStatPromises.push(
          limiter.run(async () => {
            try {
              const fileStats = await stat(entryFullPath);
              const allocatedBytes = (fileStats.blocks ?? Math.ceil(fileStats.size / 512)) * 512;
              return {
                size: allocatedBytes,
                mtime: fileStats.mtimeMs,
                atime: fileStats.atimeMs,
              };
            } catch {
              return null;
            }
          }),
        );
      }
    }

    const [subSummaries, fileStats] = await Promise.all([
      Promise.all(subDirectoryPromises),
      Promise.all(fileStatPromises),
    ]);

    for (const sub of subSummaries) {
      accumulatedSize += sub.bytes;
      if (sub.latestMtimeMs > maxMtimeMs) {
        maxMtimeMs = sub.latestMtimeMs;
      }
      if (sub.latestAtimeMs > maxAtimeMs) {
        maxAtimeMs = sub.latestAtimeMs;
      }
      for (const m of sub.staleMatches) {
        collectedMatches.push(m);
      }
    }

    for (const statItem of fileStats) {
      if (!statItem) {
        continue;
      }
      accumulatedSize += statItem.size;
      if (statItem.mtime > maxMtimeMs) {
        maxMtimeMs = statItem.mtime;
      }
      if (statItem.atime > maxAtimeMs) {
        maxAtimeMs = statItem.atime;
      }
    }

    const mtimeAgeMs = currentTimeMs - maxMtimeMs;
    const atimeAgeMs = currentTimeMs - maxAtimeMs;

    let isStale = false;
    switch (options.time) {
      case 'modified':
        isStale = maxMtimeMs > 0 && mtimeAgeMs >= stalenessThresholdMs;
        break;
      case 'accessed':
        isStale = maxAtimeMs > 0 && atimeAgeMs >= stalenessThresholdMs;
        break;
      case 'either':
        isStale =
          (maxMtimeMs === 0 || mtimeAgeMs >= stalenessThresholdMs) &&
          (maxAtimeMs === 0 || atimeAgeMs >= stalenessThresholdMs);
        break;
    }

    const isLargeEnough = accumulatedSize >= minSizeBytes;

    if (currentDepth > 0 && isLargeEnough && isStale) {
      const folderResult: StaleFolder = {
        path: currentPath,
        bytes: accumulatedSize,
        formattedSize: formatBytes(accumulatedSize),
        latestMtimeMs: maxMtimeMs,
        latestAtimeMs: maxAtimeMs,
        daysSinceModified: maxMtimeMs > 0 ? Math.floor(mtimeAgeMs / dayInMs) : -1,
        daysSinceAccessed: maxAtimeMs > 0 ? Math.floor(atimeAgeMs / dayInMs) : -1,
      };

      if (options.prune) {
        return {
          bytes: accumulatedSize,
          latestMtimeMs: maxMtimeMs,
          latestAtimeMs: maxAtimeMs,
          staleMatches: [folderResult],
        };
      }

      collectedMatches.push(folderResult);
    }

    return {
      bytes: accumulatedSize,
      latestMtimeMs: maxMtimeMs,
      latestAtimeMs: maxAtimeMs,
      staleMatches: collectedMatches,
    };
  }

  const rootSummary = await inspectDirectory(options.root, 0);
  return [...rootSummary.staleMatches].sort((a: StaleFolder, b: StaleFolder): number => b.bytes - a.bytes);
}
