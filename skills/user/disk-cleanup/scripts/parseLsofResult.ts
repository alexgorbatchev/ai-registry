import { isAbsolute } from 'node:path';
import { isWithin } from './filesystemUtils';
import type { ProcessInspection } from './types';

export function parseLsofResult(project: string, stdout: string, stderr: string, code: number): ProcessInspection {
  const warnings: string[] = [];
  const lines = stderr.trimEnd().split('\n');
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line && lines.length === 1) break;
    const mount = /^lsof: WARNING: can't stat\(\) \S+ file system (\/.*)$/.exec(line ?? '')?.[1];
    if (
      !mount ||
      !isAbsolute(mount) ||
      mount.includes('\\') ||
      mount === project ||
      isWithin(project, mount) ||
      isWithin(mount, project) ||
      lines[index + 1]?.trim() !== 'Output information may be incomplete.'
    ) {
      throw new Error(`Process inspection is incomplete: ${stderr.trim()}`);
    }
    const warning = [line, lines[index + 1]];
    index += 2;
    // lsof adds this line when it takes the unreadable mount's device number from the mount table.
    if (/^\s+assuming "dev=[0-9a-f]+" from mount table$/i.test(lines[index] ?? '')) {
      warning.push(lines[index]);
      index += 1;
    }
    warnings.push(warning.join('\n'));
  }
  // Older macOS lsof emits descriptor fields even when only PID fields are requested.
  const records = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((line) => !/^f(?:\d+|cwd|rtd|txt|mem|DEL)$/.test(line));
  if (
    (code !== 0 && code !== 1) ||
    (code === 0 && records.length === 0) ||
    records.some((line) => !/^p[1-9]\d*$/.test(line))
  ) {
    throw new Error(`Unexpected lsof result (${code}): ${stdout.trim()}`);
  }
  return { pids: [...new Set(records.map((line) => Number(line.slice(1))))], warnings };
}
