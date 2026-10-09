import { afterEach, beforeEach, expect, test } from 'bun:test';
import { lstat, mkdir, symlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, createRepository, createRoot, disposeRoot, git } from './helpers';

let rootPath: string;
beforeEach(async () => {
  rootPath = await createRoot();
});
afterEach(async () => {
  await disposeRoot(rootPath);
});

test('dependency removal previews by default', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  const result = cli(rootPath, ['dependencies', 'remove', '--root', rootPath]);
  expect(result.exitCode).toBe(0);
  expect((await lstat(join(repositoryPath, 'node_modules'))).isDirectory()).toBe(true);
});

test('removes inactive dependencies, retains recent projects and uncommitted source', async () => {
  const oldPath = await createRepository(rootPath, 'old');
  const recentPath = await createRepository(rootPath, 'recent', 1);
  await Bun.write(join(oldPath, 'source.txt'), 'uncommitted source\n');
  const result = cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--execute']);
  expect(result.exitCode).toBe(0);
  expect(await Bun.file(join(oldPath, 'node_modules/package.txt')).exists()).toBe(false);
  expect(await Bun.file(join(recentPath, 'node_modules/package.txt')).text()).toBe('dependency\n');
  expect(await Bun.file(join(oldPath, 'source.txt')).text()).toBe('uncommitted source\n');
});

test('recent reflog activity protects a project with an old commit', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  git(repositoryPath, ['checkout', '-b', 'recent-checkout'], 1);
  expect(cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(await Bun.file(join(repositoryPath, 'node_modules/package.txt')).exists()).toBe(true);
});

test('tracked dependencies are preserved', async () => {
  const repositoryPath = await createRepository(rootPath, 'tracked');
  git(repositoryPath, ['add', '-f', 'node_modules/package.txt']);
  git(repositoryPath, ['commit', '-m', 'tracked dependency']);
  expect(cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(await Bun.file(join(repositoryPath, 'node_modules/package.txt')).exists()).toBe(true);
});

test('dependencies without a Git owner are preserved', async () => {
  await mkdir(join(rootPath, 'node_modules'));
  await Bun.write(join(rootPath, 'node_modules/data.txt'), 'keep\n');
  expect(cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(await Bun.file(join(rootPath, 'node_modules/data.txt')).text()).toBe('keep\n');
});

test('rejects invalid inactivity intervals before deletion', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  expect(cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--days', '-1', '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(repositoryPath, 'node_modules/package.txt')).exists()).toBe(true);
});

