import { realpath } from 'node:fs/promises';
import pMap from 'p-map';
import { diskBytes, git, isWithin, validatePath } from './filesystemUtils';
import { inventory } from './inventory';
import type {
  InspectionError,
  Inventory,
  RepositoryWorktrees,
  Worktree,
  WorktreeInspection,
  WorktreeReport,
} from './types';

export async function registeredWorktrees(repository: string): Promise<Worktree[]> {
  const output = await git(repository, ['worktree', 'list', '--porcelain', '-z']);
  return output
    .split('\0\0')
    .filter(Boolean)
    .map((record) => {
      const fields = record.split('\0');
      const path = fields.find((field) => field.startsWith('worktree '))?.slice(9);
      if (!path) throw new Error('Git worktree record has no path');
      return {
        path,
        head: fields.find((field) => field.startsWith('HEAD '))?.slice(5) ?? null,
        branch: fields.find((field) => field.startsWith('branch '))?.slice(7) ?? null,
        isLocked: fields.some((field) => field === 'locked' || field.startsWith('locked ')),
        isPrunable: fields.some((field) => field === 'prunable' || field.startsWith('prunable ')),
      };
    });
}

async function statusEntries(path: string) {
  const records = (
    await git(path, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignored=matching',
      '--no-renames',
      '--ignore-submodules=none',
    ])
  )
    .split('\0')
    .filter(Boolean);
  return {
    changedEntries: records.filter((record) => !record.startsWith('!! ')).length,
    ignoredEntries: records.filter((record) => record.startsWith('!! ')).length,
  };
}

async function inspectRegistrations(repositories: string[]): Promise<RepositoryWorktrees[]> {
  const registrations = new Map<string, Promise<Worktree[]>>();
  return pMap(
    repositories,
    async (repository): Promise<RepositoryWorktrees> => {
      try {
        const commonDirectory = (
          await git(repository, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
        ).trim();
        const pending = registrations.get(commonDirectory) ?? registeredWorktrees(repository);
        registrations.set(commonDirectory, pending);
        return { repository, commonDirectory, worktrees: await pending };
      } catch (error) {
        return { repository, error: String(error) };
      }
    },
    { concurrency: 4 },
  );
}

async function inspectRegisteredWorktree(
  report: WorktreeReport,
  measure: (path: string) => Promise<number>,
  errors: InspectionError[],
): Promise<WorktreeReport> {
  try {
    if (!report.isPrunable) {
      report.bytes = await measure(report.path);
      Object.assign(report, await statusEntries(report.path));
    }
  } catch (error) {
    errors.push({ repository: report.path, message: String(error) });
  }
  return report;
}

export async function inspectWorktrees(
  root: string,
  sharedInventory?: Inventory,
  measure: (path: string) => Promise<number> = diskBytes,
): Promise<WorktreeInspection> {
  const items = sharedInventory ?? (await inventory(root));
  const known = new Map<string, WorktreeReport>();
  const commonDirectories = new Set<string>();
  const errors: InspectionError[] = [...items.errors];
  const failedRepositories = new Set<string>();
  const repositories = await inspectRegistrations(items.repositories);
  const candidates = repositories.flatMap((entry) => {
    if ('error' in entry) {
      errors.push({ repository: entry.repository, message: entry.error });
      failedRepositories.add(entry.repository);
      return [];
    }
    if (commonDirectories.has(entry.commonDirectory)) return [];
    commonDirectories.add(entry.commonDirectory);
    return entry.worktrees
      .slice(1)
      .filter((worktree) => isWithin(root, worktree.path))
      .map((worktree) => ({ ...worktree, repository: entry.repository }));
  });
  const reports = await pMap(
    candidates,
    async (worktree): Promise<WorktreeReport> => {
      const report: WorktreeReport = {
        ...worktree,
        isRegistered: true,
        bytes: null,
        changedEntries: null,
        ignoredEntries: null,
      };
      return inspectRegisteredWorktree(report, measure, errors);
    },
    { concurrency: 4 },
  );
  for (const report of reports) known.set(report.path, report);
  const workspaces = await pMap(
    items.workspaces.filter((workspace) => !known.has(workspace.path)),
    async (workspace): Promise<WorktreeReport> => {
      let bytes: number | null = null;
      try {
        bytes = await measure(workspace.path);
      } catch (error) {
        errors.push({ repository: workspace.path, message: String(error) });
      }
      return {
        ...workspace,
        bytes,
        isRegistered: workspace.repository && failedRepositories.has(workspace.repository) ? null : false,
        head: null,
        branch: null,
        isLocked: false,
        isPrunable: false,
        changedEntries: null,
        ignoredEntries: null,
      };
    },
    { concurrency: 4 },
  );
  for (const workspace of workspaces) known.set(workspace.path, workspace);
  return { worktrees: [...known.values()].sort((left, right) => (right.bytes ?? -1) - (left.bytes ?? -1)), errors };
}

export async function validateWorktree(root: string, input: string, repository: string): Promise<void> {
  const path = await validatePath(root, input);
  const worktrees = await registeredWorktrees(repository);
  const target = worktrees.find((worktree) => worktree.path === path);
  if (!target || target.path === worktrees[0]?.path)
    throw new Error(`Target must be a registered linked worktree: ${path}`);
  if (target.isLocked || target.isPrunable) throw new Error(`Worktree is locked or prunable: ${path}`);
  const status = await statusEntries(path);
  if (status.changedEntries > 0 || status.ignoredEntries > 0) {
    throw new Error(`Worktree contains changed, untracked, or ignored files: ${path}`);
  }
  const references = await git(path, ['for-each-ref', '--contains=HEAD', '--format=%(refname)']);
  if (!references.trim()) throw new Error(`Worktree HEAD is not retained by a branch or tag: ${path}`);
  const mainPath = worktrees[0]?.path;
  if (!mainPath) throw new Error('Git worktree list has no main entry');
  for (const location of new Set([mainPath, repository, path])) {
    const lockPath = (await git(location, ['rev-parse', '--path-format=absolute', '--git-path', 'index.lock'])).trim();
    if (await Bun.file(lockPath).exists()) throw new Error(`Git index is locked: ${location}`);
  }
  if ((await realpath(path)) !== path) throw new Error('Worktree path changed during validation');
}
