import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export async function run(args: string[]): Promise<string> {
  const process = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`${args[0]} failed (${exitCode}): ${stderr.trim()}`);
  return stdout;
}

export async function git(repository: string, args: string[]): Promise<string> {
  return run(['git', '-C', repository, ...args]);
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
  const result = Bun.spawnSync(['git', '-C', path, 'rev-parse', '--show-toplevel'], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  if (!result.success) {
    const message = result.stderr.toString();
    if (message.includes('not a git repository')) return null;
    throw new Error(message);
  }
  return realpath(result.stdout.toString().trim());
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
