export interface ICommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandEnvironment = Record<string, string | undefined>;
export type CommandRunner = (args: string[], env: CommandEnvironment, input?: string) => Promise<ICommandResult>;

export async function runCommand(args: string[], env: CommandEnvironment, input?: string): Promise<ICommandResult> {
  const process = Bun.spawn(args, {
    env, stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  const [code, stdout, stderr] = await Promise.all([
    process.exited, new Response(process.stdout).text(), new Response(process.stderr).text(),
  ]);
  return { code, stdout, stderr };
}
