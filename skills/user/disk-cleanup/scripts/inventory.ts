import { lstat, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { diskBytes, ensureUntracked, git, isWithin } from './filesystemUtils';
import type { Dependency, Inventory, Workspace } from './types';

export async function inventory(root: string): Promise<Inventory> {
  const repositories: string[] = [];
  const dependencies: Workspace[] = [];
  const workspaces: Workspace[] = [];
  const rootDevice = (await stat(root)).dev;
  async function walk(path: string, repository: string | null): Promise<void> {
    if ((await stat(path)).dev !== rootDevice) return;
    const entries = await readdir(path, { withFileTypes: true });
    if (entries.some((entry) => entry.name === '.git')) {
      repository = path;
      repositories.push(path);
    }
    for (const entry of entries) {
      const childPath = join(path, entry.name);
      if (entry.name === 'node_modules' && (entry.isDirectory() || entry.isSymbolicLink())) {
        dependencies.push({ path: childPath, repository });
      } else if (entry.isDirectory() && entry.name !== '.git') {
        if (entry.name === '.workspaces') {
          for (const workspace of await readdir(childPath, { withFileTypes: true })) {
            if (workspace.isDirectory()) workspaces.push({ path: join(childPath, workspace.name), repository });
          }
        }
        await walk(childPath, repository);
      }
    }
  }
  await walk(root, null);
  return { repositories, dependencies, workspaces };
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

export async function inspectDependencies(root: string, days: number): Promise<Dependency[]> {
  const items = await inventory(root);
  const activity = new Map<string, number | null>();
  const result: Dependency[] = [];
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  for (const item of items.dependencies) {
    const isSymlink = (await lstat(item.path)).isSymbolicLink();
    const bytes = await diskBytes(item.path);
    let latestActivity: number | null = null;
    let eligible: boolean = false;
    let reason: string = 'no owning Git repository';
    try {
      if (isSymlink) reason = 'symbolic link';
      else if (item.repository) {
        if (!activity.has(item.repository)) activity.set(item.repository, await latestGitActivity(item.repository));
        latestActivity = activity.get(item.repository) ?? null;
        reason = 'no verifiable Git history';
        if (latestActivity !== null) {
          reason = 'recent Git activity';
          if (latestActivity < cutoff) {
            await ensureUntracked(item.repository, item.path);
            eligible = true;
            reason = `no Git activity within ${days} days`;
          }
        }
      }
    } catch (error) {
      reason = String(error);
    }
    result.push({ ...item, isSymlink, bytes, latestActivity, eligible, reason });
  }
  return result.sort((left, right) => right.bytes - left.bytes);
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
