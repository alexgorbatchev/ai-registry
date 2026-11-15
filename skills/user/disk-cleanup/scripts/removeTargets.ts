import { lstat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import {
  createRecordDirectory,
  diskBytes,
  ensureAbsent,
  ensureNoRepositories,
  ensureUntracked,
  git,
  isRecordPath,
  isVanished,
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
  validate: (actions: Action[]) => Promise<void>,
  afterRemove?: (action: Action) => Promise<void>,
  maxBatchSize = 1,
): Promise<unknown> {
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 32) {
    throw new Error('Removal batches must contain 1 to 32 paths');
  }
  assertDisjoint(
    options.root,
    actions.map((action) => action.path),
  );
  if (actions.some((action) => isRecordPath(options.root, action.path))) {
    throw new Error('Preserve the root .state cleanup records');
  }
  await validate(actions);
  if (!options.execute || actions.length === 0) return { execute: false, actions, logPath: null };
  const logPath = join(await createRecordDirectory(options.root, 'cleanup-'), 'execution.json');
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
    for (const batch of removalBatches(actions, maxBatchSize)) {
      const identities = await Promise.all(batch.map((action) => lstat(action.path)));
      await validate(batch);
      for (const [index, action] of batch.entries()) {
        await validatePath(options.root, action.path);
        const current = await lstat(action.path);
        const identity = identities[index];
        if (!identity || identity.ino !== current.ino || identity.dev !== current.dev)
          throw new Error(`Target changed: ${action.path}`);
      }
      try {
        const worktree = batch.find((action) => action.kind === 'worktree');
        if (worktree) {
          if (!worktree.repository) throw new Error('Worktree has no Git owner');
          await git(worktree.repository, ['worktree', 'remove', '--', worktree.path]);
        } else {
          await run(['rm', '-r', '--', ...batch.map((action) => action.path)]);
        }
        for (const action of batch) await ensureAbsent(action.path);
      } finally {
        // Native rm can remove only part of a batch before reporting failure.
        const completed: Action[] = [];
        for (const action of batch) {
          if (await isVanished(action.path)) {
            removed.push(action.path);
            completed.push(action);
          }
        }
        for (const action of completed) await afterRemove?.(action);
      }
      await persist();
    }
  } catch (error) {
    failure = String(error);
    await persist();
    throw new Error(`Cleanup stopped; inspect ${logPath}: ${failure}`);
  }
  return { execute: true, removed, logPath, before, after: await run(['df', '-B1', '--', options.root]) };
}

function* removalBatches(actions: Action[], maxPaths: number): Generator<Action[]> {
  let batch: Action[] = [];
  let bytes = 0;
  for (const action of actions) {
    const size = Buffer.byteLength(action.path) + 1;
    if (batch.length && (batch.length >= maxPaths || bytes + size > 16_384 || action.kind === 'worktree')) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    if (action.kind === 'worktree') {
      yield [action];
    } else {
      batch.push(action);
      bytes += size;
    }
  }
  if (batch.length) yield batch;
}

export async function worktreeAction(root: string, input: string): Promise<Action> {
  const path = await validatePath(root, input);
  const repository = await owningRepository(path);
  if (!repository) throw new Error(`Target has no Git owner: ${path}`);
  await validateWorktree(root, path, repository);
  return { path, repository, kind: 'worktree', bytes: await diskBytes(path) };
}
