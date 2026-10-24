import { afterEach, beforeEach, expect, test } from 'bun:test';
import assert from 'node:assert';
import { chmod, mkdir, readdir, symlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectRustProject, inspectRustProjects } from '../inspectRustProjects';
import { parseIdleDuration, parseRustArtifacts } from '../parseIdleDuration';
import { removeRustArtifacts } from '../removeRustArtifacts';
import { cli, createRoot, disposeRoot, git } from './helpers';

let root: string;
let project: string;
let now: number;
const idleMs = 30 * 60_000;

beforeEach(async () => {
  root = await createRoot();
  project = join(root, 'sample');
  await mkdir(project);
  git(project, ['init', '--initial-branch=main']);
  await Bun.write(join(project, 'Cargo.toml'), '[package]\nname = "sample"\nversion = "0.1.0"\n[workspace]\n');
  await Bun.write(join(project, 'src/lib.rs'), 'pub fn value() -> u8 { 1 }\n');
  await Bun.write(join(project, '.tmp/scratch'), 'scratch');
  await Bun.write(join(project, 'target/debug/incremental/state'), 'incremental');
  await Bun.write(join(project, 'target/llvm-cov-target/debug/coverage'), 'coverage');
  now = Date.now() + 3_600_000;
});
afterEach(async () => {
  await disposeRoot(root);
});

test.each([
  ['30m', 1_800_000],
  ['2h', 7_200_000],
  ['1d', 86_400_000],
])('parses idle duration %s', (text, expected) => {
  expect(parseIdleDuration(text)).toBe(expected);
});
test.each(['0m', '-1m', '30', '1.5h', '1s', '999999999999999999d'])('rejects invalid idle duration %s', (text) => {
  expect(() => parseIdleDuration(text)).toThrow('Use a positive whole number followed by m, h, or d');
});

test('artifact selection accepts explicit scopes and rejects duplicates or unknown kinds', () => {
  expect(parseRustArtifacts('tmp,coverage,target')).toEqual(['tmp', 'coverage', 'target']);
  expect(() => parseRustArtifacts('tmp,tmp')).toThrow('Duplicate artifact scope: tmp');
  expect(() => parseRustArtifacts('tmp,source')).toThrow('Choose comma-separated artifacts: tmp, coverage, target');
});

test('inventories tmp, target, and nested coverage without requiring commits', async () => {
  const reports = await inspectRustProjects(root, idleMs, now);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ path: project, eligible: true, error: null, pids: [] });
  expect(reports[0]?.artifacts.map((item) => [item.kind, item.path, item.exists])).toEqual([
    ['tmp', join(project, '.tmp'), true],
    ['coverage', join(project, 'target/llvm-cov-target'), true],
    ['target', join(project, 'target'), true],
  ]);
});

test('recent source protects every artifact even when build files are old', async () => {
  await utimes(join(project, 'src/lib.rs'), now / 1000, now / 1000);
  const reports = await inspectRustProjects(root, idleMs, now);
  expect(reports[0]).toMatchObject({ eligible: false, reason: 'recent filesystem or Git activity' });
});

test('backdated mtime cannot hide a recent file change', async () => {
  await utimes(join(project, 'src/lib.rs'), 1, 1);
  const reports = await inspectRustProjects(root, idleMs);
  expect(reports[0]).toMatchObject({ eligible: false, reason: 'recent filesystem or Git activity' });
});

test('preview leaves files and execution logs untouched', async () => {
  const result = await removeRustArtifacts(
    { root, projects: ['sample'], artifacts: ['tmp'], idleMs, execute: false },
    now,
  );
  expect(result).toMatchObject({ result: { execute: false, logPath: null } });
  expect(await Bun.file(join(project, '.tmp/scratch')).text()).toBe('scratch');
  expect(await Bun.file(join(root, '.tmp')).exists()).toBe(false);
});

