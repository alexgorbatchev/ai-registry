import { link, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { runInspectionCommand } from '../runInspectionCommand';
import type { InspectionRunner } from '../types';

export { factory_testDirectory, factory_testRoot } from '../../../../../packages/registry-cli/src/__tests__/fixtures';

export async function factory_linkedCaches(root: string, count: number, isSymlink = false): Promise<string[]> {
  const paths = Array.from({ length: count }, (_, index) => join(root, `cache/${index}`));
  for (const path of paths) await mkdir(path, { recursive: true });
  const source = join(paths[0]!, 'data');
  if (isSymlink) await symlink('missing-target', source);
  else await Bun.write(source, 'reviewed cache');
  for (const path of paths.slice(1)) {
    if (isSymlink) {
      const result = await runInspectionCommand(['ln', '-P', source, join(path, 'data')]);
      if (result.exitCode !== 0) throw new Error(result.stderr);
    } else await link(source, join(path, 'data'));
  }
  return paths;
}

export function factory_afterRemoval(afterRemoval: (paths: string[]) => Promise<void>): InspectionRunner {
  return async (args) => {
    const result = await runInspectionCommand(args);
    if (args[0] === 'rm' && result.exitCode === 0) await afterRemoval(args.slice(3));
    return result;
  };
}
