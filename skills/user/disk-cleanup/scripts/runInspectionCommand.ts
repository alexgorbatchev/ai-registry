import type { InspectionCommandResult } from './types';
import { resolveGnuCommand } from './resolveGnuCommand';

export async function runInspectionCommand(args: string[]): Promise<InspectionCommandResult> {
  const command = args[0];
  if (!command) throw new Error('Command is required');
  const child = Bun.spawn([resolveGnuCommand(command), ...args.slice(1)], {
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
