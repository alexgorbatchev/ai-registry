import { expect, test } from 'bun:test';
import { inspectNativeProcesses } from '../inspectNativeProcesses';

test('open inode identities preserve aliases while distinguishing devices', async () => {
  expect(
    await inspectNativeProcesses(
      ['/cache/alias', '/cache/other-device'],
      async () => ({
        stdout: 'p42\0\nf3\0D0x1000012\0i99\0n/outside/alias\0\n',
        stderr: '',
        exitCode: 0,
      }),
      new Map([
        ['/cache/alias', ['16777234:99']],
        ['/cache/other-device', ['16777235:99']],
      ]),
    ),
  ).toEqual({ active: ['/cache/alias'], warnings: [] });
});

test.each([
  'p42\0\nf3\0D0x12\0n/outside/one\0\nf4\0i99\0n/outside/two\0\n',
  'p42\0\nf3\0D0x12\0n/outside/one\0\np43\0\nf3\0i99\0n/outside/two\0\n',
])('incomplete identities never combine across file or process records: %s', async (stdout) => {
  expect(
    await inspectNativeProcesses(
      ['/cache/idle'],
      async () => ({ stdout, stderr: '', exitCode: 0 }),
      new Map([['/cache/idle', ['18:99']]]),
    ),
  ).toEqual({ active: [], warnings: [] });
});

test.each([
  'p42\0D0x12\0i99\0n/outside\0',
  'p42\0\nf3\0Dwrong\0i99\0n/outside\0',
  'p42\0\nf3\0D0x12\0i99\0i100\0n/outside\0',
  'p42\0\nf3\0D0x12\0D0x13\0i99\0n/outside\0',
])('malformed inode records block cleanup: %s', async (stdout) => {
  await expect(
    inspectNativeProcesses(
      ['/cache/idle'],
      async () => ({ stdout, stderr: '', exitCode: 0 }),
      new Map([['/cache/idle', ['18:99']]]),
    ),
  ).rejects.toThrow('Malformed global lsof output');
});

test('open escaped Unicode filenames preserve their selected ancestor', async () => {
  expect(
    await inspectNativeProcesses(
      ['/cache/café', '/cache/idle'],
      async () => ({
        stdout: 'p42\0\nf3\0n/cache/caf\\xc3\\xa9/open\0\n',
        stderr: '',
        exitCode: 0,
      }),
      new Map(),
    ),
  ).toEqual({ active: ['/cache/café'], warnings: [] });
});

test('malformed process records block cleanup even alongside valid records', async () => {
  await expect(
    inspectNativeProcesses(
      ['/cache/idle'],
      async () => ({
        stdout: 'p42\0\nf3\0n/cache/other\0pbroken\0',
        stderr: '',
        exitCode: 0,
      }),
      new Map(),
    ),
  ).rejects.toThrow('Malformed global lsof output');
});

test.skipIf(process.platform !== 'darwin')(
  'macOS var aliases protect active targets and related mount failures',
  async () => {
    expect(
      await inspectNativeProcesses(
        ['/private/var/tmp/cache'],
        async () => ({
          stdout: 'p42\0\nf3\0n/var/tmp/cache/open\0',
          stderr: '',
          exitCode: 0,
        }),
        new Map(),
      ),
    ).toEqual({ active: ['/private/var/tmp/cache'], warnings: [] });
    await expect(
      inspectNativeProcesses(
        ['/private/var/tmp/cache'],
        async () => ({
          stdout: 'p42\0\nf3\0n/unrelated/open\0',
          stderr:
            "lsof: WARNING: can't stat() fuse file system /var/tmp/cache/mount\n      Output information may be incomplete.\n",
          exitCode: 0,
        }),
        new Map(),
      ),
    ).rejects.toThrow('Process inspection is incomplete');
  },
);
