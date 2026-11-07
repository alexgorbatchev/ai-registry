import { afterEach, beforeEach, expect, test } from 'bun:test';
import { join } from 'node:path';
import { diskBytes } from '../filesystemUtils';
import { inspectWorktrees } from '../inspectWorktrees';
import { inventory } from '../inventory';
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
  const items = await inventory(root);
  const gate = factory_inspectionGate(diskBytes, 4);
  const inspection = inspectWorktrees(root, items, gate.run);
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
  expect(result).toEqual(await inspectWorktrees(root, items));
});
