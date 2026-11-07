import { constants } from 'node:fs';
import type { Stats } from 'node:fs';
import { lstat, open, readlink } from 'node:fs/promises';
import type { NativeHardlinks } from './nativeTypes';

export async function inspectNativeHardlink(path: string, info: Stats, state: NativeHardlinks): Promise<number> {
  const key = `${info.dev}:${info.ino}`;
  const baseline = state.baseline.get(key);
  const removed = state.removed.get(key) ?? 0;
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(metadata(info));
  if (info.isSymbolicLink()) hasher.update(await readlink(path));
  else {
    // Open the inspected inode without following a replacement symlink or blocking on a replacement FIFO.
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || snapshot(opened) !== snapshot(info))
        throw new Error(`Hard-linked file changed during validation: ${path}`);
      for await (const chunk of Bun.file(handle.fd).stream()) hasher.update(chunk);
      if (snapshot(await handle.stat()) !== snapshot(info))
        throw new Error(`Hard-linked file changed during validation: ${path}`);
    } finally {
      await handle.close();
    }
  }
  if (snapshot(await lstat(path)) !== snapshot(info))
    throw new Error(`Hard-linked file changed during validation: ${path}`);
  const fingerprint = hasher.digest('hex');
  if (baseline) {
    if (info.nlink !== baseline.nlink - removed || fingerprint !== baseline.fingerprint)
      throw new Error(`Hard-linked file changed since validation: ${path}`);
    // Only successful, verified removals justify substituting the original ctime in the reviewed identity.
    return removed > 0 ? baseline.ctimeMs : info.ctimeMs;
  }
  state.baseline.set(key, { ctimeMs: info.ctimeMs, nlink: info.nlink, fingerprint });
  return info.ctimeMs;
}

function metadata(info: Stats): string {
  return JSON.stringify([info.dev, info.ino, info.mode, info.uid, info.gid, info.size, info.mtimeMs, info.birthtimeMs]);
}

function snapshot(info: Stats): string {
  return JSON.stringify([metadata(info), info.ctimeMs, info.nlink]);
}
