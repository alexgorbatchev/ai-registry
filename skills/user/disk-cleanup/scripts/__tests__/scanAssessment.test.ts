import { afterEach, beforeEach, expect, test } from 'bun:test';
import { link, lstat, mkdir, readdir, symlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { scanAssessment } from '../scanAssessment';
import { assessDisk } from '../assessDisk';
import { runInspectionCommand } from '../runInspectionCommand';
import { createRoot, disposeRoot, createRepository, git } from './helpers';
import { inspectDependencies } from '../inventory';
import { inspectWorktrees } from '../inspectWorktrees';
import { factory_inspectionGate } from './fixtures';
import type { Stats } from 'node:fs';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('one traversal gathers sizes, discovery, and stale folders without following symlinks', async () => {
  const project = join(root, 'project');
  const dependencies = join(project, 'node_modules');
  await mkdir(join(project, '.git'), { recursive: true });
  await mkdir(join(dependencies, 'nested/.git'), { recursive: true });
  const file = join(dependencies, 'data');
  await Bun.write(file, Buffer.alloc(8192));
  await utimes(file, 1, 1);
  await symlink(root, join(project, 'cycle'));
  const reads: string[] = [];
  const data = await scanAssessment(root, 1, 30, async (path) => {
    reads.push(path);
    return readdir(path, { withFileTypes: true });
  });
  expect(reads.length).toBe(new Set(reads).size);
  expect(reads).toContain(join(dependencies, 'nested/.git'));
  expect(data.inventory.repositories).toEqual([project]);
  expect(data.inventory.dependencies).toEqual([{ path: dependencies, repository: project, isSymlink: false }]);
  expect(data.allocations.get(dependencies)).toBeGreaterThanOrEqual(8192);
  expect(data.largePaths).toContainEqual(expect.objectContaining({ path: file, bytes: 8192 }));
  expect(data.staleFolders.map((entry) => entry.path)).toEqual([project]);
});

test('hard links count once globally and once within each independent subtree', async () => {
  const a = join(root, 'a');
  const b = join(root, 'b');
  await mkdir(a);
  await mkdir(b);
  await Bun.write(join(a, 'data'), Buffer.alloc(8192));
  await link(join(a, 'data'), join(b, 'data'));
  const data = await scanAssessment(root, 1, 30);
  const rootBytes = (await lstat(root)).blocks * 512;
  const fileBytes = (await lstat(join(a, 'data'))).blocks * 512;
  expect(data.allocations.get(root)).toBe(data.allocations.get(a)! + data.allocations.get(b)! + rootBytes - fileBytes);
  expect(data.allocations.get(a)).toBeGreaterThanOrEqual(fileBytes);
  expect(data.allocations.get(b)).toBeGreaterThanOrEqual(fileBytes);
  expect(data.largePaths.filter((entry) => entry.path.endsWith('/data'))).toHaveLength(1);
});

test('metadata reads overlap with one global bound across nested directories', async () => {
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
    await mkdir(join(root, name));
    for (const file of ['one', 'two', 'three', 'four', 'five']) await Bun.write(join(root, name, file), 'data');
  }
  const gate = factory_inspectionGate((path) => lstat(path), 4, [root]);
  const scan = scanAssessment(root, 1, 30, undefined, root, undefined, { concurrency: 4, stat: gate.run });
  try {
    await gate.ready;
    expect(gate.paths).toHaveLength(4);
    expect(gate.maximum()).toBe(4);
  } finally {
    gate.release();
    await scan;
  }
  expect(gate.maximum()).toBe(4);
  expect(gate.paths).toHaveLength(36);
  expect((await scan).inventory.errors).toEqual([]);
});

