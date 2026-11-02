import { afterEach, beforeEach, expect, test } from 'bun:test';
import { link, mkdir, open, rename, readdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, createRepository, createRoot, disposeRoot } from './helpers';
import { inspectNativeTarget, reviewNativeTargets } from '../reviewNativeTargets';
import { removeNativeTargets } from '../removeNativeTargets';
import { runInspectionCommand } from '../runInspectionCommand';
import { diskBytes } from '../filesystemUtils';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('native review records exact cache targets and preserves live files and repositories', async () => {
  await mkdir(join(root, 'Library/Caches/inactive'), { recursive: true });
  await mkdir(join(root, 'Library/Caches/active'), { recursive: true });
  await Bun.write(join(root, 'Library/Caches/inactive/data'), 'cache');
  await Bun.write(join(root, 'Library/Caches/active/data'), 'live');
  const repository = await createRepository(root, 'Library/Caches/review-copy');
  const handle = await open(join(root, 'Library/Caches/active/data'));
  try {
    const review = cli(root, [
      'native',
      'review',
      'Library/Caches/inactive',
      'Library/Caches/active',
      repository,
      '--verbose',
      '--root',
      root,
    ]);
    expect(review.exitCode).toBe(0);
    const report = JSON.parse(review.stdout);
    expect(report.manifest.actions.map((entry: { path: string }) => entry.path)).toEqual([
      join(root, 'Library/Caches/inactive'),
    ]);
    expect(report.manifest.preserved.map((entry: { path: string }) => entry.path)).toEqual([
      join(root, 'Library/Caches/active'),
      repository,
    ]);
    expect(await Bun.file(join(root, 'Library/Caches/inactive/data')).text()).toBe('cache');
    const preview = cli(root, ['native', 'remove', report.manifestPath, '--root', root]);
    expect(preview.exitCode).toBe(0);
    expect(await Bun.file(join(root, 'Library/Caches/inactive/data')).exists()).toBe(true);
    const removal = cli(root, ['native', 'remove', report.manifestPath, '--root', root, '--execute', '--verbose']);
    expect(removal.exitCode).toBe(0);
    const result = JSON.parse(removal.stdout);
    expect(result.removed).toEqual([join(root, 'Library/Caches/inactive')]);
    expect(await Bun.file(join(root, 'Library/Caches/active/data')).text()).toBe('live');
    expect(await Bun.file(join(repository, 'source.txt')).text()).toBe('source\n');
  } finally {
    await handle.close();
  }
});

test('native removal rejects replacement targets from a recorded preview', async () => {
  await mkdir(join(root, 'cache'));
  const review = cli(root, ['native', 'review', 'cache', '--root', root]);
  expect(review.exitCode).toBe(0);
  const report = JSON.parse(review.stdout);
  await Bun.write(join(root, 'cache/new-data'), 'new');
  const removal = cli(root, ['native', 'remove', report.manifestPath, '--root', root, '--execute']);
  expect(removal.exitCode).toBe(1);
  expect(await Bun.file(join(root, 'cache/new-data')).text()).toBe('new');
});

test('native removal reconciles a partially failed batch and leaves later batches untouched', async () => {
  const paths = Array.from({ length: 35 }, (_, index) => join(root, `cache/${index}`));
  for (const path of paths) await mkdir(path, { recursive: true });
  await Bun.write(join(paths[1]!, 'data'), 'keep');
  const review = await reviewNativeTargets(root, paths);
  let removals = 0;
  const result = await removeNativeTargets(root, review.manifestPath, true, async (args) => {
    if (args[0] === 'rm') {
      removals++;
      await runInspectionCommand(['rm', '-r', '--', ...args.slice(3).filter((path) => path !== paths[1])]);
      await mkdir(join(root, 'cache/new-runtime'));
      return { stdout: '', stderr: 'permission denied', exitCode: 1 };
    }
    return runInspectionCommand(args);
  });
  expect(removals).toBe(1);
  expect(result.removed).toEqual(paths.slice(0, 32).filter((path) => path !== paths[1]));
  expect(result.failure).toContain('rm failed (1) for batch: permission denied');
  expect(result.failure).toContain(`Removal verification failed: ${paths[1]}`);
  expect(result.newEntries).toEqual([join(root, 'cache/new-runtime')]);
  expect((await readdir(join(root, 'cache'))).sort()).toEqual(['1', '32', '33', '34', 'new-runtime']);
  expect(await Bun.file(result.logPath ?? '').json()).toEqual(result);
  expect(result.before).not.toBeNull();
  expect(result.after).not.toBeNull();
}, 20000);

test('native removal preserves a target opened after review and removes its idle sibling', async () => {
  await mkdir(join(root, 'cache/active'), { recursive: true });
  await mkdir(join(root, 'cache/idle'));
  await Bun.write(join(root, 'cache/active/data'), 'live');
  const review = await reviewNativeTargets(root, ['cache/active', 'cache/idle']);
  const handle = await open(join(root, 'cache/active/data'));
  try {
    const result = await removeNativeTargets(root, review.manifestPath, true);
    expect(result.failure).toBeNull();
    expect(result.removed).toEqual([join(root, 'cache/idle')]);
    expect(result.preserved).toEqual([{ path: join(root, 'cache/active'), reason: 'Became active since review' }]);
    expect(await Bun.file(join(root, 'cache/active/data')).text()).toBe('live');
  } finally {
    await handle.close();
  }
});

