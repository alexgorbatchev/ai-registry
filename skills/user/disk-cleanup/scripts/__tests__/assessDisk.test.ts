import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { assessDisk } from '../assessDisk';
import { scanAssessment } from '../scanAssessment';
import { renderAssessment } from '../renderAssessment';
import type { AssessmentEvent } from '../types';
import { cli, createRoot, disposeRoot } from './helpers';

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
      if (event.type === 'section' && event.section.name === 'filesystem') capacity.resolve();
    },
  ).then((report) => {
    finished = true;
    return report;
  });
  try {
    await Promise.all([entered.promise, capacity.promise]);
    expect(finished).toBe(false);
    expect(events[0]).toMatchObject({ type: 'start', root, scope: { roots: [root] } });
    expect(events.filter((event) => event.type === 'section').map(renderAssessment)).toEqual([
      'filesystem: complete\ncapacity available',
      "docker: INCOMPLETE\n[ { name: 'context', isComplete: false, data: null, errors: [ 'Error: Docker unavailable' ] } ]\nError: Error: Docker unavailable",
    ]);
    await Bun.sleep(5100);
    expect(finished).toBe(false);
    expect(events.filter((event) => event.type === 'progress')).toEqual([
      {
        type: 'progress',
        pending: ['overview', 'largePaths', 'dependencies', 'worktrees', 'staleFolders'],
        scans: [{ root, path: root, entries: 1 }],
      },
    ]);
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
      { name: 'filesystem', isComplete: true, data: 'capacity', errors: [] },
      { name: 'overview', isComplete: false, data: null, errors: ['Error: unreadable root'] },
    ]),
  );
  expect(events.at(-1)).toEqual({
    type: 'complete',
    isComplete: false,
    failed: ['overview', 'largePaths', 'dependencies', 'worktrees', 'staleFolders', 'docker'],
  });
});

test('streams discovered allocations before the remaining subtree finishes', async () => {
  const file = join(root, 'a-data');
  const held = join(root, 'z-held');
  await Bun.write(file, Buffer.alloc(8192));
  await mkdir(held);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const events: AssessmentEvent[] = [];
  const assessment = assessDisk(
    root,
    8192,
    30,
    async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    [],
    async (...args) =>
      scanAssessment(
        args[0],
        args[1],
        args[2],
        async (path) => {
          if (path === held) {
            entered.resolve();
            await release.promise;
          }
          return (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
        },
        args[4],
        args[5],
      ),
    (event) => events.push(event),
  );
  try {
    await entered.promise;
    expect(events.filter((event) => event.type === 'largePath')).toEqual([
      { type: 'largePath', root, entry: { path: file, bytes: 8192 } },
    ]);
    expect(events.filter((event) => event.type === 'largePath').map(renderAssessment)).toEqual([
      `Found 8.00 KB\t'${file}'`,
    ]);
    expect(events.filter((event) => event.type === 'complete')).toEqual([]);
  } finally {
    release.resolve();
    await assessment;
  }
  expect(events.at(-1)).toEqual({ type: 'complete', isComplete: true, failed: [] });
});

test.each(['1', ''])(
  'assessment stdout is readable in agent=%s with explicit completion and no scan writes',
  async (agent) => {
    const result = cli(root, ['disk', 'assess', '--root', root], agent);
    expect(result.stdout.split('\n')[0]).toBe(`Assessing '${root}'`);
    expect(
      result.stdout
        .split('\n')
        .filter((line) => /^(filesystem|overview|largePaths|dependencies|worktrees|staleFolders|docker): /.test(line))
        .sort(),
    ).toEqual([
      'dependencies: complete',
      expect.stringMatching(/^docker: (complete|INCOMPLETE)$/),
      'filesystem: complete',
      'largePaths: complete',
      'overview: complete',
      'staleFolders: complete',
      'worktrees: complete',
    ]);
    expect(result.stdout.trimEnd().split('\n').at(-1)).toEqual(
      expect.stringMatching(
        /^Assessment (complete\. All sections finished successfully\.|INCOMPLETE\. Failed sections: docker\. Successful results are shown above\.)$/,
      ),
    );
    expect(await readdir(root)).toEqual([]);
  },
);
