import { afterEach, beforeEach, expect, test } from 'bun:test';
import { link, lstat, mkdir, readdir, symlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { scanAssessment } from '../scanAssessment';
import { assessDisk } from '../assessDisk';
import { runInspectionCommand } from '../runInspectionCommand';
import { createRoot, disposeRoot, createRepository, git } from './helpers';
import { inspectDependencies } from '../inventory';
import { inspectWorktrees } from '../inspectWorktrees';

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
