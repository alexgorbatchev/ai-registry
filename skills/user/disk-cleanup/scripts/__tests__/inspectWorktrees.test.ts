import { afterEach, beforeEach, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectDependencies } from '../inventory';
import { inspectWorktrees } from '../inspectWorktrees';
import { discover } from '../scanAssessment';
import { factory_inspectionGate } from './fixtures';
import { createRepository, createRoot, disposeRoot, git } from './helpers';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('linked worktree inspections overlap within a bound and retain dirty and ignored entries', async () => {
  const repository = await createRepository(root, 'repository');
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
    git(repository, ['worktree', 'add', '-b', name, join(repository, '.workspaces', name)]);
  }
  await Bun.write(join(repository, '.workspaces/a/untracked'), 'keep');
  await Bun.write(join(repository, '.workspaces/b/.tmp/ignored'), 'keep');
  const { inventory, measure } = await discover(root);
  const gate = factory_inspectionGate(measure, 4);
  const inspection = inspectWorktrees(root, inventory, gate.run);
  try {
    await gate.ready;
    expect(gate.paths).toHaveLength(4);
    expect(gate.maximum()).toBe(4);
  } finally {
    gate.release();
    await inspection;
  }
  const result = await inspection;
  expect(gate.maximum()).toBeLessThanOrEqual(4);
  expect(gate.paths).toHaveLength(6);
  expect(result.errors).toEqual([]);
  expect(result.worktrees).toHaveLength(6);
  expect(result.worktrees.find((item) => item.path.endsWith('/a'))).toMatchObject({
    isRegistered: true,
    changedEntries: 1,
    ignoredEntries: 0,
  });
  expect(result.worktrees.find((item) => item.path.endsWith('/b'))).toMatchObject({
    isRegistered: true,
    changedEntries: 0,
    ignoredEntries: 1,
  });
  expect(result).toEqual(await inspectWorktrees(root, inventory, measure));
});

test('worktrees and dependencies removed after discovery are not reported as errors', async () => {
  const kept = await createRepository(root, 'kept');
  const removed = await createRepository(root, 'removed');
  const worktree = join(kept, '.workspaces/gone');
  const workspace = join(kept, '.workspaces/plain');
  git(kept, ['worktree', 'add', '-b', 'gone', worktree]);
  await Bun.write(join(workspace, 'file'), 'data');
  const { inventory, measure } = await discover(root);
  const gone = new Set([worktree, workspace, join(removed, 'node_modules')]);
  const vanishing = async (path: string) => {
    if (gone.has(path)) throw new Error(`Allocation unavailable: ${path}`);
    return measure(path);
  };
  await rm(worktree, { recursive: true });
  await rm(workspace, { recursive: true });
  await rm(removed, { recursive: true });
  const worktrees = await inspectWorktrees(root, inventory, vanishing);
  // Git still registers the deleted worktree, so it is reported as prunable; the plain directory is gone.
  expect(worktrees).toEqual({
    worktrees: [expect.objectContaining({ path: worktree, isRegistered: true, isPrunable: true, bytes: null })],
    invalidRepositories: [],
    errors: [],
  });
  const errors: unknown[] = [];
  const dependencies = await inspectDependencies(30, inventory, vanishing, (error) => errors.push(error));
  expect(dependencies.map((entry) => entry.path)).toEqual([join(kept, 'node_modules')]);
  expect(errors).toEqual([]);
});
