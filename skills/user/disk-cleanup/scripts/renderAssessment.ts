import { isAbsolute, relative } from 'node:path';
import { isWithin } from './filesystemUtils';
import type { AssessmentEvent, AssessmentSection, InspectionError } from './types';

const units = ['B', 'K', 'M', 'G', 'T', 'P'];

export function shortBytes(bytes: number | null): string {
  if (bytes === null) return '?';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)}${units[unit]}`;
}

function quote(path: string): string {
  // Paths are always the last column, so only control characters need escaping.
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point.
  return /[\u0000-\u001f\u007f]/.test(path) ? JSON.stringify(path) : path;
}

function display(base: string | null, path: string): string {
  if (path === base) return '.';
  return quote(base !== null && isWithin(base, path) ? relative(base, path) : path);
}

// Space-padded CLI tables (df, docker) cost tokens per space; a tab keeps the columns.
function table(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => line.trimEnd().replace(/ {2,}/g, '\t'))
    .filter(Boolean)
    .join('\n');
}

function day(seconds: number | null): string {
  return seconds === null ? '?' : new Date(seconds * 1000).toISOString().slice(0, 10);
}

function message(text: string): string {
  return text
    .replace(/^(Error: )+/, '')
    .replace(/^git failed \((\d+)\): (fatal: )?/, 'git $1: ')
    .trim();
}

/**
 * Renders assessment events as compact text for agents: sizes like `1.2G`, paths relative to the
 * section root, and each error or restricted path printed once across all sections.
 */
export function createAssessmentRenderer(): (event: AssessmentEvent) => string {
  const printed = new Set<string>();
  let restrictedCount = 0;
  let minimum = 0;
  function errorLines(base: string | null, errors: InspectionError[]): string[] {
    const lines: string[] = [];
    let repeated = 0;
    for (const error of errors) {
      const key = `${error.repository}\0${error.message}`;
      if (printed.has(key)) repeated += 1;
      else {
        printed.add(key);
        const source = isAbsolute(error.repository) ? display(base, error.repository) : error.repository;
        const where = source ? `${source}: ` : '';
        lines.push(`${where}${message(error.message)}`);
      }
    }
    if (lines.length === 0 && repeated === 0) return [];
    return [`## errors${repeated ? ` (+${repeated} listed above)` : ''}`, ...lines];
  }
  function heading(section: AssessmentSection, detail: string): string {
    return `# ${section.name}${detail ? ` ${detail}` : ''}${section.isComplete ? '' : ' INCOMPLETE'}`;
  }
  function body(section: AssessmentSection): string[] {
    switch (section.kind) {
      case 'failed':
        return [heading(section, '')];
      case 'disk':
        return [heading(section, ''), ...(section.data?.trim() ? [table(section.data)] : [])];
      case 'paths': {
        const fresh = section.restricted.filter((path) => !printed.has(`restricted\0${path}`));
        for (const path of fresh) printed.add(`restricted\0${path}`);
        restrictedCount += fresh.length;
        return [
          heading(section, '(size path)'),
          ...section.data.map((entry) => `${shortBytes(entry.bytes)} ${display(section.root, entry.path)}`),
          ...(fresh.length ? ['## restricted (permission denied; not scanned)'] : []),
          ...fresh.map((path) => display(section.root, path)),
        ];
      }
      case 'stale':
        return [
          heading(section, `(size modifiedDaysAgo accessedDaysAgo path)`),
          ...section.data.map(
            (entry) =>
              `${shortBytes(entry.bytes)} ${entry.daysSinceModified < 0 ? '?' : entry.daysSinceModified} ${
                entry.daysSinceAccessed < 0 ? '?' : entry.daysSinceAccessed
              } ${display(section.root, entry.path)}`,
          ),
        ];
      case 'dependencies': {
        const listed = Math.max(1, Math.floor(minimum / 10));
        const failed = new Set(section.errors.map((error) => error.repository));
        const groups = new Map<string, typeof section.data>();
        for (const entry of section.data) {
          const key = failed.has(entry.path)
            ? 'failed (see errors)'
            : `${entry.eligible ? 'eligible' : 'preserved'}: ${entry.reason}`;
          groups.set(key, [...(groups.get(key) ?? []), entry]);
        }
        const eligible = section.data.filter((entry) => entry.eligible);
        const lines = [
          heading(
            section,
            `found=${section.data.length} eligible=${eligible.length} eligibleSize=${shortBytes(
              eligible.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
            )} (size lastGitActivity path; rows under ${shortBytes(listed)} summarized)`,
          ),
        ];
        for (const [key, entries] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
          const shown = entries.filter((entry) => entry.bytes === null || entry.bytes >= listed);
          const hidden = entries.length - shown.length;
          const total = entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
          lines.push(`## ${key} n=${entries.length} size=${shortBytes(total)}`);
          lines.push(
            ...shown.map(
              (entry) => `${shortBytes(entry.bytes)} ${day(entry.latestActivity)} ${display(section.root, entry.path)}`,
            ),
          );
          if (hidden) {
            const hiddenBytes = entries
              .filter((entry) => !shown.includes(entry))
              .reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
            lines.push(`+${hidden} smaller (${shortBytes(hiddenBytes)})`);
          }
        }
        return lines;
      }
      case 'worktrees': {
        const { worktrees, invalidRepositories } = section.data;
        const lines = [heading(section, '(size registered branch|@head changed ignored flags path)')];
        for (const entry of worktrees) {
          const registered = entry.isRegistered === null ? '?' : entry.isRegistered ? 'reg' : 'unreg';
          const branch =
            entry.branch?.replace(/^refs\/heads\//, '') ?? (entry.head ? `@${entry.head.slice(0, 10)}` : '-');
          const count = (value: number | null) => (value === null ? '?' : String(value));
          const flags = [entry.isLocked && 'locked', entry.isPrunable && 'prunable'].filter(Boolean).join(',') || '-';
          lines.push(
            `${shortBytes(entry.bytes)} ${registered} ${branch} ${count(entry.changedEntries)} ${count(
              entry.ignoredEntries,
            )} ${flags} ${display(section.root, entry.path)}`,
          );
        }
        if (invalidRepositories.length) {
          lines.push('## invalid Git metadata (not inspected as repositories)');
          lines.push(
            ...invalidRepositories.map((entry) => `${display(section.root, entry.path)}: ${message(entry.reason)}`),
          );
        }
        return lines;
      }
      case 'docker': {
        const value = (name: string) =>
          section.data
            .find((result) => result.name === name)
            ?.output?.trim()
            .replace(/\s+/g, ' ');
        const context = value('context');
        const lines = [
          heading(
            section,
            context ? `context=${context} host=${value('endpoint') ?? '?'} root=${value('dataRoot') ?? '?'}` : '',
          ),
        ];
        for (const result of section.data) {
          if (['context', 'endpoint', 'dataRoot', 'containerIds'].includes(result.name)) continue;
          const output = result.output?.trim() && table(result.output);
          if (output) lines.push(`## ${result.name}`, output);
        }
        return lines;
      }
    }
  }
  return (event) => {
    switch (event.type) {
      case 'start':
        minimum = event.minimumBytes;
        return [
          `assess root=${quote(event.root)} size>=${shortBytes(event.minimumBytes)} days=${event.days}`,
          ...event.systemRoots.map((path) => `system root=${quote(path)}`),
          'Allocations overlap: never sum rows. Excluded: nested filesystems, symlink targets, other users outside roots, restricted paths (listed). Docker context may be remote.',
        ].join('\n');
      case 'progress':
        return `.. pending=${event.pending.join(',')} ${event.scans
          .map((scan) => `${quote(scan.root)}=${scan.entries}`)
          .join(' ')}`.trimEnd();
      case 'section': {
        const base = 'root' in event.section ? event.section.root : null;
        return [...body(event.section), ...errorLines(base, event.section.errors)].join('\n');
      }
      case 'complete': {
        const restricted = restrictedCount ? `; ${restrictedCount} restricted paths excluded` : '';
        return event.isComplete
          ? `assessment complete${restricted}`
          : `assessment INCOMPLETE: ${event.failed.join(', ')}${restricted}`;
      }
    }
  };
}
