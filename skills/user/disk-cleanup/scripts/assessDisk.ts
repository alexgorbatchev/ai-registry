import { lstat } from 'node:fs/promises';
import { isWithin, repositoryChecker } from './filesystemUtils';
import { inspectDependencies } from './inventory';
import { inspectWorktrees } from './inspectWorktrees';
import { scanAssessment } from './scanAssessment';
import type { AssessmentScan } from './scanAssessment';
import type {
  AssessmentReporter,
  AssessmentScanProgress,
  AssessmentSection,
  AssessmentTask,
  CommandOutput,
  DiskAssessment,
  InspectionRunner,
} from './types';

function inside(scope: string, path: string): boolean {
  return path === scope || isWithin(scope, path);
}

export async function assessDisk(
  root: string,
  minimumBytes: number,
  days: number,
  runCommand: InspectionRunner,
  systemRoots: string[] = [],
  scan: typeof scanAssessment = scanAssessment,
  report: AssessmentReporter = () => {},
  heartbeatMs: number = 15000,
): Promise<DiskAssessment> {
  const extraRoots = [...new Set(systemRoots)];
  report({ type: 'start', root, minimumBytes, days, systemRoots: extraRoots });
  async function command(name: string, args: string[]): Promise<CommandOutput> {
    try {
      const result = await runCommand(args);
      const errors =
        result.exitCode === 0
          ? []
          : [{ repository: name, message: `${args[0]} exited ${result.exitCode}: ${result.stderr.trim()}` }];
      return { name, isComplete: errors.length === 0, output: result.stdout, errors };
    } catch (error) {
      return { name, isComplete: false, output: null, errors: [{ repository: name, message: String(error) }] };
    }
  }
  const scans = new Map<string, Promise<AssessmentScan>>();
  const activeScans = new Map<string, AssessmentScanProgress>();
  const roots = [root, ...extraRoots.filter((path) => path !== root)];
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
      const reportRoot = inside(path, root) ? root : path;
      activeScans.set(path, { root: path, entries: 0 });
      scans.set(
        path,
        scan(path, minimumBytes, days, undefined, reportRoot, (value) => activeScans.set(path, value)).finally(() =>
          activeScans.delete(path),
        ),
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
      largePaths: data.largePaths.filter((entry) => inside(path, entry.path)),
      restricted: data.restricted.filter((entry) => inside(path, entry)),
      inventory: {
        ...data.inventory,
        errors: data.inventory.errors.filter(
          (error) => inside(path, error.repository) || isWithin(error.repository, path),
        ),
      },
    };
  }
  async function measure(path: string): Promise<number> {
    const data = await forRoot(root);
    const bytes = data.allocations.get(path);
    if (bytes === null || bytes === undefined) throw new Error(`Allocation unavailable: ${path}`);
    return bytes;
  }
  // Dependencies and worktrees share one Git metadata validation per repository.
  const check = repositoryChecker();
  function paths(name: string, path: string): AssessmentTask {
    return {
      name,
      inspect: async () => {
        const data = await forRoot(path);
        const errors = data.inventory.errors;
        return {
          name,
          kind: 'paths',
          root: path,
          isComplete: errors.length === 0,
          data: data.largePaths,
          restricted: data.restricted,
          errors,
        };
      },
    };
  }
  const tasks: AssessmentTask[] = [
    {
      name: 'disk',
      inspect: async () => {
        const result = await command('df', ['df', '-h', '--', root]);
        return {
          name: 'disk',
          kind: 'disk',
          isComplete: result.isComplete,
          data: result.output,
          errors: result.errors,
        };
      },
    },
    paths('large', root),
    {
      name: 'deps',
      inspect: async () => {
        const data = await forRoot(root);
        const errors = [...data.inventory.errors];
        const dependencies = await inspectDependencies(
          root,
          days,
          (error) => errors.push(error),
          { ...data.inventory, errors: [] },
          measure,
          undefined,
          check,
        );
        return {
          name: 'deps',
          kind: 'dependencies',
          root,
          days,
          isComplete: errors.length === 0,
          data: dependencies,
          errors,
        };
      },
    },
    {
      name: 'worktrees',
      inspect: async () => {
        const data = await forRoot(root);
        const inspection = await inspectWorktrees(root, data.inventory, measure, check);
        return {
          name: 'worktrees',
          kind: 'worktrees',
          root,
          isComplete: inspection.errors.length === 0,
          data: inspection,
          errors: inspection.errors,
        };
      },
    },
    {
      name: 'stale',
      inspect: async () => {
        const data = await forRoot(root);
        const errors = data.inventory.errors;
        return { name: 'stale', kind: 'stale', root, isComplete: errors.length === 0, data: data.staleFolders, errors };
      },
    },
    {
      name: 'docker',
      inspect: async () => {
        const context = await command('context', ['docker', 'context', 'show']);
        const contextName = context.output?.trim();
        if (!context.isComplete || !contextName) {
          return { name: 'docker', kind: 'docker', isComplete: false, data: [context], errors: context.errors };
        }
        const docker = ['docker', '--context', contextName];
        const [ids, ...details] = await Promise.all([
          command('containerIds', [...docker, 'ps', '-aq']),
          command('endpoint', ['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', contextName]),
          command('dataRoot', [...docker, 'info', '--format', '{{.DockerRootDir}}']),
          command('usage', [...docker, 'system', 'df']),
          command('details', [...docker, 'system', 'df', '-v']),
        ]);
        const results = [context, ...details];
        if (!ids.isComplete) results.push(ids);
        else if (ids.output?.trim()) {
          results.push(
            await command('mounts', [
              ...docker,
              'container',
              'inspect',
              '--format',
              '{{.Name}}{{range .Mounts}} {{.Type}}:{{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}->{{.Destination}}{{if not .RW}}:ro{{end}}{{end}}',
              ...ids.output.trim().split('\n'),
            ]),
          );
        }
        return {
          name: 'docker',
          kind: 'docker',
          isComplete: results.every((result) => result.isComplete),
          data: results,
          errors: results.flatMap((result) => result.errors),
        };
      },
    },
  ];
  for (const path of extraRoots) tasks.push(paths(`system ${path}`, path));
  const pending = new Set(tasks.map((task) => task.name));
  const heartbeat = setInterval(() => {
    report({ type: 'progress', pending: [...pending], scans: [...activeScans.values()] });
  }, heartbeatMs);
  let sections: AssessmentSection[];
  try {
    sections = await Promise.all(
      tasks.map(async (task): Promise<AssessmentSection> => {
        let section: AssessmentSection;
        try {
          section = await task.inspect();
        } catch (error) {
          section = {
            name: task.name,
            kind: 'failed',
            isComplete: false,
            errors: [{ repository: '', message: String(error) }],
          };
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
    failed: sections.filter((section) => !section.isComplete).map((section) => section.name),
  });
  return { root, isComplete, sections };
}
