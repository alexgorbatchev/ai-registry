import { lstat } from 'node:fs/promises';
import { isWithin } from './filesystemUtils';
import { inspectDependencies } from './inventory';
import { inspectWorktrees } from './inspectWorktrees';
import { scanAssessment } from './scanAssessment';
import type { AssessmentScan } from './scanAssessment';
import type {
  AssessmentReporter,
  AssessmentScanProgress,
  AssessmentSection,
  AssessmentTask,
  DiskAssessment,
  InspectionRunner,
} from './types';

export async function assessDisk(
  root: string,
  minimumBytes: number,
  days: number,
  runCommand: InspectionRunner,
  systemRoots: string[] = [],
  scan: typeof scanAssessment = scanAssessment,
  report: AssessmentReporter = () => {},
): Promise<DiskAssessment> {
  const scope: DiskAssessment['scope'] = {
    roots: [root, ...new Set(systemRoots)],
    exclusions: [
      'Other paths and users outside the listed roots',
      'Nested filesystems and symbolic-link traversal',
      'Unreadable paths reported in section errors',
    ],
    docker: 'Reported Docker context; may be remote',
  };
  report({ type: 'start', root, scope });
  async function command(name: string, args: string[], format: 'text' | 'json'): Promise<AssessmentSection> {
    let result;
    try {
      result = await runCommand(args);
    } catch (error) {
      return { name, isComplete: false, data: null, errors: [String(error)] };
    }
    let data: unknown = result.stdout;
    const errors = result.exitCode === 0 ? [] : [`${args[0]} exited ${result.exitCode}: ${result.stderr.trim()}`];
    try {
      if (format === 'json' && result.stdout.trim()) {
        data = JSON.parse(result.stdout);
      }
    } catch (error) {
      errors.push(`Could not parse output: ${String(error)}`);
    }
    return {
      name,
      isComplete: errors.length === 0,
      data,
      errors,
    };
  }
  const scans = new Map<string, Promise<AssessmentScan>>();
  const activeScans = new Map<string, AssessmentScanProgress>();
  const roots = [...new Set([root, ...systemRoots])];
  const devices = new Map(
    await Promise.all(
      roots.map(async (path) => {
        try {
          return [path, (await lstat(path)).dev] as const;
        } catch {
          return [path, null] as const;
        }
      }),
    ),
  );
  // Coalesce overlapping scopes only on the same filesystem. Explicit mount roots stay independent.
  for (const path of [...roots].sort((a, b) => a.length - b.length)) {
    if (![...scans.keys()].some((scope) => isWithin(scope, path) && devices.get(scope) === devices.get(path))) {
      const reportRoot = path === root || isWithin(path, root) ? root : path;
      activeScans.set(path, { root: path, path, entries: 0 });
      scans.set(
        path,
        scan(path, minimumBytes, days, undefined, reportRoot, (value, entry) => {
          activeScans.set(path, value);
          if (entry) report({ type: 'largePath', root: path, entry });
        }).finally(() => activeScans.delete(path)),
      );
    }
  }
  async function forRoot(path: string): Promise<AssessmentScan> {
    const scope = [...scans.keys()].find(
      (candidate) => candidate === path || (isWithin(candidate, path) && devices.get(candidate) === devices.get(path)),
    );
    const pending = scope && scans.get(scope);
    if (!pending) throw new Error(`Missing scan for ${path}`);
    const data = await pending;
    return {
      ...data,
      inventory: {
        ...data.inventory,
        errors: data.inventory.errors.filter(
          (error) => error.repository === path || isWithin(path, error.repository) || isWithin(error.repository, path),
        ),
      },
    };
  }
  async function scanned(name: string, select: (data: AssessmentScan) => unknown): Promise<AssessmentSection> {
    const data = await forRoot(root);
    const errors = data.inventory.errors.map((error) => `${error.repository}: ${error.message}`);
    return { name, isComplete: errors.length === 0, data: select(data), errors };
  }
  async function measure(path: string): Promise<number> {
    const data = await forRoot(root);
    const bytes = data.allocations.get(path);
    if (bytes === null || bytes === undefined) throw new Error(`Allocation unavailable: ${path}`);
    return bytes;
  }
  const tasks: AssessmentTask[] = [
    { name: 'filesystem', inspect: () => command('filesystem', ['df', '-B1', '--', root], 'text') },
    {
      name: 'overview',
      inspect: () => scanned('overview', (data) => data.overview),
    },
    {
      name: 'largePaths',
      inspect: () =>
        scanned('largePaths', (data) =>
          data.largePaths.filter((entry) => entry.path === root || isWithin(root, entry.path)),
        ),
    },
    {
      name: 'dependencies',
      inspect: async () => {
        const data = await forRoot(root);
        const errors = [...data.inventory.errors];
        const dependencies = await inspectDependencies(
          root,
          days,
          (error) => errors.push(error),
          { ...data.inventory, errors: [] },
          measure,
        );
        return {
          name: 'dependencies',
          isComplete: errors.length === 0,
          data: { root, days, dependencies, errors },
          errors: errors.map((error) => `${error.repository}: ${error.message}`),
        };
      },
    },
    {
      name: 'worktrees',
      inspect: async () => {
        const data = await forRoot(root);
        const report = await inspectWorktrees(root, data.inventory, measure);
        return {
          name: 'worktrees',
          isComplete: report.errors.length === 0,
          data: { root, ...report },
          errors: report.errors.map((error) => `${error.repository}: ${error.message}`),
        };
      },
    },
    {
      name: 'staleFolders',
      inspect: () =>
        scanned('staleFolders', (data) => ({
          root,
          size: `${minimumBytes}B`,
          days,
          time: 'either',
          folders: data.staleFolders,
          errors: data.inventory.errors.map((error) => `${error.repository}: ${error.message}`),
        })),
    },
    {
      name: 'docker',
      inspect: async () => {
        const context = await command('context', ['docker', 'context', 'show'], 'text');
        if (!context.isComplete || typeof context.data !== 'string') {
          return { name: 'docker', isComplete: false, data: [context], errors: context.errors };
        }
        const contextName = context.data.trim();
        const docker = ['docker', '--context', contextName];
        const details = await Promise.all([
          command('endpoint', ['docker', 'context', 'inspect', contextName], 'json'),
          command('dataRoot', [...docker, 'info', '--format', '{{.DockerRootDir}}'], 'text'),
          command('usage', [...docker, 'system', 'df'], 'text'),
          command('details', [...docker, 'system', 'df', '-v'], 'text'),
          command('containers', [...docker, 'ps', '-a', '--no-trunc'], 'text'),
          command('containerIds', [...docker, 'ps', '-aq'], 'text'),
        ]);
        const ids = details.at(-1);
        if (ids?.isComplete && typeof ids.data === 'string' && ids.data.trim()) {
          details.push(
            await command(
              'mounts',
              [...docker, 'container', 'inspect', '--format', '{{json .Mounts}}', ...ids.data.trim().split('\n')],
              'text',
            ),
          );
        }
        const sections = [context, ...details];
        return {
          name: 'docker',
          isComplete: sections.every((section) => section.isComplete),
          data: sections,
          errors: sections.flatMap((section) => section.errors),
        };
      },
    },
  ];
  for (const path of new Set(systemRoots)) {
    tasks.push({
      name: `system:${path}`,
      inspect: async () => {
        const data = await forRoot(path);
        const errors = data.inventory.errors.map((error) => `${error.repository}: ${error.message}`);
        return {
          name: `system:${path}`,
          isComplete: errors.length === 0,
          data: data.largePaths.filter((entry) => entry.path === path || isWithin(path, entry.path)),
          errors,
        };
      },
    });
  }
  const pending = new Set(tasks.map((task) => task.name));
  const heartbeat = setInterval(() => {
    report({ type: 'progress', pending: [...pending], scans: [...activeScans.values()] });
  }, 5000);
  let sections: AssessmentSection[];
  try {
    sections = await Promise.all(
      tasks.map(async (task): Promise<AssessmentSection> => {
        let section: AssessmentSection;
        try {
          section = await task.inspect();
        } catch (error) {
          section = { name: task.name, isComplete: false, data: null, errors: [String(error)] };
        }
        pending.delete(task.name);
        report({ type: 'section', section });
        return section;
      }),
    );
  } finally {
    clearInterval(heartbeat);
  }
  const isComplete = sections.every((section) => section.isComplete);
  report({
    type: 'complete',
    isComplete,
    failed: sections.filter((section) => !section.isComplete).map((s) => s.name),
  });
  return {
    root,
    isComplete,
    sections,
    scope,
  };
}
