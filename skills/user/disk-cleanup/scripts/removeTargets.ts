import { lstat, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import {
  diskBytes,
  ensureAbsent,
  ensureNoRepositories,
  ensureUntracked,
  git,
  owningRepository,
  run,
  validatePath,
} from './filesystemUtils';
import { validateWorktree } from './inspectWorktrees';
import { assertDisjoint, latestGitActivity } from './inventory';
import type { Action, RunOptions } from './types';

export async function validateCache(root: string, input: string): Promise<Action> {
  const path = await validatePath(root, input);
  const components = relative(root, path).split(sep);
  if (!components.some((component) => ['.tmp', '.cache', 'node_modules', 'target', 'dist'].includes(component))) {
    throw new Error(`Target is not a cache, temporary, dependency, or build path: ${path}`);
  }
  const repository = await owningRepository(dirname(path));
  await ensureUntracked(repository, path);
  await ensureNoRepositories(path);
  return { path, repository, bytes: await diskBytes(path), kind: 'cache' };
}

export async function validateDependency(root: string, action: Action, days: number): Promise<void> {
  await validatePath(root, action.path);
  if (!action.repository) throw new Error('Dependency target has no Git owner');
  const latest = await latestGitActivity(action.repository);
  if (latest === null || latest >= Math.floor(Date.now() / 1000) - days * 86400) {
    throw new Error(`Git activity changed or is unverifiable: ${action.repository}`);
  }
  await ensureUntracked(action.repository, action.path);
  await ensureNoRepositories(action.path);
}

export async function removeTargets(
  options: RunOptions,
  actions: Action[],
  validate: (action: Action) => Promise<void>,
): Promise<unknown> {
  assertDisjoint(
    options.root,
    actions.map((action) => action.path),
  );
  if (actions.some((action) => action.path === join(options.root, '.tmp'))) {
    throw new Error('Preserve the root .tmp container for execution logs; select its children');
  }
  for (const action of actions) await validate(action);
  if (!options.execute || actions.length === 0) return { execute: false, actions, logPath: null };
  await mkdir(join(options.root, '.tmp'), { recursive: true });
  await validatePath(options.root, join(options.root, '.tmp'));
  const logPath = join(await mkdtemp(join(options.root, '.tmp/cleanup-')), 'execution.json');
  const before = await run(['df', '-B1', '--', options.root]);
  const removed: string[] = [];
  let failure: string | null = null;
  async function persist(): Promise<void> {
    await Bun.write(
      logPath,
      JSON.stringify(
        {
          root: options.root,
          actions,
          removed,
          failure,
          before,
          after: await run(['df', '-B1', '--', options.root]),
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
  await persist();
  try {
    for (const action of actions) {
      await validate(action);
      const identity = await lstat(action.path);
      await validatePath(options.root, action.path);
      const current = await lstat(action.path);
      if (identity.ino !== current.ino || identity.dev !== current.dev)
        throw new Error(`Target changed: ${action.path}`);
      if (action.kind === 'worktree') {
        if (!action.repository) throw new Error('Worktree has no Git owner');
        await git(action.repository, ['worktree', 'remove', '--', action.path]);
      } else {
        await run(['rm', '-r', '--', action.path]);
      }
      await ensureAbsent(action.path);
      removed.push(action.path);
      await persist();
    }
  } catch (error) {
    failure = String(error);
    await persist();
    throw new Error(`Cleanup stopped; inspect ${logPath}: ${failure}`);
  }
  return { execute: true, removed, logPath, before, after: await run(['df', '-B1', '--', options.root]) };
}

export async function worktreeAction(root: string, input: string): Promise<Action> {
  const path = await validatePath(root, input);
  const repository = await owningRepository(path);
  if (!repository) throw new Error(`Target has no Git owner: ${path}`);
  await validateWorktree(root, path, repository);
  return { path, repository, kind: 'worktree', bytes: await diskBytes(path) };
}
