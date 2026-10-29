import { lstat, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { diskBytes, ensureNoRepositories, ensureUntracked, owningRepository, validatePath } from './filesystemUtils';
import { assertDisjoint } from './inventory';
import { inspectNativeProcesses } from './inspectNativeProcesses';
import { runInspectionCommand } from './runInspectionCommand';
import type { NativeAction, NativeManifest, NativeReview } from './nativeTypes';
import type { InspectionRunner, PreservedArtifact } from './types';

export async function nativeIdentity(path: string): Promise<string> {
  const hash = createHash('sha256');
  const device = (await lstat(path)).dev;
  async function walk(current: string): Promise<void> {
    const info = await lstat(current);
    if (info.dev !== device) throw new Error(`Target crosses a filesystem boundary: ${current}`);
    hash.update(JSON.stringify([current, info.dev, info.ino, info.ctimeMs, info.mtimeMs, info.size]));
    if (info.isDirectory()) for (const name of (await readdir(current)).sort()) await walk(join(current, name));
  }
  await walk(path);
  return hash.digest('hex');
}

export async function validateNativeTarget(root: string, input: string): Promise<string> {
  const path = await validatePath(root, input);
  if (!(await lstat(path)).isDirectory()) throw new Error(`Native target must be a directory: ${path}`);
  const repository = await owningRepository(dirname(path));
  await ensureUntracked(repository, path);
  await ensureNoRepositories(path);
  return path;
}

export async function createNativeLog(root: string): Promise<string> {
  try {
    await lstat(join(root, '.tmp'));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    await mkdir(join(root, '.tmp'));
  }
  await validatePath(root, join(root, '.tmp'));
  return mkdtemp(join(root, '.tmp/native-cleanup-'));
}

export async function reviewNativeTargets(
  root: string,
  inputs: string[],
  runner: InspectionRunner = runInspectionCommand,
): Promise<NativeReview> {
  const actions: NativeAction[] = [];
  const preserved: PreservedArtifact[] = [];
  // Validate lexical scope for the whole selection before classifying individual entries.
  const paths = await Promise.all(inputs.map((input) => validatePath(root, input)));
  assertDisjoint(root, paths);
  if (paths.some((path) => path === join(root, '.tmp'))) throw new Error('Preserve the root .tmp log container');
  for (const path of paths) {
    try {
      await validateNativeTarget(root, path);
      const identity = await nativeIdentity(path);
      const bytes = await diskBytes(path);
      if (identity !== (await nativeIdentity(path))) throw new Error(`Target changed during review: ${path}`);
      actions.push({ path, identity, bytes, repository: null, kind: 'cache' });
    } catch (error) {
      preserved.push({ path, reason: String(error) });
    }
  }
  const processes = paths.length ? await inspectNativeProcesses(paths, runner) : { active: [], warnings: [] };
  for (const path of processes.active) {
    const index = actions.findIndex((action) => action.path === path);
    if (index >= 0) {
      actions.splice(index, 1);
      preserved.push({ path, reason: 'Open or mapped files, executable, or working directory' });
    }
  }
  preserved.sort((left, right) => paths.indexOf(left.path) - paths.indexOf(right.path));
  const logDirectory = await createNativeLog(root);
  const scopes = await Promise.all(
    [...new Set(paths.map(dirname))].map(async (path) => ({ path, entries: await readdir(path) })),
  );
  const manifest: NativeManifest = {
    version: 1,
    root,
    actions,
    preserved,
    scopes,
    processWarnings: processes.warnings,
  };
  const manifestPath = join(logDirectory, 'manifest.json');
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifestPath, manifest };
}
