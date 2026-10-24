import { InvalidArgumentError } from 'commander';
import type { RustArtifactKind } from './types';

export function parseIdleDuration(value: string): number {
  const match = /^([1-9]\d*)([mhd])$/.exec(value);
  const unit = match?.[2];
  const duration = Number(match?.[1]) * (unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000);
  if (!match || !Number.isSafeInteger(duration)) {
    throw new InvalidArgumentError('Use a positive whole number followed by m, h, or d');
  }
  return duration;
}

export function parseRustArtifacts(value: string): RustArtifactKind[] {
  const kinds: RustArtifactKind[] = [];
  for (const kind of value.split(',')) {
    if (kind !== 'tmp' && kind !== 'coverage' && kind !== 'target') {
      throw new InvalidArgumentError('Choose comma-separated artifacts: tmp, coverage, target');
    }
    if (kinds.includes(kind)) throw new InvalidArgumentError(`Duplicate artifact scope: ${kind}`);
    kinds.push(kind);
  }
  return kinds;
}
