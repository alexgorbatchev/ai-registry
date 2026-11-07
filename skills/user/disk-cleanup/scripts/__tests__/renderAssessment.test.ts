import { expect, test } from 'bun:test';
import { createAssessmentRenderer, shortBytes } from '../renderAssessment';
import type { Dependency } from '../types';

const G = 1024 ** 3;

test('sizes use one compact unit with a decimal only below ten', () => {
  expect([0, 1023, 1024, 1536, 10 * 1024 ** 2, 329.26 * G, null].map(shortBytes)).toEqual([
    '0B',
    '1023B',
    '1.0K',
    '1.5K',
    '10M',
    '329G',
    '?',
  ]);
});

test('path sections print root-relative rows and each restricted path and error only once', () => {
  const render = createAssessmentRenderer();
  render({ type: 'start', root: '/scan', minimumBytes: G, days: 30, systemRoots: [] });
  const section = {
    name: 'large',
    kind: 'paths' as const,
    root: '/scan',
    isComplete: false,
    data: [
      { bytes: 2 * G, path: '/scan' },
      { bytes: G, path: '/scan/a\nb' },
    ],
    restricted: ['/scan/locked'],
    errors: [{ repository: '/scan/gone', message: 'Error: ENOENT: entry disappeared' }],
  };
  expect(render({ type: 'section', section })).toBe(
    [
      '# large (size path) INCOMPLETE',
      '2.0G .',
      '1.0G "a\\nb"',
      '## restricted (permission denied; not scanned)',
      'locked',
      '## errors',
      'gone: ENOENT: entry disappeared',
    ].join('\n'),
  );
  expect(render({ type: 'section', section: { ...section, name: 'stale', kind: 'stale', data: [] } })).toBe(
    '# stale (size modifiedDaysAgo accessedDaysAgo path) INCOMPLETE\n## errors (+1 listed above)',
  );
  expect(render({ type: 'complete', isComplete: false, failed: ['large', 'stale'] })).toBe(
    'assessment INCOMPLETE: large, stale; 1 restricted paths excluded',
  );
});

test('dependencies group by decision and summarize rows below a tenth of the size threshold', () => {
  const render = createAssessmentRenderer();
  render({ type: 'start', root: '/scan', minimumBytes: G, days: 30, systemRoots: ['/tmp'] });
  const dependency = (path: string, bytes: number | null, eligible: boolean, reason: string): Dependency => ({
    path: `/scan/${path}`,
    repository: '/scan',
    isSymlink: false,
    bytes,
    latestActivity: 1_700_000_000,
    eligible,
    reason,
  });
  expect(
    render({
      type: 'section',
      section: {
        name: 'deps',
        kind: 'dependencies',
        root: '/scan',
        days: 30,
        isComplete: false,
        data: [
          dependency('old/node_modules', 2 * G, true, 'no Git activity within 30 days'),
          dependency('tiny/node_modules', 1024, true, 'no Git activity within 30 days'),
          dependency('home/node_modules', null, false, 'invalid Git metadata'),
          dependency('broken/node_modules', null, false, 'Error: boom'),
        ],
        errors: [{ repository: '/scan/broken/node_modules', message: 'Error: boom' }],
      },
    }),
  ).toBe(
    [
      '# deps found=4 eligible=2 eligibleSize=2.0G (size lastGitActivity path; rows under 102M summarized) INCOMPLETE',
      '## eligible: no Git activity within 30 days n=2 size=2.0G',
      '2.0G 2023-11-14 old/node_modules',
      '+1 smaller (1.0K)',
      '## failed (see errors) n=1 size=0B',
      '? 2023-11-14 broken/node_modules',
      '## preserved: invalid Git metadata n=1 size=0B',
      '? 2023-11-14 home/node_modules',
      '## errors',
      'broken/node_modules: boom',
    ].join('\n'),
  );
});

test('worktrees print one row each and list invalid Git metadata separately', () => {
  const render = createAssessmentRenderer();
  expect(
    render({
      type: 'section',
      section: {
        name: 'worktrees',
        kind: 'worktrees',
        root: '/scan',
        isComplete: true,
        data: {
          worktrees: [
            {
              path: '/scan/repo/.workspaces/a',
              repository: '/scan/repo',
              head: 'abcdef0123456789',
              branch: 'refs/heads/feature/a',
              isLocked: true,
              isPrunable: false,
              isRegistered: true,
              bytes: G,
              changedEntries: 2,
              ignoredEntries: 0,
            },
            {
              path: '/scan/other/.workspaces/b',
              repository: '/scan/other',
              head: null,
              branch: null,
              isLocked: false,
              isPrunable: false,
              isRegistered: null,
              bytes: null,
              changedEntries: null,
              ignoredEntries: null,
            },
          ],
          invalidRepositories: [{ path: '/scan/other', reason: 'invalid gitfile format: /scan/other/.git' }],
          errors: [],
        },
        errors: [],
      },
    }),
  ).toBe(
    [
      '# worktrees (size registered branch|@head changed ignored flags path)',
      '1.0G reg feature/a 2 0 locked repo/.workspaces/a',
      '? ? - ? ? - other/.workspaces/b',
      '## invalid Git metadata (not inspected as repositories)',
      'other: invalid gitfile format: /scan/other/.git',
    ].join('\n'),
  );
});

test('command tables collapse padding and the start, heartbeat, and final lines stay one-liners', () => {
  const render = createAssessmentRenderer();
  expect(render({ type: 'start', root: '/scan', minimumBytes: G, days: 30, systemRoots: ['/Library'] })).toBe(
    [
      'assess root=/scan size>=1.0G days=30',
      'system root=/Library',
      'Allocations overlap: never sum rows. Excluded: nested filesystems, symlink targets, other users outside roots, restricted paths (listed). Docker context may be remote.',
    ].join('\n'),
  );
  expect(
    render({
      type: 'section',
      section: {
        name: 'docker',
        kind: 'docker',
        isComplete: true,
        data: [
          { name: 'context', isComplete: true, output: 'default\n', errors: [] },
          { name: 'endpoint', isComplete: true, output: 'unix:///var/run/docker.sock\n', errors: [] },
          { name: 'dataRoot', isComplete: true, output: '/var/lib/docker\n', errors: [] },
          { name: 'usage', isComplete: true, output: 'TYPE      TOTAL\n\nImages    3\n', errors: [] },
        ],
        errors: [],
      },
    }),
  ).toBe(
    '# docker context=default host=unix:///var/run/docker.sock root=/var/lib/docker\n## usage\nTYPE\tTOTAL\nImages\t3',
  );
  expect(render({ type: 'progress', pending: ['deps', 'worktrees'], scans: [{ root: '/scan', entries: 123 }] })).toBe(
    '.. pending=deps,worktrees /scan=123',
  );
  expect(render({ type: 'complete', isComplete: true, failed: [] })).toBe('assessment complete');
});
