import { lstat, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { diskBytes, git, owningRepository, validatePath } from './filesystemUtils';
import { pathExists, rustArtifactPath } from './inspectRustProjects';
import type { ArtifactSelection, RustArtifactKind } from './types';

export async function selectRustArtifacts(
  root: string,
  project: string,
  kinds: RustArtifactKind[],
): Promise<ArtifactSelection> {
  const repository = await owningRepository(project);
  const tracked = new Set(
    repository
      ? (await git(repository, ['ls-files', '-z']))
          .split('\0')
          .filter(Boolean)
          .map((path) => resolve(repository, path))
      : [],
  );
  const device = (await lstat(project)).dev;
  async function walk(path: string): Promise<ArtifactSelection> {
    const info = await lstat(path);
    let reason: string | null = null;
    if (info.isSymbolicLink()) reason = 'symbolic link';
    else if (info.dev !== device) reason = 'different filesystem';
    else if (tracked.has(path)) reason = 'Git-tracked content';
    else if (!info.isFile() && !info.isDirectory()) reason = 'special file';
    if (reason) return { actions: [], preserved: [{ path, reason }] };
    if (info.isDirectory()) {
      const entries = await readdir(path);
      if (
        entries.includes('.git') ||
        (entries.includes('HEAD') && entries.includes('objects') && entries.includes('refs'))
      ) {
        return { actions: [], preserved: [{ path, reason: 'embedded Git repository' }] };
      }
      const children: ArtifactSelection = { actions: [], preserved: [] };
      for (const entry of entries.sort()) {
        const result = await walk(join(path, entry));
        children.actions.push(...result.actions);
        children.preserved.push(...result.preserved);
      }
      if (children.preserved.length > 0) return children;
    }
    await validatePath(root, path);
    return { actions: [{ path, repository, kind: 'cache', bytes: 0 }], preserved: [] };
  }
  const result: ArtifactSelection = { actions: [], preserved: [] };
  for (const kind of kinds) {
    if (kind === 'coverage' && kinds.includes('target')) continue;
    const path = rustArtifactPath(project, kind);
    if (!(await pathExists(path))) continue;
    // Validate ancestors before entering the artifact tree; links inside it are preserved.
    await validatePath(root, project);
    if (relative(project, path).startsWith('target/')) await validatePath(root, join(project, 'target'));
    const selected = await walk(path);
    result.actions.push(...selected.actions);
    result.preserved.push(...selected.preserved);
  }
  for (const action of result.actions) action.bytes = await diskBytes(action.path);
  return result;
}
