import { lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validatePath } from './filesystemUtils';
import { directoryStamp } from './inspectRustActivity';
import { inspectRustProject } from './inspectRustProjects';
import { assertDisjoint } from './inventory';
import { removeTargets, validateCache } from './removeTargets';
import { selectRustArtifacts } from './selectRustArtifacts';
import type { Action, PreservedArtifact, RustProject, RustRemovalOptions } from './types';

export async function removeRustArtifacts(
  options: RustRemovalOptions,
  now: number = Date.now(),
  inspectProject: typeof inspectRustProject = inspectRustProject,
): Promise<unknown> {
  const projects = options.projects.map((path) => resolve(options.root, path));
  assertDisjoint(options.root, projects);
  if (!options.artifacts.length) throw new Error('Select at least one artifact scope');
  const reports: RustProject[] = [];
  const actions: Action[] = [];
  const preserved: PreservedArtifact[] = [];
  const owners = new Map<string, string>();
  const ownDirectoryChanges = new Map<string, string>();
  const cutoffMs = now - options.idleMs;
  for (const project of projects) {
    if (dirname(project) !== options.root) throw new Error(`Select a direct child project: ${project}`);
    await validatePath(options.root, project);
    const report = await inspectProject(options.root, project, cutoffMs);
    reports.push(report);
    if (report.error) throw new Error(report.error);
    if (!report.eligible) {
      preserved.push({ path: project, reason: report.reason });
      continue;
    }
    const selection = await selectRustArtifacts(options.root, project, options.artifacts);
    actions.push(...selection.actions);
    preserved.push(...selection.preserved);
    for (const action of selection.actions) owners.set(action.path, project);
  }
  const result = await removeTargets(
    options,
    actions,
    async (action) => {
      const project = owners.get(action.path);
      if (!project) throw new Error(`Missing project owner: ${action.path}`);
      const report = await inspectProject(options.root, project, cutoffMs, ownDirectoryChanges);
      if (!report.eligible)
        throw new Error(`Project is no longer eligible: ${project}: ${report.error ?? report.reason}`);
      const selection = await selectRustArtifacts(options.root, project, options.artifacts);
      if (!selection.actions.some((candidate) => candidate.path === action.path)) {
        throw new Error(`Artifact contents changed; preview again: ${action.path}`);
      }
      await validateCache(options.root, action.path);
    },
    async (action) => {
      const parent = dirname(action.path);
      ownDirectoryChanges.set(parent, directoryStamp(await lstat(parent)));
    },
  );
  return { projects: reports, preserved, result };
}