test('tmp cleanup preserves embedded clones, symlinks, tracked data, and incremental state', async () => {
  const clone = join(project, '.tmp/clones/retained');
  await mkdir(clone, { recursive: true });
  git(clone, ['init', '--initial-branch=main']);
  await Bun.write(join(clone, 'source'), 'retained');
  await Bun.write(join(project, '.tmp/clones/scratch'), 'discard');
  await Bun.write(join(project, '.tmp/tracked'), 'tracked');
  git(project, ['add', '.tmp/tracked']);
  await symlink(join(project, 'src'), join(project, '.tmp/source-link'));
  const result = await removeRustArtifacts(
    { root, projects: ['sample'], artifacts: ['tmp'], idleMs, execute: true },
    now,
  );
  expect(result).toMatchObject({ result: { execute: true } });
  expect(await Bun.file(join(project, '.tmp/scratch')).exists()).toBe(false);
  expect(await Bun.file(join(project, '.tmp/clones/scratch')).exists()).toBe(false);
  expect(await Bun.file(join(clone, 'source')).text()).toBe('retained');
  expect(await Bun.file(join(project, '.tmp/tracked')).text()).toBe('tracked');
  expect(await Bun.file(join(project, '.tmp/source-link/lib.rs')).exists()).toBe(true);
  expect(await Bun.file(join(project, 'target/debug/incremental/state')).text()).toBe('incremental');
}, 20_000);

test('coverage cleanup retains ordinary development artifacts', async () => {
  await removeRustArtifacts({ root, projects: ['sample'], artifacts: ['coverage'], idleMs, execute: true }, now);
  expect(await Bun.file(join(project, 'target/llvm-cov-target/debug/coverage')).exists()).toBe(false);
  expect(await Bun.file(join(project, 'target/debug/incremental/state')).text()).toBe('incremental');
}, 20_000);

test('combined target and coverage scope deletes each path only once', async () => {
  const result = await removeRustArtifacts(
    { root, projects: ['sample'], artifacts: ['tmp', 'coverage', 'target'], idleMs, execute: true },
    now,
  );
  expect(result).toMatchObject({ result: { removed: [join(project, '.tmp'), join(project, 'target')] } });
  expect(await Bun.file(join(project, 'src/lib.rs')).exists()).toBe(true);
}, 20_000);

test('nonstandard Cargo target locations require manual review', async () => {
  await Bun.write(join(project, '.cargo/config.toml'), '[build]\ntarget-dir = "../shared-target"\n');
  const reports = await inspectRustProjects(root, idleMs, now);
  expect(reports[0]).toMatchObject({ eligible: false });
  expect(reports[0]?.error).toBe(`Nonstandard Cargo storage requires manual review: ${project}`);
});

test('remove requires explicit artifact scope and validates duration', () => {
  expect(cli(root, ['rust', 'remove', 'sample', '--root', root]).exitCode).toBe(1);
  expect(cli(root, ['rust', 'list', '--root', root, '--idle', '0m']).exitCode).toBe(1);
  expect(cli(root, ['rust', 'remove', 'sample', '--root', root, '--artifacts', 'source']).exitCode).toBe(1);
});

test('working directory of a live process protects an otherwise idle project', async () => {
  const child = Bun.spawn(['sleep', '30'], { cwd: project, stdout: 'ignore', stderr: 'pipe' });
  try {
    const reports = await inspectRustProjects(root, idleMs, now);
    expect(reports[0]).toMatchObject({ eligible: false, reason: 'open files or working directories' });
    expect(reports[0]?.pids.includes(child.pid)).toBe(true);
  } finally {
    child.kill();
    await child.exited;
  }
});

test('a running target executable is protected even with an external working directory', async () => {
  const executable = join(project, 'target/running');
  await Bun.write(executable, Bun.file('/bin/sleep'));
  await chmod(executable, 0o700);
  const child = Bun.spawn([executable, '30'], { cwd: root, stdout: 'ignore', stderr: 'pipe' });
  try {
    const reports = await inspectRustProjects(root, idleMs, now);
    expect(reports[0]).toMatchObject({ eligible: false, reason: 'open files or working directories' });
    expect(reports[0]?.pids.includes(child.pid)).toBe(true);
  } finally {
    child.kill();
    await child.exited;
  }
});

test('CLI lists recent projects and previews an explicit scope without deletion', () => {
  const listing = cli(root, ['rust', 'list', '--root', root, '--idle', '1h']);
  expect(listing.exitCode).toBe(0);
  expect(JSON.parse(listing.stdout)).toMatchObject({
    idleMs: 3_600_000,
    coverageIncludedInTarget: true,
    projects: [{ path: project, eligible: false }],
  });
  const preview = cli(root, ['rust', 'remove', 'sample', '--root', root, '--artifacts', 'tmp,target']);
  expect(preview.exitCode).toBe(0);
  expect(JSON.parse(preview.stdout)).toMatchObject({ result: { execute: false, actions: [], logPath: null } });
});

