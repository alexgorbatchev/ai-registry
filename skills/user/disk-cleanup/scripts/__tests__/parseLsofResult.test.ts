import { expect, test } from 'bun:test';
import { parseLsofResult } from '../parseLsofResult';

test('keeps process IDs and reports unrelated mount warnings', () => {
  const stderr =
    "lsof: WARNING: can't stat() overlay file system /unrelated/mount\n      Output information may be incomplete.\n";
  expect(parseLsofResult('/projects/example', 'p42\np42\np73\n', stderr, 0)).toEqual({
    pids: [42, 73],
    warnings: [stderr.trim()],
  });
});
test('accepts descriptor fields emitted by older macOS lsof', () => {
  expect(parseLsofResult('/projects/example', 'p42\nfcwd\nftxt\nf3\n', '', 1)).toEqual({ pids: [42], warnings: [] });
});
test.each(['/projects', '/projects/example', '/projects/example/mount'])(
  'rejects incomplete mount inspection for %s',
  (mount) => {
    const stderr = `lsof: WARNING: can't stat() fuse file system ${mount}\n      Output information may be incomplete.\n`;
    expect(() => parseLsofResult('/projects/example', '', stderr, 1)).toThrow('Process inspection is incomplete');
  },
);
test('rejects unknown warnings and malformed or failed process output', () => {
  expect(() => parseLsofResult('/projects/example', '', 'permission denied', 1)).toThrow(
    'Process inspection is incomplete',
  );
  expect(() => parseLsofResult('/projects/example', '', '', 2)).toThrow('Unexpected lsof result');
  expect(parseLsofResult('/projects/example', 'p42', '', 1)).toEqual({ pids: [42], warnings: [] });
  expect(() => parseLsofResult('/projects/example', 'garbage', '', 0)).toThrow('Unexpected lsof result');
  expect(parseLsofResult('/projects/example', '', '', 1)).toEqual({ pids: [], warnings: [] });
});
