import type { Stats } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { owningRepository } from './filesystemUtils';
import { latestGitActivity } from './inventory';
import { parseLsofResult } from './parseLsofResult';
import type { RustActivity } from './types';

export function directoryStamp(info: Stats): string {
  return `${info.dev}:${info.ino}:${info.mtimeMs}:${info.ctimeMs}`;
}

export async function inspectRustActivity(
  project: string,
  ownDirectoryChanges: ReadonlyMap<string, string> = new Map(),
): Promise<RustActivity> {
  const device = (await lstat(project)).dev;
  let latestActivityMs = 0;
  const repositories = new Set<string>();
  const owner = await owningRepository(project);
  if (!owner) throw new Error(`No Git owner for activity inspection: ${project}`);
  repositories.add(owner);
  async function walk(path: string): Promise<void> {
    const info = await lstat(path);
    if (info.dev !== device) throw new Error(`Activity scan crosses a filesystem boundary: ${path}`);
    if (!info.isDirectory() || ownDirectoryChanges.get(path) !== directoryStamp(info)) {
      latestActivityMs = Math.max(latestActivityMs, info.mtimeMs, info.ctimeMs);
    }
    if (!info.isDirectory()) return;
    const entries = await readdir(path, { withFileTypes: true });
    if (entries.some((entry) => entry.name === '.git')) repositories.add(path);
    for (const entry of entries) await walk(join(path, entry.name));
  }
  await walk(project);
  for (const repository of repositories) {
    latestActivityMs = Math.max(latestActivityMs, ((await latestGitActivity(repository)) ?? 0) * 1000);
  }
  if (!process.getuid) throw new Error('Rust process inspection requires a Unix user ID');
  const child = Bun.spawn(['lsof', '-nP', '-a', '-u', String(process.getuid()), '+D', project, '-F', 'p'], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, LC_ALL: 'C' },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const { pids, warnings } = parseLsofResult(project, stdout, stderr, code);
  return { latestActivityMs, pids, processWarnings: warnings };
}