test('explicit cache removal verifies deletion and preserves source', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  const cachePath = join(repositoryPath, '.tmp/cache with spaces');
  await mkdir(cachePath, { recursive: true });
  await Bun.write(join(cachePath, 'artifact.txt'), 'cache\n');
  expect(cli(rootPath, ['paths', 'remove', cachePath, '--root', rootPath]).exitCode).toBe(0);
  expect(await Bun.file(join(cachePath, 'artifact.txt')).exists()).toBe(true);
  expect(cli(rootPath, ['paths', 'remove', cachePath, '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(await Bun.file(join(cachePath, 'artifact.txt')).exists()).toBe(false);
  expect(await Bun.file(join(repositoryPath, 'source.txt')).text()).toBe('source\n');
});

test('validates the entire explicit batch before removing anything', async () => {
  const cachePath = join(rootPath, '.tmp/cache');
  await mkdir(cachePath, { recursive: true });
  await Bun.write(join(cachePath, 'keep.txt'), 'keep\n');
  expect(cli(rootPath, ['paths', 'remove', cachePath, rootPath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(cachePath, 'keep.txt')).text()).toBe('keep\n');
});

test('rejects symlink escape from the selected root', async () => {
  const outsidePath = await createRoot();
  await mkdir(join(outsidePath, 'cache'));
  await Bun.write(join(outsidePath, 'cache/keep.txt'), 'keep\n');
  await mkdir(join(rootPath, '.tmp'));
  await symlink(outsidePath, join(rootPath, '.tmp/link'));
  expect(
    cli(rootPath, ['paths', 'remove', join(rootPath, '.tmp/link/cache'), '--root', rootPath, '--execute']).exitCode,
  ).toBe(1);
  expect(await Bun.file(join(outsidePath, 'cache/keep.txt')).text()).toBe('keep\n');
  await disposeRoot(outsidePath);
});

test('worktree removal previews, then removes through Git', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const worktreePath = join(repositoryPath, '.workspaces/review');
  git(repositoryPath, ['worktree', 'add', '-b', 'review', worktreePath]);
  expect(cli(rootPath, ['worktrees', 'remove', worktreePath, '--root', rootPath]).exitCode).toBe(0);
  expect((await lstat(worktreePath)).isDirectory()).toBe(true);
  expect(cli(rootPath, ['worktrees', 'remove', worktreePath, '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(git(repositoryPath, ['worktree', 'list', '--porcelain'])).toBe(
    `worktree ${repositoryPath}\nHEAD ${git(repositoryPath, ['rev-parse', 'HEAD']).trim()}\nbranch refs/heads/main\n\n`,
  );
});

test('refuses worktree removal when ignored files exist', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const worktreePath = join(repositoryPath, '.workspaces/review');
  git(repositoryPath, ['worktree', 'add', '-b', 'review', worktreePath]);
  await mkdir(join(worktreePath, '.tmp'));
  await Bun.write(join(worktreePath, '.tmp/ignored.txt'), 'keep\n');
  expect(cli(rootPath, ['worktrees', 'remove', worktreePath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(worktreePath, '.tmp/ignored.txt')).text()).toBe('keep\n');
});

test('refuses removal of locked worktrees', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const worktreePath = join(repositoryPath, '.workspaces/review');
  git(repositoryPath, ['worktree', 'add', '-b', 'review', worktreePath]);
  git(repositoryPath, ['worktree', 'lock', worktreePath]);
  expect(cli(rootPath, ['worktrees', 'remove', worktreePath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect((await lstat(worktreePath)).isDirectory()).toBe(true);
});

test('refuses worktree removal while the main index is locked', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const worktreePath = join(repositoryPath, '.workspaces/review');
  git(repositoryPath, ['worktree', 'add', '-b', 'review', worktreePath]);
  await Bun.write(join(repositoryPath, '.git/index.lock'), 'another operation\n');
  expect(cli(rootPath, ['worktrees', 'remove', worktreePath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect((await lstat(worktreePath)).isDirectory()).toBe(true);
});

test('prints the maintained skill verbatim from another working directory in both modes', async () => {
  const expected = await Bun.file(join(import.meta.dir, '../../SKILL.md')).text();
  expect(cli(rootPath, ['skill'], '1').stdout).toBe(expected);
  expect(cli(rootPath, ['skill'], '0').stdout).toBe(expected);
  expect(cli(rootPath, ['skill', 'extra']).exitCode).toBe(1);
});

test.each(
  [['--help'], ['dependencies', '--help'], ['help', 'worktrees'], ['disk', 'inspect', '--help']].map((args) => ({
    args,
  })),
)('agent help prints its alert once for %j', ({ args }) => {
  const result = cli(rootPath, args);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.split('\n')[0]).toBe('ALERT: Agents must read `AGENT=1 cleanup skill` before using this tool.');
  expect(result.stdout.split('ALERT:').length).toBe(2);
});

test('human help has no agent alert', () => {
  const result = cli(rootPath, ['dependencies', '--help'], '0');
  expect(result.exitCode).toBe(0);
  expect(result.stdout.split('\n')[0]).toBe('Usage: cleanup dependencies [options] [command]');
});

test('recent commits on another branch protect dependencies', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  git(repositoryPath, ['checkout', '-b', 'recent-branch']);
  await Bun.write(join(repositoryPath, 'other.txt'), 'recent\n');
  git(repositoryPath, ['add', 'other.txt'], 1);
  git(repositoryPath, ['commit', '-m', 'recent'], 1);
  git(repositoryPath, ['checkout', 'main']);
  expect(cli(rootPath, ['dependencies', 'remove', '--root', rootPath, '--execute']).exitCode).toBe(0);
  expect(await Bun.file(join(repositoryPath, 'node_modules/package.txt')).exists()).toBe(true);
});

test('rejects tracked artifacts and embedded repositories', async () => {
  const repositoryPath = await createRepository(rootPath, 'old');
  const cachePath = join(repositoryPath, '.tmp/cache');
  await mkdir(cachePath, { recursive: true });
  await Bun.write(join(cachePath, 'tracked.txt'), 'keep\n');
  git(repositoryPath, ['add', '-f', '.tmp/cache/tracked.txt']);
  git(repositoryPath, ['commit', '-m', 'tracked artifact']);
  expect(cli(rootPath, ['paths', 'remove', cachePath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(cachePath, 'tracked.txt')).text()).toBe('keep\n');
  const nestedPath = await createRepository(cachePath, 'nested');
  expect(cli(rootPath, ['paths', 'remove', nestedPath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(nestedPath, 'source.txt')).text()).toBe('source\n');
});

test('lists unregistered workspace directories as unregistered', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const workspacePath = join(repositoryPath, '.workspaces/unregistered');
  await mkdir(workspacePath, { recursive: true });
  await Bun.write(join(workspacePath, 'artifact.txt'), 'artifact\n');
  const result = cli(rootPath, ['worktrees', 'list', '--root', rootPath]);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    root: rootPath,
    worktrees: [
      {
        path: workspacePath,
        repository: repositoryPath,
        isRegistered: false,
        changedEntries: null,
        ignoredEntries: null,
      },
    ],
  });
  expect(cli(rootPath, ['worktrees', 'remove', workspacePath, '--root', rootPath, '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(workspacePath, 'artifact.txt')).text()).toBe('artifact\n');
});

test('reports broken Git metadata alongside intact workspace inventory', async () => {
  const repositoryPath = await createRepository(rootPath, 'repository');
  const brokenPath = join(repositoryPath, '.workspaces/broken');
  await mkdir(brokenPath, { recursive: true });
  await Bun.write(join(brokenPath, '.git'), 'gitdir: missing-worktree-metadata\n');
  const result = cli(rootPath, ['worktrees', 'list', '--root', rootPath]);
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    root: rootPath,
    errors: [{ repository: brokenPath }],
    worktrees: [{ path: brokenPath, isRegistered: false }],
  });
});

test('disk inspection measures an existing fixture without altering it', async () => {
  await Bun.write(join(rootPath, 'file.txt'), 'keep\n');
  const result = cli(rootPath, ['disk', 'inspect', '--root', rootPath, '--depth', '1']);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ root: rootPath, folders: [{ path: rootPath }] });
  expect(await Bun.file(join(rootPath, 'file.txt')).text()).toBe('keep\n');
});

test('folders list detects folders exceeding size and staleness thresholds', async () => {
  const staleFolder = join(rootPath, 'stale-folder');
  await mkdir(staleFolder, { recursive: true });
  const filePath = join(staleFolder, 'data.bin');
  await Bun.write(filePath, Buffer.alloc(200 * 1024));
  const sixtyDaysAgoSec = Math.floor((Date.now() - 60 * 86400000) / 1000);
  await utimes(filePath, sixtyDaysAgoSec, sixtyDaysAgoSec);

  const result = cli(rootPath, [
    'folders',
    'list',
    '--root',
    rootPath,
    '--size',
    '100K',
    '--days',
    '30',
    '--time',
    'modified',
  ]);
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.folders.length).toBe(1);
  expect(parsed.folders[0].path).toBe(staleFolder);
  expect(parsed.folders[0].bytes).toBeGreaterThanOrEqual(200 * 1024);
  expect(parsed.folders[0].daysSinceModified).toBeGreaterThanOrEqual(59);
});

test('folders list ignores actively modified or accessed folders', async () => {
  const activeFolder = join(rootPath, 'active-folder');
  await mkdir(activeFolder, { recursive: true });
  const filePath = join(activeFolder, 'data.bin');
  await Bun.write(filePath, Buffer.alloc(200 * 1024));
  const oneDayAgoSec = Math.floor((Date.now() - 86400000) / 1000);
  await utimes(filePath, oneDayAgoSec, oneDayAgoSec);

  const result = cli(rootPath, ['folders', 'list', '--root', rootPath, '--size', '100K', '--days', '30']);
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.folders.length).toBe(0);
});

test('folders list ignores folders below size threshold', async () => {
  const smallFolder = join(rootPath, 'small-folder');
  await mkdir(smallFolder, { recursive: true });
  const filePath = join(smallFolder, 'tiny.bin');
  await Bun.write(filePath, Buffer.alloc(10 * 1024));
  const sixtyDaysAgoSec = Math.floor((Date.now() - 60 * 86400000) / 1000);
  await utimes(filePath, sixtyDaysAgoSec, sixtyDaysAgoSec);

  const result = cli(rootPath, ['folders', 'list', '--root', rootPath, '--size', '100K', '--days', '30']);
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.folders.length).toBe(0);
});

test('folders list prunes nested matches by default and includes them with --no-prune', async () => {
  const parentFolder = join(rootPath, 'parent');
  const childFolder = join(parentFolder, 'child');
  await mkdir(childFolder, { recursive: true });
  const childFile = join(childFolder, 'child.bin');
  await Bun.write(childFile, Buffer.alloc(150 * 1024));
  const sixtyDaysAgoSec = Math.floor((Date.now() - 60 * 86400000) / 1000);
  await utimes(childFile, sixtyDaysAgoSec, sixtyDaysAgoSec);

  const prunedResult = cli(rootPath, [
    'folders',
    'list',
    '--root',
    rootPath,
    '--size',
    '100K',
    '--days',
    '30',
    '--time',
    'modified',
  ]);
  expect(prunedResult.exitCode).toBe(0);
  const prunedParsed = JSON.parse(prunedResult.stdout);
  expect(prunedParsed.folders.length).toBe(1);
  expect(prunedParsed.folders[0].path).toBe(parentFolder);

  const unprunedResult = cli(rootPath, [
    'folders',
    'list',
    '--root',
    rootPath,
    '--size',
    '100K',
    '--days',
    '30',
    '--time',
    'modified',
    '--no-prune',
  ]);
  expect(unprunedResult.exitCode).toBe(0);
  const unprunedParsed = JSON.parse(unprunedResult.stdout);
  expect(unprunedParsed.folders.length).toBe(2);
});

test('folders list rejects invalid size specifications', async () => {
  const result = cli(rootPath, ['folders', 'list', '--root', rootPath, '--size', 'invalid']);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Invalid size specification');
});
