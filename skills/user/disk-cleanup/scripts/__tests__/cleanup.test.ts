import { afterEach, beforeEach, expect, test } from 'bun:test';
import { lstat, mkdir, symlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, createRepository, createRoot, disposeRoot, git } from './helpers';
import { assessDisk } from '../assessDisk';
import { renderAssessment } from '../renderAssessment';
import { scanAssessment } from '../scanAssessment';
import { runInspectionCommand } from '../runInspectionCommand';

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

test('explicit removal keeps its receipt under .state and refuses to delete cleanup records', async () => {
  await mkdir(join(rootPath, '.tmp/cache'), { recursive: true });
  await Bun.write(join(rootPath, '.tmp/cache/artifact.txt'), 'cache\n');
  const removal = cli(rootPath, ['paths', 'remove', join(rootPath, '.tmp'), '--root', rootPath, '--execute']);
  expect(removal.exitCode).toBe(0);
  const { logPath, removed } = JSON.parse(removal.stdout);
  expect(removed).toEqual([join(rootPath, '.tmp')]);
  expect(logPath.startsWith(join(rootPath, '.state/cleanup-'))).toBe(true);
  expect((await Bun.file(logPath).json()).removed).toEqual([join(rootPath, '.tmp')]);

  const recordCache = join(logPath, '../node_modules');
  await mkdir(recordCache);
  const rejected = cli(rootPath, ['paths', 'remove', recordCache, '--root', rootPath, '--execute']);
  expect(rejected.exitCode).toBe(1);
  expect(rejected.stderr).toContain('Preserve the root .state cleanup records');
  expect((await lstat(recordCache)).isDirectory()).toBe(true);
  expect(await Bun.file(logPath).exists()).toBe(true);
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

const words = (text: string): string[] => text.split(/[\s│├╰─]+/).filter(Boolean);

test.each(['120', '60', '40', '20'])('human help keeps all of its text at width %s', (columns) => {
  for (const args of [['--help'], ['disk', '--help'], ['dependencies', '--help']]) {
    const unwrapped = cli(rootPath, args, '0');
    const wrapped = cli(rootPath, args, '0', columns);
    expect(wrapped.exitCode).toBe(0);
    expect(words(wrapped.stdout)).toEqual(words(unwrapped.stdout));
    expect(wrapped.stdout).toBe(cli(rootPath, args, '0', columns).stdout);
    for (const line of wrapped.stdout.split('\n')) {
      if (Bun.stringWidth(line) > Number(columns)) expect(words(line)).toHaveLength(1);
    }
  }
});

test('COLUMNS sets the wrap width and continuation lines keep their column', () => {
  const lines = cli(rootPath, ['--help'], '0', '70').stdout.split('\n');
  const isTreeRow = (line: string): boolean => /[├╰]─ /.test(line);
  const treeSection = lines.slice(lines.findIndex(isTreeRow), lines.lastIndexOf(lines.filter(isTreeRow).at(-1) ?? ''));
  const continuations = treeSection.filter((line) => !isTreeRow(line) && line.trim() !== '');
  expect(continuations.length).toBeGreaterThan(0);
  expect(new Set(continuations.map((line) => line.search(/[^│ ]/)))).toEqual(new Set([37]));
  expect(lines.every((line) => Bun.stringWidth(line) <= 70)).toBe(true);
});

test('agent help is the same at every width', () => {
  const baseline = cli(rootPath, ['--help'], '1').stdout;
  for (const columns of ['20', '80', '500']) {
    expect(cli(rootPath, ['--help'], '1', columns).stdout).toBe(baseline);
  }
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

test('disk assessment includes deep project artifacts alongside caches and all inspection sections', async () => {
  const repositoryPath = await createRepository(rootPath, 'development/project');
  const artifactPath = join(repositoryPath, 'build/deep/target/artifact.bin');
  await mkdir(join(repositoryPath, 'build/deep/target'), { recursive: true });
  await mkdir(join(rootPath, '.cache/compiler'), { recursive: true });
  await Bun.write(artifactPath, Buffer.alloc(128 * 1024));
  await Bun.write(join(rootPath, '.cache/compiler/cache.bin'), Buffer.alloc(64 * 1024));
  const result = cli(rootPath, ['disk', 'assess', '--root', rootPath, '--size', '32K']);
  const report = await assessDisk(rootPath, 32 * 1024, 30, runInspectionCommand);
  expect(
    result.stdout
      .split('\n')
      .filter((line) => /^(filesystem|overview|largePaths|dependencies|worktrees|staleFolders|docker): /.test(line))
      .sort(),
  ).toEqual(report.sections.map((section) => renderAssessment({ type: 'section', section }).split('\n')[0]!).sort());
  expect(report.sections.map((section: { name: string }) => section.name)).toEqual([
    'filesystem',
    'overview',
    'largePaths',
    'dependencies',
    'worktrees',
    'staleFolders',
    'docker',
  ]);
  expect(report.sections[2]?.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: artifactPath, bytes: 128 * 1024 }),
      expect.objectContaining({ path: join(rootPath, '.cache/compiler/cache.bin'), bytes: 64 * 1024 }),
    ]),
  );
  expect(report.sections[3]?.isComplete).toBe(true);
  expect(report.sections[3]?.data).toMatchObject({
    dependencies: [
      {
        path: join(repositoryPath, 'node_modules'),
        eligible: true,
        bytes: expect.any(Number),
      },
    ],
  });
  expect(await Bun.file(artifactPath).size).toBe(128 * 1024);
});

