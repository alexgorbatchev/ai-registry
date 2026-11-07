import { inspect } from 'node:util';
import { formatBytes } from './inspectFolders';
import type { AssessmentEvent, DiskUsage } from './types';

function text(value: unknown): string {
  if (typeof value === 'string') return value.trimEnd();
  return inspect(value, {
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
    colors: false,
    customInspect: false,
    breakLength: 120,
    compact: true,
  });
}

function isUsage(value: unknown): value is DiskUsage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof value.path === 'string' &&
    'bytes' in value &&
    typeof value.bytes === 'number'
  );
}

export function renderAssessment(event: AssessmentEvent): string {
  switch (event.type) {
    case 'start':
      return `Assessing ${inspect(event.root)}\nScope: ${text(event.scope)}\nDirectory allocations overlap; do not sum them.`;
    case 'progress':
      return [
        `Still inspecting: ${event.pending.join(', ')}`,
        ...event.scans.map(
          (scan) => `Scanning ${inspect(scan.root)}: ${scan.entries} entries; current ${inspect(scan.path)}`,
        ),
      ].join('\n');
    case 'largePath':
      return `Found ${formatBytes(event.entry.bytes)}\t${inspect(event.entry.path)}`;
    case 'section': {
      const section = event.section;
      const data = section.data;
      const body =
        Array.isArray(data) && data.length > 0 && data.every(isUsage)
          ? data.map((entry) => `${formatBytes(entry.bytes)}\t${inspect(entry.path)}`).join('\n')
          : text(data);
      return [
        `${section.name}: ${section.isComplete ? 'complete' : 'INCOMPLETE'}`,
        body,
        ...section.errors.map((error) => `Error: ${error}`),
      ].join('\n');
    }
    case 'complete':
      return event.isComplete
        ? 'Assessment complete. All sections finished successfully.'
        : `Assessment INCOMPLETE. Failed sections: ${event.failed.join(', ')}. Successful results are shown above.`;
  }
}
