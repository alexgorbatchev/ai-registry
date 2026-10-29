import type { InspectionRunner, DiskInspection, DiskUsage } from './types';
import { runInspectionCommand } from './runInspectionCommand';

export function parseUsage(output: string): DiskUsage[] {
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf('\t');
      const bytes = Number(record.slice(0, separator));
      if (separator < 1 || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid du record');
      return { bytes, path: record.slice(separator + 1) };
    })
    .sort((left, right) => right.bytes - left.bytes);
}

export async function inspectDisk(
  root: string,
  depth: number,
  runner: InspectionRunner = runInspectionCommand,
): Promise<DiskInspection> {
  const errors: string[] = [];
  async function inspect(args: string[]): Promise<string> {
    try {
      const result = await runner(args);
      if (result.exitCode !== 0) errors.push(`${args[0]} exited ${result.exitCode}: ${result.stderr.trim()}`);
      return result.stdout;
    } catch (error) {
      errors.push(String(error));
      return '';
    }
  }
  const [filesystem, usage] = await Promise.all([
    inspect(['df', '-B1', '--', root]),
    inspect(['du', '-x', '-B1', '--null', `--max-depth=${depth}`, '--', root]),
  ]);
  let folders: DiskUsage[] = [];
  try {
    folders = parseUsage(usage);
  } catch (error) {
    errors.push(String(error));
  }
  return { root, filesystem, folders, errors, isComplete: errors.length === 0 };
}