test('native batch revalidates every target before deleting any entry', async () => {
  await mkdir(join(root, 'first'));
  await mkdir(join(root, 'second'));
  const review = await reviewNativeTargets(root, ['first', 'second']);
  await rename(join(root, 'second'), join(root, 'old-second'));
  await mkdir(join(root, 'second'));
  await expect(removeNativeTargets(root, review.manifestPath, true)).rejects.toThrow(
    `Target changed since review: ${root}/second`,
  );
  expect((await readdir(root)).sort()).toEqual(['.tmp', 'first', 'old-second', 'second']);
});

test('native review rejects symlink ancestors and aborts on uncertain process inspection', async () => {
  await mkdir(join(root, 'cache'));
  await symlink(join(root, 'cache'), join(root, 'alias'));
  await expect(reviewNativeTargets(root, ['alias'])).rejects.toThrow(`Symbolic links cannot be deleted: ${root}/alias`);
  await expect(
    reviewNativeTargets(root, ['cache'], async () => ({ stdout: '', stderr: 'access denied', exitCode: 1 })),
  ).rejects.toThrow('Process inspection is incomplete: access denied');
  expect((await readdir(root)).sort()).toEqual(['alias', 'cache']);
});

test('native removal batches process snapshots and commands while refreshing activity for later batches', async () => {
  const paths = Array.from({ length: 35 }, (_, index) => join(root, `cache/${index}`));
  for (const path of paths) {
    await mkdir(path, { recursive: true });
    await Bun.write(join(path, 'data'), 'cache');
  }
  const review = await reviewNativeTargets(root, paths);
  let snapshots = 0;
  const removals: string[][] = [];
  const result = await removeNativeTargets(root, review.manifestPath, true, async (args) => {
    if (args[0] === 'lsof') {
      snapshots++;
      return { stdout: `p123\0n${snapshots === 2 ? paths[34] : '/outside'}/data\0`, stderr: '', exitCode: 0 };
    }
    if (args[0] === 'rm') removals.push(args.slice(3));
    return runInspectionCommand(args);
  });
  expect(result.failure).toBeNull();
  expect(snapshots).toBe(2);
  expect(removals.map((batch) => batch.length)).toEqual([32, 2]);
  expect(result.removed).toEqual(paths.slice(0, 34));
  expect(result.preserved).toEqual([{ path: paths[34]!, reason: 'Became active since review' }]);
  expect(await Bun.file(join(paths[34]!, 'data')).text()).toBe('cache');
  expect(await Bun.file(result.logPath!).json()).toEqual(result);
}, 20000);

test('a change during the batch process snapshot stops every removal in that batch', async () => {
  await mkdir(join(root, 'first'));
  await mkdir(join(root, 'second'));
  const review = await reviewNativeTargets(root, ['first', 'second']);
  let removals = 0;
  const result = await removeNativeTargets(root, review.manifestPath, true, async (args) => {
    if (args[0] === 'lsof') {
      await mkdir(join(root, 'second/.git'));
      return { stdout: 'p123\0n/outside/data\0', stderr: '', exitCode: 0 };
    }
    if (args[0] === 'rm') removals++;
    return runInspectionCommand(args);
  });
  expect(result.failure).toContain('Contains a Git repository');
  expect(removals).toBe(0);
  expect((await readdir(root)).sort()).toEqual(['.tmp', 'first', 'second']);
});

test('native target inspection shares identity, repository checks, and hard-link-aware allocation', async () => {
  const path = join(root, 'cache');
  await mkdir(join(path, 'nested'), { recursive: true });
  await Bun.write(join(path, 'data'), Buffer.alloc(8192));
  await link(join(path, 'data'), join(path, 'nested/linked'));
  await symlink(root, join(path, 'cycle'));
  const inspection = await inspectNativeTarget(root, path);
  expect(inspection.bytes).toBe(await diskBytes(path));
  expect((await inspectNativeTarget(root, path)).identity).toBe(inspection.identity);
  await Bun.write(join(path, 'new-data'), 'new');
  expect((await inspectNativeTarget(root, path)).identity).not.toBe(inspection.identity);
  await mkdir(join(path, 'nested/.git'));
  await expect(inspectNativeTarget(root, path)).rejects.toThrow('Contains a Git repository');
});

test('native removal reconciles actual deletions even when its runner throws', async () => {
  await mkdir(join(root, 'first'));
  await mkdir(join(root, 'second'));
  const review = await reviewNativeTargets(root, ['first', 'second']);
  const result = await removeNativeTargets(root, review.manifestPath, true, async (args) => {
    if (args[0] === 'rm') {
      await runInspectionCommand(['rm', '-r', '--', join(root, 'first')]);
      throw new Error('lost command result');
    }
    return runInspectionCommand(args);
  });
  expect(result.removed).toEqual([join(root, 'first')]);
  expect(result.failure).toContain('lost command result');
  expect(await Bun.file(result.logPath!).json()).toEqual(result);
  expect((await readdir(root)).sort()).toEqual(['.tmp', 'second']);
});
