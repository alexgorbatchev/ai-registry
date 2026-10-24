import type { InspectionCommandResult } from './types';

export async function runInspectionCommand(args: string[]): Promise<InspectionCommandResult> {
  const child = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, AGENT: '1', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}