test('CLI reports failed inspections and refuses removal', async () => {
  await Bun.write(join(project, 'Cargo.toml'), 'invalid manifest');
  const listing = cli(root, ['rust', 'list', '--root', root]);
  expect(listing.exitCode).toBe(1);
  expect(JSON.parse(listing.stdout)).toMatchObject({
    projects: [{ eligible: false, reason: 'inspection failed; preserve project' }],
  });
  expect(cli(root, ['rust', 'remove', 'sample', '--root', root, '--artifacts', 'tmp', '--execute']).exitCode).toBe(1);
  expect(await Bun.file(join(project, '.tmp/scratch')).exists()).toBe(true);
});

test('a process holding an artifact open outside the project protects it', async () => {
  const child = Bun.spawn(['tail', '-f', join(project, 'target/debug/incremental/state')], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  try {
    const reader = child.stdout.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('incremental');
    reader.releaseLock();
    const reports = await inspectRustProjects(root, idleMs, now);
    expect(reports[0]?.pids.includes(child.pid)).toBe(true);
    expect(reports[0]?.eligible).toBe(false);
  } finally {
    child.kill();
    await child.exited;
  }
});

test('recent Git history protects old source and artifacts', async () => {
  git(project, ['add', 'Cargo.toml', 'src/lib.rs']);
  git(project, ['commit', '-m', 'recent'], -1);
  const reports = await inspectRustProjects(root, idleMs, now);
  expect(reports[0]).toMatchObject({ eligible: false, reason: 'recent filesystem or Git activity' });
});

test('recent projects are reported as preserved during execution', async () => {
  const result = await removeRustArtifacts({
    root,
    projects: ['sample'],
    artifacts: ['target'],
    idleMs,
    execute: true,
  });
  expect(result).toMatchObject({
    preserved: [{ path: project, reason: 'recent filesystem or Git activity' }],
    result: { execute: false, actions: [] },
  });
  expect(await Bun.file(join(project, 'target/debug/incremental/state')).exists()).toBe(true);
});

test('activity between removals stops the batch and logs the partial result', async () => {
  let inspections = 0;
  const changes = new Map([
    [
      5,
      async () => {
        await utimes(join(project, 'src/lib.rs'), now / 1000, now / 1000);
      },
    ],
  ]);
  const inspectProject: typeof inspectRustProject = async (...args) => {
    inspections += 1;
    await changes.get(inspections)?.();
    return inspectRustProject(...args);
  };
  await expect(
    removeRustArtifacts(
      { root, projects: ['sample'], artifacts: ['tmp', 'target'], idleMs, execute: true },
      now,
      inspectProject,
    ),
  ).rejects.toThrow('Cleanup stopped; inspect');
  expect(await Bun.file(join(project, '.tmp/scratch')).exists()).toBe(false);
  expect(await Bun.file(join(project, 'target/debug/incremental/state')).exists()).toBe(true);
  const [logDirectory] = await readdir(join(root, '.tmp'));
  assert(logDirectory);
  const log = await Bun.file(join(root, '.tmp', logDirectory, 'execution.json')).json();
  expect(log.removed).toEqual([join(project, '.tmp')]);
  expect(log.failure).toBe(`Error: Project is no longer eligible: ${project}: recent filesystem or Git activity`);
}, 20_000);

test('invalid selected project prevents any batch deletion', async () => {
  await expect(
    removeRustArtifacts({ root, projects: ['sample', '../outside'], artifacts: ['tmp'], idleMs, execute: true }, now),
  ).rejects.toThrow('Target is outside root');
  expect(await Bun.file(join(project, '.tmp/scratch')).exists()).toBe(true);
});

test('target symlinks are never followed or removed', async () => {
  const second = join(root, 'linked');
  await mkdir(second);
  await Bun.write(join(second, 'Cargo.toml'), '[workspace]\n');
  await symlink(join(project, 'target'), join(second, 'target'));
  const reports = await inspectRustProjects(root, idleMs, now);
  expect(reports[0]).toMatchObject({ path: second, eligible: false });
  expect(reports[0]?.error).toBe(`Symbolic links cannot be deleted: ${join(second, 'target')}`);
});

test('a bare repository inside tmp is retained with its contents', async () => {
  const bare = join(project, '.tmp/archive.git');
  await mkdir(bare);
  git(bare, ['init', '--bare']);
  const result = await removeRustArtifacts(
    { root, projects: ['sample'], artifacts: ['tmp'], idleMs, execute: true },
    now,
  );
  expect(result).toMatchObject({ preserved: [{ path: bare, reason: 'embedded Git repository' }] });
  expect(await Bun.file(join(bare, 'HEAD')).exists()).toBe(true);
  expect(await Bun.file(join(project, '.tmp/scratch')).exists()).toBe(false);
});
