import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diskBytes, validatePath } from './filesystemUtils';
import { inspectRustActivity } from './inspectRustActivity';
import { validateRustStorage } from './validateRustStorage';
import type { RustArtifact, RustArtifactKind, RustProject } from './types';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export function rustArtifactPath(project: string, kind: RustArtifactKind): string {
  return join(project, kind === 'tmp' ? '.tmp' : kind === 'coverage' ? 'target/llvm-cov-target' : 'target');
}

export async function inspectRustProject(
  root: string,
  project: string,
  cutoffMs: number,
  ownDirectoryChanges: ReadonlyMap<string, string> = new Map(),
): Promise<RustProject> {
  const report: RustProject = {
    path: project,
    eligible: false,
    reason: 'inspection incomplete',
    error: null,
    latestActivityMs: null,
    pids: [],
    processWarnings: [],
    artifacts: [],
  };
  try {
    await validatePath(root, project);
    const kinds: RustArtifactKind[] = ['tmp', 'coverage', 'target'];
    for (const kind of kinds) {
      const path = rustArtifactPath(project, kind);
      const exists = await pathExists(path);
      const artifact: RustArtifact = { kind, path, exists, bytes: null };
      report.artifacts.push(artifact);
      if (exists) {
        await validatePath(root, path);
        artifact.bytes = await diskBytes(path);
      }
    }
    await validateRustStorage(root, project);
    const activity = await inspectRustActivity(project, ownDirectoryChanges);
    report.latestActivityMs = activity.latestActivityMs;
    report.pids = activity.pids;
    report.processWarnings = activity.processWarnings;
    report.reason =
      activity.pids.length > 0
        ? 'open files or working directories'
        : activity.latestActivityMs >= cutoffMs
          ? 'recent filesystem or Git activity'
          : 'inactive project';
    report.eligible = report.reason === 'inactive project';
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.reason = 'inspection failed; preserve project';
  }
  return report;
}

export async function inspectRustProjects(
  root: string,
  idleMs: number,
  now: number = Date.now(),
): Promise<RustProject[]> {
  const reports: RustProject[] = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const path = join(root, entry.name);
    if (await pathExists(join(path, 'Cargo.toml'))) reports.push(await inspectRustProject(root, path, now - idleMs));
  }
  return reports;
}
