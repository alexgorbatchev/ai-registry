import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { isWithin, validatePath } from './filesystemUtils';

export async function validateRustStorage(root: string, project: string): Promise<void> {
  await validatePath(root, project);
  await validatePath(root, join(project, 'Cargo.toml'));
  const child = Bun.spawn(['cargo', 'metadata', '--format-version', '1', '--no-deps', '--locked', '--offline'], {
    cwd: project,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, RUSTUP_AUTO_INSTALL: '0' },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`Cargo inspection failed (${code}): ${stderr.trim()}`);
  const metadata: unknown = JSON.parse(stdout);
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('workspace_root' in metadata) ||
    typeof metadata.workspace_root !== 'string' ||
    !('target_directory' in metadata) ||
    metadata.target_directory !== join(project, 'target') ||
    ('build_directory' in metadata && metadata.build_directory !== metadata.target_directory) ||
    !('packages' in metadata) ||
    !Array.isArray(metadata.packages) ||
    (await realpath(metadata.workspace_root)) !== project
  ) {
    throw new Error(`Nonstandard Cargo storage requires manual review: ${project}`);
  }
  for (const item of metadata.packages) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('manifest_path' in item) ||
      typeof item.manifest_path !== 'string' ||
      !isWithin(project, await realpath(item.manifest_path))
    ) {
      throw new Error(`Workspace members outside the project require manual review: ${project}`);
    }
  }
}
