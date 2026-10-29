import { lstat, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { diskBytes, ensureUntracked, git, isWithin } from './filesystemUtils';
import type { Dependency, Inventory, Workspace, InspectionError } from './types';

export async function inventory(root: string): Promise<Inventory> {
  const repositories: string[] = [];
  const dependencies: Workspace[] = [];
  const workspaces: Workspace[] = [];
  const errors: InspectionError[] = [];
  const rootDevice = (await stat(root)).dev;
  async function walk(path: string, repository: string | null): Promise<void> {
    try {
      if ((await stat(path)).dev !== rootDevice) return;
      const entries = await readdir(path, { withFileTypes: true });
      if (entries.some((entry) => entry.name === '.git')) {
        repository = path;
        repositories.push(path);
      }
      for (const entry of entries) {
        const childPath = join(path, entry.name);
        if (basename(path) === '.workspaces' && entry.isDirectory()) workspaces.push({ path: childPath, repository });
        if (entry.name === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink())) {
          dependencies.push({ path: childPath, repository });
        } else if (entry.isDirectory() && entry.name !== '.git') {
          await walk(childPath, repository);
        }
      }
    } catch (error) {
      errors.push({ repository: path, message: String(error) });
    }
  }
  await walk(root, null);
  return { repositories, dependencies, workspaces, errors };
}

export async function latestGitActivity(repository: string): Promise<number | null> {
  let latest: number = 0;
  const commits = await git(repository, ['log', '--all', '--format=%ct']);
  for (const timestamp of commits.trim().split('\n')) latest = Math.max(latest, Number(timestamp) || 0);
  const reflog = await git(repository, ['reflog', 'show', '--all', '--date=unix', '--format=%gD']);
  for (const selector of reflog.split('\n')) {
    const match = selector.match(/@\{(\d+)\}/);
    if (match) latest = Math.max(latest, Number(match[1]));
  }
  const fetchPath = (await git(repository, ['rev-parse', '--path-format=absolute', '--git-path', 'FETCH_HEAD'])).trim();
  try {
    latest = Math.max(latest, Math.floor((await stat(fetchPath)).mtimeMs / 1000));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  return latest || null;
}

export async function inspectDependencies(
  root: string,
  days: number,
  onError: (error: InspectionError) => void = () => {},
): Promise<Dependency[]> {
  const items = await inventory(root);
  for (const error of items.errors) onError(error);
  const activity = new Map<string, number | null>();
  const result: Dependency[] = [];
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  for (const item of items.dependencies) {
    let isSymlink: boolean | null = null;
    let bytes: number | null = null;
    let latestActivity: number | null = null;
    let eligible: boolean = false;
    let reason: string = 'no owning Git repository';
    try {
      isSymlink = (await lstat(item.path)).isSymbolicLink();
      bytes = await diskBytes(item.path);
      if (isSymlink) reason = 'symbolic link';
      else if (item.repository) {
        if (!activity.has(item.repository)) activity.set(item.repository, await latestGitActivity(item.repository));
        latestActivity = activity.get(item.repository) ?? null;
        reason = 'no verifiable Git history';
        if (latestActivity !== null) {
          reason = 'recent Git activity';
          if (latestActivity < cutoff) {
            try {
              await ensureUntracked(item.repository, item.path);
              eligible = true;
              reason = `no Git activity within ${days} days`;
            } catch (error) {
              if (!(error instanceof Error && error.message.startsWith('Contains Git-tracked files:'))) throw error;
              reason = error.message;
            }
          }
        }
      }
    } catch (error) {
      reason = String(error);
      onError({ repository: item.path, message: reason });
    }
    result.push({ ...item, isSymlink, bytes, latestActivity, eligible, reason });
  }
  return result.sort((left, right) => (right.bytes ?? -1) - (left.bytes ?? -1));
}

export function assertDisjoint(root: string, paths: string[]): void {
  for (const path of paths) {
    if (!isWithin(root, path)) throw new Error(`Target is outside root: ${path}`);
    if (paths.some((other) => other !== path && isWithin(other, path))) {
      throw new Error('Overlapping targets must be reviewed separately');
    }
  }
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate targets');
}
