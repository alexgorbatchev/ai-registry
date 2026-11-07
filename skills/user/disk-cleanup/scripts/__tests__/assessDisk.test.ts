import { afterEach, beforeEach, expect, test } from 'bun:test';
import { chmod, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { assessDisk } from '../assessDisk';
import { scanAssessment } from '../scanAssessment';
import { createAssessmentRenderer } from '../renderAssessment';
import type { AssessmentEvent } from '../types';
import { cli, createRoot, disposeRoot, sectionOf } from './helpers';

let root: string;
beforeEach(async () => {
  root = await createRoot();
});
afterEach(async () => {
  await disposeRoot(root);
});

test('streams capacity and heartbeat with scan position while the filesystem traversal is pending', async () => {
  const events: AssessmentEvent[] = [];
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const capacity = Promise.withResolvers<void>();
  let finished = false;
  const assessment = assessDisk(
    root,
    1,
    30,
    async (args) => {
      if (args[0] === 'df') return { stdout: 'capacity available\n', stderr: '', exitCode: 0 };
      throw new Error('Docker unavailable');
    },
    [],
    async (...args) =>
      scanAssessment(
        args[0],
        args[1],
        args[2],
        async (path) => {
          entered.resolve();
          await release.promise;
          return readdir(path, { withFileTypes: true });
        },
        args[4],
        args[5],
      ),
    (event) => {
      events.push(event);
      if (event.type === 'section' && event.section.name === 'disk') capacity.resolve();
    },
    100,
  ).then((report) => {
    finished = true;
    return report;
  });
  try {
    await Promise.all([entered.promise, capacity.promise]);
    expect(finished).toBe(false);
    expect(events[0]).toEqual({ type: 'start', root, minimumBytes: 1, days: 30, systemRoots: [] });
    expect(events.filter((event) => event.type === 'section').map(createAssessmentRenderer())).toEqual([
      '# disk\ncapacity available',
      '# docker INCOMPLETE\n## errors\ncontext: Docker unavailable',
    ]);
    await Bun.sleep(150);
    expect(finished).toBe(false);
    expect(events.filter((event) => event.type === 'progress')[0]).toEqual({
      type: 'progress',
      pending: ['large', 'deps', 'worktrees', 'stale'],
      scans: [{ root, entries: 1 }],
    });
  } finally {
    release.resolve();
    await assessment;
  }
  expect(events.at(-1)).toEqual({ type: 'complete', isComplete: false, failed: ['docker'] });
});

test('streams scan failures as incomplete sections without hiding capacity or final status', async () => {
  const events: AssessmentEvent[] = [];
  const report = await assessDisk(
    root,
    1,
    30,
    async () => ({ stdout: 'capacity', stderr: '', exitCode: 0 }),
    [],
    async () => {
      throw new Error('unreadable root');
    },
    (event) => events.push(event),
  );
  expect(report.isComplete).toBe(false);
  expect(events.filter((event) => event.type === 'section').map((event) => event.section)).toEqual(
    expect.arrayContaining([
      { name: 'disk', kind: 'disk', isComplete: true, data: 'capacity', errors: [] },
      {
        name: 'large',
        kind: 'failed',
        isComplete: false,
        errors: [{ repository: '', message: 'Error: unreadable root' }],
      },
    ]),
  );
  expect(events.at(-1)).toEqual({
    type: 'complete',
    isComplete: false,
    failed: ['large', 'deps', 'worktrees', 'stale'],
  });
});

test('a permission-denied subtree is a listed exclusion, not a failed section', async () => {
  const denied = join(root, 'denied');
  await mkdir(denied);
  await Bun.write(join(root, 'data'), Buffer.alloc(8192));
  await chmod(denied, 0);
  try {
    const events: AssessmentEvent[] = [];
    const report = await assessDisk(
      root,
      8192,
      30,
      async (args) => {
        if (args[0] === 'df') return { stdout: 'capacity', stderr: '', exitCode: 0 };
        return { stdout: '', stderr: 'no daemon', exitCode: 1 };
      },
      [],
      undefined,
      (event) => events.push(event),
    );
    const lines = events.map(createAssessmentRenderer()).join('\n').split('\n');
    expect(lines.filter((line) => line === 'denied')).toHaveLength(1);
    expect(lines.at(-1)).toBe('assessment INCOMPLETE: docker; 1 restricted paths excluded');
    expect(sectionOf(report, 'large', 'paths')).toEqual(
      expect.objectContaining({
        isComplete: true,
        restricted: [denied],
        errors: [],
        data: expect.arrayContaining([{ path: join(root, 'data'), bytes: 8192 }]),
      }),
    );
    expect(sectionOf(report, 'stale', 'stale').isComplete).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'complete', isComplete: false, failed: ['docker'] });
  } finally {
    await chmod(denied, 0o700);
  }
});

test.each(['1', ''])(
  'assessment stdout is readable in agent=%s with explicit completion and no scan writes',
  async (agent) => {
    const result = cli(root, ['disk', 'assess', '--root', root], agent);
    expect(result.stdout.split('\n')[0]).toBe(`assess root=${root} size>=1.0G days=30`);
    expect(
      result.stdout
        .split('\n')
        .filter((line) => line.startsWith('# '))
        .map((line) => line.split(' ')[1])
        .sort(),
    ).toEqual(['deps', 'disk', 'docker', 'large', 'stale', 'worktrees']);
    expect(result.stdout.trimEnd().split('\n').at(-1)).toMatch(/^assessment (complete|INCOMPLETE: docker)$/);
    expect(await readdir(root)).toEqual([]);
  },
);
