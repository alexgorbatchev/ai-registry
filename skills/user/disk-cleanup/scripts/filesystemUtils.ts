import { lstat, mkdir, mkdtemp, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { runInspectionCommand } from './runInspectionCommand';
import type { RepositoryCheck, RepositoryChecker } from './types';

export async function run(args: string[]): Promise<string> {
  const { stdout, stderr, exitCode } = await runInspectionCommand(args);
  if (exitCode !== 0) throw new Error(`${args[0]} failed (${exitCode}): ${stderr.trim()}`);
  return stdout;
}

export async function git(repository: string, args: string[]): Promise<string> {
  return run(['git', '-C', repository, ...args]);
}

// Git has no structured error codes; these fatal messages mean the `.git` entry itself is unusable.
const invalidMetadata =
  /not a git repository|gitfile does not point to a valid repository|invalid gitfile format|cannot chdir to|unable to set up work tree/;

// A directory holding a `.git` entry owns its contents only when Git resolves that directory as its own
// working tree. A broken entry, or one Git ignores in favor of an outer repository, is invalid metadata.
export async function checkRepository(repository: string): Promise<RepositoryCheck> {
  const { stdout, stderr, exitCode } = await runInspectionCommand([
    'git',
    '-C',
    repository,
    'rev-parse',
    '--path-format=absolute',
    '--show-toplevel',
    '--git-common-dir',
  ]);
  if (exitCode !== 0) {
    const message = stderr.trim().replace(/^fatal: /, '');
    if (exitCode === 128 && invalidMetadata.test(message)) return { invalid: message };
    throw new Error(`git failed (${exitCode}): ${stderr.trim()}`);
  }
  const [toplevel, commonDirectory] = stdout.trim().split('\n');
  if (!toplevel || !commonDirectory) throw new Error(`Unexpected git rev-parse output: ${stdout.trim()}`);
  if (toplevel !== repository) return { invalid: `Git resolves this directory to ${toplevel}` };
  return { commonDirectory };
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** True when a path no longer exists. Paths removed during inspection no longer occupy disk space. */
export async function isVanished(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    return isMissing(error);
  }
}

export function repositoryChecker(): RepositoryChecker {
  const checks = new Map<string, Promise<RepositoryCheck>>();
  return (repository) => {
    const pending = checks.get(repository) ?? checkRepository(repository);
    checks.set(repository, pending);
    return pending;
  };
}

export async function resolveRoot(root: string): Promise<string> {
  const rootPath = await realpath(resolve(root));
  if (!(await lstat(rootPath)).isDirectory()) throw new Error('Root must be a directory');
  if (rootPath === sep) throw new Error('Filesystem root is outside the cleanup scope');
  return rootPath;
}

export function isWithin(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

// Manifests and execution receipts outlive the session that wrote them, so they stay out of `.tmp`.
function recordContainer(root: string): string {
  return join(root, '.state');
}

export function isRecordPath(root: string, path: string): boolean {
  return path === recordContainer(root) || isWithin(recordContainer(root), path);
}

export async function createRecordDirectory(root: string, prefix: string): Promise<string> {
  const container = recordContainer(root);
  await mkdir(container, { recursive: true });
  await validatePath(root, container);
  return mkdtemp(join(container, prefix));
}

export async function validatePath(root: string, input: string): Promise<string> {
  const path = resolve(root, input);
  if (!isWithin(root, path)) throw new Error(`Path must be strictly inside the selected root: ${input}`);
  let current = root;
  const rootDevice = (await lstat(root)).dev;
  for (const component of relative(root, path).split(sep)) {
    if (component === '.git') throw new Error('Git metadata cannot be deleted');
    current = join(current, component);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links cannot be deleted: ${current}`);
    if (info.dev !== rootDevice) throw new Error(`Target crosses a filesystem boundary: ${current}`);
  }
  return path;
}

export async function diskBytes(path: string): Promise<number> {
  const output = await run(['du', '-sx', '-B1', '--', path]);
  const bytes = Number(output.slice(0, output.indexOf('\t')));
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`Invalid disk usage for ${path}`);
  return bytes;
}

export async function owningRepository(path: string): Promise<string | null> {
  const { stdout, stderr, exitCode } = await runInspectionCommand(['git', '-C', path, 'rev-parse', '--show-toplevel']);
  if (exitCode !== 0) {
    if (stderr.includes('not a git repository')) return null;
    throw new Error(stderr);
  }
  return realpath(stdout.trim());
}

// One Git call answers both questions the separate repository lookup and tracked-file check would:
// a parent outside any repository has nothing tracked.
export async function ensureUntrackedInParent(path: string): Promise<void> {
  const { stdout, stderr, exitCode } = await runInspectionCommand([
    'git',
    '-C',
    dirname(path),
    'ls-files',
    '-z',
    '--',
    `:(literal)${basename(path)}`,
  ]);
  if (exitCode !== 0) {
    if (stderr.includes('not a git repository')) return;
    throw new Error(`git failed (${exitCode}): ${stderr.trim()}`);
  }
  if (stdout) throw new Error(`Contains Git-tracked files: ${path}`);
}

export async function ensureUntracked(repository: string | null, path: string): Promise<void> {
  if (repository && (await git(repository, ['ls-files', '-z', '--', `:(literal)${relative(repository, path)}`]))) {
    throw new Error(`Contains Git-tracked files: ${path}`);
  }
}

export async function ensureNoRepositories(path: string, device?: number): Promise<void> {
  const info = await lstat(path);
  const expectedDevice = device ?? info.dev;
  if (info.dev !== expectedDevice) throw new Error(`Target contains a different filesystem: ${path}`);
  if (!info.isDirectory()) return;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === '.git') throw new Error(`Contains a Git repository: ${path}`);
    if (entry.isDirectory()) await ensureNoRepositories(join(path, entry.name), expectedDevice);
  }
}

export async function ensureAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Removal verification failed: ${path}`);
}