test('out-of-order metadata preserves hard-link attribution and stale parent pruning', async () => {
  const a = join(root, 'a');
  const b = join(root, 'b');
  await mkdir(join(a, 'nested'), { recursive: true });
  await mkdir(b);
  await Bun.write(join(a, 'nested/data'), Buffer.alloc(8192));
  await utimes(join(a, 'nested/data'), 1, 1);
  await link(join(a, 'nested/data'), join(b, 'data'));
  const gate = factory_inspectionGate((path) => lstat(path), 1);
  const later = Promise.withResolvers<void>();
  const overrides = new Map<string, (path: string) => Promise<Stats>>([
    [a, gate.run],
    [
      b,
      async (path) => {
        const info = await lstat(path);
        later.resolve();
        return info;
      },
    ],
  ]);
  const scan = scanAssessment(
    root,
    1,
    30,
    async (path) =>
      (await readdir(path, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name)),
    root,
    undefined,
    { stat: (path) => (overrides.get(path) ?? lstat)(path) },
  );
  try {
    await later.promise;
    expect(gate.paths).toEqual([a]);
  } finally {
    gate.release();
    await scan;
  }
  const result = await scan;
  expect(result.largePaths.filter((entry) => entry.path.endsWith('/data')).map((entry) => entry.path)).toEqual([
    join(a, 'nested/data'),
  ]);
  expect(result.staleFolders.map((entry) => entry.path)).toEqual([a, b]);
  expect(result.allocations.get(a)).toBeGreaterThanOrEqual(result.allocations.get(b)!);
});

test('failed prefetched metadata preserves siblings and marks ancestor allocations incomplete', async () => {
  const missing = join(root, 'missing');
  const readable = join(root, 'readable');
  await Bun.write(missing, 'removed during scan');
  await mkdir(readable);
  await Bun.write(join(readable, 'data'), Buffer.alloc(8192));
  await utimes(join(readable, 'data'), 1, 1);
  const overrides = new Map<string, (path: string) => Promise<Stats>>([
    [missing, () => Promise.reject(new Error('entry disappeared'))],
  ]);
  const result = await scanAssessment(root, 1, 30, undefined, root, undefined, {
    stat: (path) => (overrides.get(path) ?? lstat)(path),
  });
  expect(result.inventory.errors).toEqual([{ repository: missing, message: 'Error: entry disappeared' }]);
  expect(result.allocations.get(root)).toBeNull();
  expect(result.allocations.get(missing)).toBeNull();
  expect(result.staleFolders.map((entry) => entry.path)).toEqual([readable]);
});

test('prefetched directories on another device are not traversed', async () => {
  const mounted = join(root, 'mounted');
  const readable = join(root, 'readable');
  await mkdir(mounted);
  await mkdir(readable);
  await Bun.write(join(mounted, 'data'), Buffer.alloc(8192));
  await Bun.write(join(readable, 'data'), Buffer.alloc(8192));
  const info = await lstat(mounted);
  const overrides = new Map([[mounted, Object.assign(info, { dev: info.dev + 1 })]]);
  const reads: string[] = [];
  const result = await scanAssessment(
    root,
    1,
    30,
    async (path) => {
      reads.push(path);
      return readdir(path, { withFileTypes: true });
    },
    root,
    undefined,
    { stat: async (path) => overrides.get(path) ?? lstat(path) },
  );
  expect(reads.sort()).toEqual([root, readable]);
  expect(result.allocations.has(mounted)).toBe(false);
  expect(result.allocations.get(readable)).toBeGreaterThanOrEqual(8192);
  expect(result.inventory.errors).toEqual([]);
});

test('unreadable subtrees keep readable results and prevent unsafe stale classification', async () => {
  const denied = join(root, 'denied');
  const readable = join(root, 'readable');
  await mkdir(denied);
  await mkdir(readable);
  await Bun.write(join(readable, 'data'), Buffer.alloc(8192));
  await utimes(join(readable, 'data'), 1, 1);
  const data = await scanAssessment(root, 1, 30, async (path) => {
    if (path === denied) throw new Error('permission denied');
    return readdir(path, { withFileTypes: true });
  });
  expect(data.inventory.errors).toEqual([{ repository: denied, message: 'Error: permission denied' }]);
  expect(data.allocations.get(denied)).toBeNull();
  expect(data.allocations.get(root)).toBeNull();
  expect(data.largePaths).toContainEqual(expect.objectContaining({ path: readable }));
  expect(data.staleFolders.map((entry) => entry.path)).toEqual([readable]);
});

