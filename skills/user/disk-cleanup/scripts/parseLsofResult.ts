import { isAbsolute } from 'node:path';
import { isWithin } from './filesystemUtils';
import type { ProcessInspection } from './types';

export function parseLsofResult(project: string, stdout: string, stderr: string, code: number): ProcessInspection {
  const warnings: string[] = [];
  const lines = stderr.trimEnd().split('\n');
  for (let index = 0; index < lines.length; index += 2) {
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
    warnings.push(`${line}\n${lines[index + 1]}`);
  }
  const records = stdout.trim().split('\n').filter(Boolean);
  if (
    (code !== 0 && code !== 1) ||
    (code === 0 && records.length === 0) ||
    records.some((line) => !/^p[1-9]\d*$/.test(line))
  ) {
    throw new Error(`Unexpected lsof result (${code}): ${stdout.trim()}`);
  }
  return { pids: [...new Set(records.map((line) => Number(line.slice(1))))], warnings };
}
