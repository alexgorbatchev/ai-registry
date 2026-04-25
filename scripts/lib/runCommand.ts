export interface IRunCommandSpawnOptions {
  cmd: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdin: "inherit";
  stdout: "inherit";
  stderr: "inherit";
}

export interface IRunCommandSpawnedProcess {
  exited: Promise<number>;
}

export type IRunCommandSpawn = (
  options: IRunCommandSpawnOptions,
) => IRunCommandSpawnedProcess;

export interface IRunCommandOptions {
  cmd: string[];
  cwd: string;
  description: string;
  env?: NodeJS.ProcessEnv;
  failureHint?: string;
  spawn?: IRunCommandSpawn;
}

function createFailureMessage(
  description: string,
  exitCode: number,
  failureHint?: string,
): string {
  const lines = [`Failed to ${description} (exit code ${exitCode}).`];

  if (failureHint) {
    lines.push(failureHint);
  }

  return lines.join("\n");
}

function defaultSpawn(options: IRunCommandSpawnOptions): IRunCommandSpawnedProcess {
  return Bun.spawn(options);
}

export async function runCommand(options: IRunCommandOptions): Promise<void> {
  const spawn = options.spawn ?? defaultSpawn;
  const spawnedProcess = spawn({
    cmd: options.cmd,
    cwd: options.cwd,
    env: options.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await spawnedProcess.exited;

  if (exitCode === 0) {
    return;
  }

  throw new Error(
    createFailureMessage(options.description, exitCode, options.failureHint),
  );
}