test('disk assessment retains successful sections when Git inspection fails', async () => {
  await mkdir(join(rootPath, 'broken'), { recursive: true });
  await Bun.write(join(rootPath, 'broken/.git'), 'gitdir: missing-worktree-metadata\n');
  await Bun.write(join(rootPath, 'keep.txt'), 'keep\n');
  const result = cli(rootPath, ['disk', 'assess', '--root', rootPath, '--size', '1B']);
  expect(result.exitCode).toBe(1);
  const report = await assessDisk(rootPath, 1, 30, runInspectionCommand);
  expect(result.stdout.split('\n').filter((line) => line.startsWith('Assessment '))).toEqual([
    `Assessment INCOMPLETE. Failed sections: ${report.sections
      .filter((section) => !section.isComplete)
      .map((section) => section.name)
      .join(', ')}. Successful results are shown above.`,
  ]);
  expect(report.isComplete).toBe(false);
  expect(report.sections[0]?.isComplete).toBe(true);
  expect(report.sections[1]?.data).toEqual(expect.arrayContaining([expect.objectContaining({ path: rootPath })]));
  expect(report.sections[4]?.isComplete).toBe(false);
  expect(await Bun.file(join(rootPath, 'keep.txt')).text()).toBe('keep\n');
});

test('disk assessment waits for the shared scan and preserves readable partial results', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hasFinished = false;
  const assessment = assessDisk(rootPath, 1, 30, runInspectionCommand, [], async (...args) => {
    started.resolve();
    await release.promise;
    const data = await scanAssessment(...args);
    data.inventory.errors.push({ repository: rootPath, message: 'unreadable child' });
    return data;
  }).then((report) => {
    hasFinished = true;
    return report;
  });
  await started.promise;
  expect(hasFinished).toBe(false);
  release.resolve();
  const report = await assessment;
  expect(report.isComplete).toBe(false);
  expect(report.sections[1]).toMatchObject({
    name: 'overview',
    isComplete: false,
    data: expect.arrayContaining([expect.objectContaining({ path: rootPath })]),
    errors: [`${rootPath}: unreadable child`],
  });
  expect(report.sections.map((section) => section.name)).toEqual([
    'filesystem',
    'overview',
    'largePaths',
    'dependencies',
    'worktrees',
    'staleFolders',
    'docker',
  ]);
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
