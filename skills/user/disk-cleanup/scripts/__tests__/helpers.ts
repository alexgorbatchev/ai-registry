import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const skillPath = join(import.meta.dir, '../..');
type CliResult = { exitCode: number; stdout: string; stderr: string };
export async function createRoot(): Promise<string> {
  await mkdir(join(skillPath, '.tmp'), { recursive: true });
  return mkdtemp(join(skillPath, '.tmp/cleanup-test-'));
}
export async function disposeRoot(rootPath: string): Promise<void> {
  await rm(rootPath, { recursive: true });
}
export function git(rootPath: string, args: string[], ageDays: number = 60): string {
  const timestamp = new Date(Date.now() - ageDays * 86400000).toISOString();
  const result = Bun.spawnSync(
    ['git', '-C', rootPath, '-c', `core.hooksPath=${join(rootPath, '.tmp/no-hooks')}`, ...args],
    {
      env: {
        ...Bun.env,
        GIT_AUTHOR_NAME: 'Cleanup Test',
        GIT_AUTHOR_EMAIL: 'cleanup@example.invalid',
        GIT_COMMITTER_NAME: 'Cleanup Test',
        GIT_COMMITTER_EMAIL: 'cleanup@example.invalid',
        GIT_AUTHOR_DATE: timestamp,
        GIT_COMMITTER_DATE: timestamp,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  if (!result.success) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}
export async function createRepository(rootPath: string, name: string, ageDays: number = 60): Promise<string> {
  const repositoryPath = join(rootPath, name);
  await mkdir(repositoryPath, { recursive: true });
  git(repositoryPath, ['init', '--initial-branch=main'], ageDays);
  await Bun.write(join(repositoryPath, '.gitignore'), 'node_modules/\n.tmp/\n.workspaces/\n');
  await Bun.write(join(repositoryPath, 'source.txt'), 'source\n');
  git(repositoryPath, ['add', '.'], ageDays);
  git(repositoryPath, ['commit', '-m', 'fixture'], ageDays);
  await mkdir(join(repositoryPath, 'node_modules'), { recursive: true });
  await Bun.write(join(repositoryPath, 'node_modules/package.txt'), 'dependency\n');
  return repositoryPath;
}
export function cli(rootPath: string, args: string[], agent: string = '1'): CliResult {
  const result = Bun.spawnSync(['bun', join(skillPath, 'scripts/cleanup.ts'), ...args], {
    cwd: rootPath,
    env: { ...Bun.env, AGENT: agent },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}