test('assessment reuses nested system scopes and launches no repeated size or inventory commands', async () => {
  const cache = join(root, 'cache');
  await mkdir(cache);
  await Bun.write(join(cache, 'data'), Buffer.alloc(8192));
  const scopes: string[] = [];
  const commands: string[] = [];
  const report = await assessDisk(
    root,
    1,
    30,
    async (args) => {
      commands.push(args[0]!);
      return runInspectionCommand(args);
    },
    [cache, cache],
    async (...args) => {
      scopes.push(args[0]);
      return scanAssessment(...args);
    },
  );
  expect(scopes).toEqual([root]);
  expect(commands).not.toContain('du');
  expect(commands).not.toContain(process.execPath);
  expect(report.sections.at(-1)?.data).toContainEqual(expect.objectContaining({ path: join(cache, 'data') }));
  expect(report.sections.filter((entry) => entry.name === `system:${cache}`)).toHaveLength(1);
});

test('an enclosing system scope shares traversal while keeping the selected root discovery and overview', async () => {
  const selected = join(root, 'selected');
  const project = join(selected, 'one/two/three');
  await mkdir(join(project, 'node_modules'), { recursive: true });
  await mkdir(join(project, '.git'));
  await mkdir(join(root, 'outside/.git'), { recursive: true });
  await Bun.write(join(root, 'outside/data'), Buffer.alloc(8192));
  await Bun.write(join(project, 'node_modules/data'), Buffer.alloc(8192));
  const scopes: string[] = [];
  const report = await assessDisk(selected, 1, 30, runInspectionCommand, [root], async (...args) => {
    scopes.push(args[0]);
    return scanAssessment(...args);
  });
  expect(scopes).toEqual([root]);
  expect(report.sections[1]?.data).toContainEqual(expect.objectContaining({ path: project }));
  expect(report.sections[1]?.data).not.toContainEqual(expect.objectContaining({ path: root }));
  const dependencies = report.sections.find((section) => section.name === 'dependencies')?.data as {
    dependencies: { path: string }[];
  };
  expect(dependencies.dependencies.map((entry) => entry.path)).toEqual([join(project, 'node_modules')]);
  expect(report.sections[2]?.data).not.toContainEqual(expect.objectContaining({ path: join(root, 'outside/data') }));
  const worktrees = report.sections.find((section) => section.name === 'worktrees');
  expect(worktrees?.errors.some((error) => error.includes('/outside'))).toBe(false);
});

test('shared allocations and discovery preserve standalone dependency and worktree reports', async () => {
  const repository = await createRepository(root, 'repository');
  const workspace = join(repository, '.workspaces/review');
  git(repository, ['worktree', 'add', '-b', 'review', workspace]);
  await Bun.write(join(workspace, 'untracked'), 'keep');
  const report = await assessDisk(root, 1, 30, runInspectionCommand);
  const dependencies = report.sections.find((section) => section.name === 'dependencies');
  const worktrees = report.sections.find((section) => section.name === 'worktrees');
  expect(dependencies?.isComplete).toBe(true);
  expect(dependencies?.data).toMatchObject({ dependencies: await inspectDependencies(root, 30) });
  expect(worktrees?.isComplete).toBe(true);
  expect(worktrees?.data).toMatchObject(await inspectWorktrees(root));
  expect(worktrees?.data).toMatchObject({
    worktrees: [{ path: workspace, isRegistered: true, changedEntries: 1, bytes: expect.any(Number) }],
  });
});
