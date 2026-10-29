import { afterEach, beforeEach, expect, test } from 'bun:test';
import { chmod, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectDisk } from '../inspectDisk';
import { assessDisk } from '../assessDisk';
import { systemAssessmentRoots } from '../systemAssessmentRoots';
import { runInspectionCommand } from '../runInspectionCommand';
import { resolveGnuCommand } from '../resolveGnuCommand';
import { cli, createRepository, createRoot, disposeRoot } from './helpers';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('disk inspection retains allocations when df or du fails', async () => {
  const report = await inspectDisk(root, 2, async (args) => {
    if (args[0] === 'df') return { stdout: 'partial capacity', stderr: 'capacity unavailable', exitCode: 1 };
    return { stdout: `4096\t${root}/readable\0`, stderr: 'permission denied', exitCode: 1 };
  });
  expect(report).toEqual({
    root,
    isComplete: false,
    filesystem: 'partial capacity',
    folders: [{ bytes: 4096, path: join(root, 'readable') }],
    errors: ['df exited 1: capacity unavailable', 'du exited 1: permission denied'],
  });
});

test('inspection finds prefixed GNU utilities when unprefixed tools are BSD', async () => {
  const bin = join(root, 'bin');
  await mkdir(bin);
  await Bun.write(join(bin, 'df'), '#!/bin/sh\necho BSD-df >&2\nexit 1\n');
  await Bun.write(join(bin, 'du'), '#!/bin/sh\necho BSD-du >&2\nexit 1\n');
  await chmod(join(bin, 'df'), 0o700);
  await chmod(join(bin, 'du'), 0o700);
  await symlink(resolveGnuCommand('df'), join(bin, 'gdf'));
  await symlink(resolveGnuCommand('du'), join(bin, 'gdu'));
  const result = Bun.spawnSync(
    [process.execPath, join(import.meta.dir, '../cleanup.ts'), 'disk', 'inspect', '--root', root],
    {
      env: { ...Bun.env, PATH: bin, AGENT: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).isComplete).toBe(true);
});

test('all discovery commands retain readable siblings of an inaccessible directory', async () => {
  await mkdir(join(root, 'a-denied'));
  const repository = await createRepository(root, 'z-readable');
  await chmod(join(root, 'a-denied'), 0);
  try {
    const dependencies = cli(root, ['dependencies', 'list', '--root', root]);
    expect(dependencies.exitCode).toBe(1);
    const report = JSON.parse(dependencies.stdout);
    expect(report.dependencies[0].path).toBe(join(repository, 'node_modules'));
    expect(report.errors.length).toBe(1);
    const worktrees = cli(root, ['worktrees', 'list', '--root', root]);
    expect(worktrees.exitCode).toBe(1);
    expect(JSON.parse(worktrees.stdout).errors.length).toBe(1);
    const usage = cli(root, ['disk', 'inspect', '--root', root]);
    expect(usage.exitCode).toBe(1);
    expect(JSON.parse(usage.stdout).folders).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: repository })]),
    );
  } finally {
    await chmod(join(root, 'a-denied'), 0o700);
  }
});

test('system assessment includes temporary and library paths with explicit scope and partial errors', async () => {
  const roots = systemAssessmentRoots('darwin', '/home/example', '/private/var/folders/example/T');
  const commands: string[][] = [];
  const report = await assessDisk(
    root,
    1,
    30,
    async (args) => {
      commands.push(args);
      if (args.at(-1) === '/Library') return { stdout: '4096\t/Library/readable\0', stderr: 'restricted', exitCode: 1 };
      return runInspectionCommand(args);
    },
    ['/Library'],
  );
  expect(roots).toEqual([
    '/private/var/folders/example/T',
    '/private/var/folders/example/X',
    '/home/example/Library/Caches',
    '/Library',
    '/private/var/log',
  ]);
  expect(report.scope.roots).toEqual([root, '/Library']);
  expect(report.sections.at(-1)).toEqual({
    name: 'system:/Library',
    isComplete: false,
    data: [{ bytes: 4096, path: '/Library/readable' }],
    errors: ['du exited 1: restricted'],
  });
  expect(commands.some((args) => args.includes('/Library'))).toBe(true);
});
