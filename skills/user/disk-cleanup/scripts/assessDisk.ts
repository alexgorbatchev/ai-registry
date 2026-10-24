import { join } from 'node:path';
import type { AssessmentSection, AssessmentTask, DiskAssessment, InspectionRunner } from './types';

export async function assessDisk(
  root: string,
  minimumBytes: number,
  days: number,
  runCommand: InspectionRunner,
): Promise<DiskAssessment> {
  async function command(name: string, args: string[], format: 'text' | 'usage' | 'json'): Promise<AssessmentSection> {
    let result;
    try {
      result = await runCommand(args);
    } catch (error) {
      return { name, isComplete: false, data: null, errors: [String(error)] };
    }
    let data: unknown = result.stdout;
    const errors = result.exitCode === 0 ? [] : [`${args[0]} exited ${result.exitCode}: ${result.stderr.trim()}`];
    try {
      if (format === 'usage') {
        data = result.stdout
          .split('\0')
          .filter(Boolean)
          .map((record) => {
            const separator = record.indexOf('\t');
            const bytes = Number(record.slice(0, separator));
            if (separator < 1 || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid du record');
            return { bytes, path: record.slice(separator + 1) };
          })
          .sort((left, right) => right.bytes - left.bytes);
      } else if (format === 'json' && result.stdout.trim()) {
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
  function bundled(name: string, args: string[]): AssessmentTask {
    return {
      name,
      inspect: () =>
        command(name, [process.execPath, join(import.meta.dir, 'cleanup.ts'), ...args, '--root', root], 'json'),
    };
  }
  const tasks: AssessmentTask[] = [
    { name: 'filesystem', inspect: () => command('filesystem', ['df', '-B1', '--', root], 'text') },
    {
      name: 'overview',
      inspect: () => command('overview', ['du', '-x', '-B1', '--null', '--max-depth=3', '--', root], 'usage'),
    },
    {
      name: 'largePaths',
      inspect: () =>
        command('largePaths', ['du', '-a', '-x', '-B1', '--null', `--threshold=${minimumBytes}`, '--', root], 'usage'),
    },
    bundled('dependencies', ['dependencies', 'list', '--days', String(days)]),
    bundled('worktrees', ['worktrees', 'list']),
    bundled('staleFolders', ['folders', 'list', '--size', `${minimumBytes}B`, '--days', String(days)]),
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
  const sections = await Promise.all(
    tasks.map(async (task): Promise<AssessmentSection> => {
      try {
        return await task.inspect();
      } catch (error) {
        return { name: task.name, isComplete: false, data: null, errors: [String(error)] };
      }
    }),
  );
  return { root, isComplete: sections.every((section) => section.isComplete), sections };
}
