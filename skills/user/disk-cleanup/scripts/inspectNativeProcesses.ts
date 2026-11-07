import { isAbsolute } from 'node:path';
import { isWithin } from './filesystemUtils';
import { parseLsofResult } from './parseLsofResult';
import type { InspectionRunner } from './types';
import type { NativeProcesses } from './nativeTypes';

function normalize(path: string): string {
  return process.platform === 'darwin' && path.startsWith('/var/') ? `/private${path}` : path;
}

export async function inspectNativeProcesses(
  paths: string[],
  runner: InspectionRunner,
  inodes: ReadonlyMap<string, readonly string[]>,
): Promise<NativeProcesses> {
  const result = await runner(['lsof', '-nP', '-F0pfnDi']);
  const names: string[] = [];
  const pids: string[] = [];
  const openInodes = new Set<string>();
  let hasFile = false;
  let device: string | undefined;
  let inode: string | undefined;
  function finishFile(): void {
    if (device !== undefined && inode !== undefined) openInodes.add(`${device}:${inode}`);
    device = undefined;
    inode = undefined;
    hasFile = false;
  }
  for (const record of result.stdout.split('\0')) {
    const field = record.replace(/^\n/, '');
    if (!field) continue;
    if (!/^(?:p[1-9]\d*|f[^\n]+|n[^\0]*|D0x[\da-fA-F]+|i\d+)$/.test(field))
      throw new Error('Malformed global lsof output');
    if (field.startsWith('p')) {
      finishFile();
      pids.push(field);
      continue;
    }
    if (!pids.length) throw new Error('Malformed global lsof output');
    if (field.startsWith('f')) {
      finishFile();
      hasFile = true;
      continue;
    }
    if (!hasFile) throw new Error('Malformed global lsof output');
    if (field.startsWith('D')) {
      if (device !== undefined) throw new Error('Malformed global lsof output');
      device = BigInt(field.slice(1)).toString();
    } else if (field.startsWith('i')) {
      if (inode !== undefined) throw new Error('Malformed global lsof output');
      inode = BigInt(field.slice(1)).toString();
    } else if (field.startsWith('n') && isAbsolute(field.slice(1))) {
      names.push(normalize(field.slice(1)));
      // lsof escapes nonprintable bytes even in NUL mode. Keep both interpretations:
      // a literal escape in a filename may be ambiguous, so over-preserve it.
      const decoded = field
        .slice(1)
        .replace(
          /\\x([0-9a-fA-F]{2})|\\([bfrnt])|\^([@-_?])/g,
          (_match, hex: string | undefined, control: string | undefined, caret: string | undefined) => {
            if (hex) return String.fromCharCode(Number.parseInt(hex, 16));
            if (caret) return String.fromCharCode(caret === '?' ? 127 : caret.charCodeAt(0) - 64);
            const escapes: Record<string, string> = { b: '\b', f: '\f', r: '\r', n: '\n', t: '\t' };
            return escapes[control ?? ''] ?? '';
          },
        );
      names.push(normalize(Buffer.from(decoded, 'latin1').toString('utf8')));
    }
  }
  finishFile();
  const warnings = new Set<string>();
  for (const path of paths) {
    const inspection = parseLsofResult(path, pids.join('\n'), result.stderr, result.exitCode);
    if (process.platform === 'darwin' && path.startsWith('/private/var/')) {
      parseLsofResult(path.slice('/private'.length), pids.join('\n'), result.stderr, result.exitCode);
    }
    for (const warning of inspection.warnings) warnings.add(warning);
  }
  if (result.exitCode !== 0 || pids.length === 0 || names.length === 0)
    throw new Error('Global process inspection is incomplete');
  return {
    active: paths.filter(
      (path) =>
        names.some((name) => name === path || isWithin(path, name)) ||
        inodes.get(path)?.some((key) => openInodes.has(key)),
    ),
    warnings: [...warnings],
  };
}
