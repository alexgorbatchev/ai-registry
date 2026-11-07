import { afterEach, beforeEach, expect, test } from 'bun:test';
import { diskBytes } from '../filesystemUtils';
import { inspectDependencies, inventory, latestGitActivity } from '../inventory';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { factory_inspectionGate } from './fixtures';
import { createRepository, createRoot, disposeRoot } from './helpers';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('dependencies with the same owner share one in-flight Git activity inspection', async () => {
  const repository = await createRepository(root, 'repository');
  const nested = join(repository, 'packages/nested/node_modules');
  await mkdir(nested, { recursive: true });
  await Bun.write(join(nested, 'data'), 'dependency');
  const calls: string[] = [];
  const pending = latestGitActivity(repository);
  const result = await inspectDependencies(root, 30, undefined, undefined, diskBytes, (path) => {
    calls.push(path);
    return pending;
  });
  expect(calls).toEqual([repository]);
  expect(result.map((item) => item.latestActivity)).toEqual([await pending, await pending]);
  expect(result.map((item) => item.eligible)).toEqual([true, true]);
});

test('independent dependency inspections overlap within a bound and preserve inactivity checks', async () => {
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) await createRepository(root, name);
  const items = await inventory(root);
  const gate = factory_inspectionGate(diskBytes, 4);
  const inspection = inspectDependencies(root, 30, undefined, items, gate.run);
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
  expect(result).toHaveLength(6);
  expect(result.map((item) => item.eligible)).toEqual(Array.from({ length: 6 }, () => true));
  expect(result.map((item) => item.reason)).toEqual(Array.from({ length: 6 }, () => 'no Git activity within 30 days'));
  expect(result).toEqual(await inspectDependencies(root, 30, undefined, items));
});
