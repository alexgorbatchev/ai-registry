import { lstat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRecordDirectory, ensureUntrackedInParent, isRecordPath, validatePath } from './filesystemUtils';
import { assertDisjoint } from './inventory';
import { inspectNativeProcesses } from './inspectNativeProcesses';
import { inspectNativeHardlink } from './inspectNativeHardlink';
import { runInspectionCommand } from './runInspectionCommand';
import type { NativeAction, NativeHardlinks, NativeInspection, NativeManifest, NativeReview } from './nativeTypes';
import type { InspectionRunner, PathReason } from './types';

export async function inspectNativeTarget(
  root: string,
  input: string,
  hardlinkState?: NativeHardlinks,
): Promise<NativeInspection> {
  const path = await validatePath(root, input);
  const rootInfo = await lstat(path);
  if (!rootInfo.isDirectory()) throw new Error(`Native target must be a directory: ${path}`);
  await ensureUntrackedInParent(path);
  const hash = createHash('sha256');
  const links = new Set<number>();
  const hardlinks: string[] = [];
  const inodes: string[] = [];
  let bytes = 0;
  async function walk(current: string): Promise<void> {
    const info = current === path ? rootInfo : await lstat(current);
    if (info.dev !== rootInfo.dev) throw new Error(`Target crosses a filesystem boundary: ${current}`);
    const key = `${info.dev}:${info.ino}`;
    inodes.push(key);
    let ctimeMs = info.ctimeMs;
    if ((info.isFile() || info.isSymbolicLink()) && (info.nlink > 1 || hardlinkState?.baseline.has(key))) {
      if (hardlinkState) ctimeMs = await inspectNativeHardlink(current, info, hardlinkState);
      hardlinks.push(key);
    }
    hash.update(JSON.stringify([current, info.dev, info.ino, ctimeMs, info.mtimeMs, info.size]));
    if (info.nlink > 1 && !info.isDirectory()) {
      if (!links.has(info.ino)) bytes += info.blocks * 512;
      links.add(info.ino);
    } else bytes += info.blocks * 512;
    if (!info.isDirectory()) return;
    const names = (await readdir(current)).sort();
    if (names.includes('.git')) throw new Error(`Contains a Git repository: ${current}`);
    for (const name of names) await walk(join(current, name));
  }
  await walk(path);
  return { path, identity: hash.digest('hex'), bytes, hardlinks, inodes };
}

export async function createNativeLog(root: string): Promise<string> {
  return createRecordDirectory(root, 'native-cleanup-');
}

export async function reviewNativeTargets(
  root: string,
  inputs: string[],
  runner: InspectionRunner = runInspectionCommand,
): Promise<NativeReview> {
  const actions: NativeAction[] = [];
  const preserved: PathReason[] = [];
  const targetInodes = new Map<string, string[]>();
  // Validate lexical scope for the whole selection before classifying individual entries.
  const paths = await Promise.all(inputs.map((input) => validatePath(root, input)));
  assertDisjoint(root, paths);
  if (paths.some((path) => isRecordPath(root, path))) throw new Error('Preserve the root .state cleanup records');
  for (const path of paths) {
    try {
      const { identity, bytes, inodes } = await inspectNativeTarget(root, path);
      if (identity !== (await inspectNativeTarget(root, path)).identity)
        throw new Error(`Target changed during review: ${path}`);
      actions.push({ path, identity, bytes, repository: null, kind: 'cache' });
      targetInodes.set(path, inodes);
    } catch (error) {
      preserved.push({ path, reason: String(error) });
    }
  }
  const processes = paths.length
    ? await inspectNativeProcesses(paths, runner, targetInodes)
    : { active: [], warnings: [] };
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
