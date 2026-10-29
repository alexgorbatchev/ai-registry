import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, open, rename, readdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, createRepository, createRoot, disposeRoot } from './helpers';
import { reviewNativeTargets } from '../reviewNativeTargets';
import { removeNativeTargets } from '../removeNativeTargets';
import { runInspectionCommand } from '../runInspectionCommand';

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

test('native removal stops at the first partial deletion and retains its receipt and new entries', async () => {
  await mkdir(join(root, 'cache/first'), { recursive: true });
  await mkdir(join(root, 'cache/second'));
  await mkdir(join(root, 'cache/third'));
  await Bun.write(join(root, 'cache/second/data'), 'keep');
  const review = await reviewNativeTargets(root, ['cache/first', 'cache/second', 'cache/third']);
  const result = await removeNativeTargets(root, review.manifestPath, true, async (args) => {
    if (args[0] === 'rm' && args.at(-1) === join(root, 'cache/second')) {
      await mkdir(join(root, 'cache/new-runtime'));
      return { stdout: '', stderr: 'permission denied', exitCode: 1 };
    }
    return runInspectionCommand(args);
  });
  expect(result.removed).toEqual([join(root, 'cache/first')]);
  expect(result.failure).toBe(`Error: rm failed (1) for ${root}/cache/second: permission denied`);
  expect(result.newEntries).toEqual([join(root, 'cache/new-runtime')]);
  expect((await readdir(join(root, 'cache'))).sort()).toEqual(['new-runtime', 'second', 'third']);
  expect(await Bun.file(result.logPath ?? '').json()).toEqual(result);
  expect(result.before).not.toBeNull();
  expect(result.after).not.toBeNull();
});

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
