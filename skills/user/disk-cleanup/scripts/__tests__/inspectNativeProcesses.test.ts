import { expect, test } from 'bun:test';
import { inspectNativeProcesses } from '../inspectNativeProcesses';

test('open escaped Unicode filenames preserve their selected ancestor', async () => {
  expect(
    await inspectNativeProcesses(['/cache/café', '/cache/idle'], async () => ({
      stdout: 'p42\0\nf3\0n/cache/caf\\xc3\\xa9/open\0\n',
      stderr: '',
      exitCode: 0,
    })),
  ).toEqual({ active: ['/cache/café'], warnings: [] });
});

test('malformed process records block cleanup even alongside valid records', async () => {
  await expect(
    inspectNativeProcesses(['/cache/idle'], async () => ({
      stdout: 'p42\0n/cache/other\0pbroken\0',
      stderr: '',
      exitCode: 0,
    })),
  ).rejects.toThrow('Malformed global lsof output');
});

test.skipIf(process.platform !== 'darwin')(
  'macOS var aliases protect active targets and related mount failures',
  async () => {
    expect(
      await inspectNativeProcesses(['/private/var/tmp/cache'], async () => ({
        stdout: 'p42\0n/var/tmp/cache/open\0',
        stderr: '',
        exitCode: 0,
      })),
    ).toEqual({ active: ['/private/var/tmp/cache'], warnings: [] });
    await expect(
      inspectNativeProcesses(['/private/var/tmp/cache'], async () => ({
        stdout: 'p42\0n/unrelated/open\0',
        stderr:
          "lsof: WARNING: can't stat() fuse file system /var/tmp/cache/mount\n      Output information may be incomplete.\n",
        exitCode: 0,
      })),
    ).rejects.toThrow('Process inspection is incomplete');
  },
);
