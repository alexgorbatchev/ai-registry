import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Builds of one checkout share its `.output/`, generated-output staging, manifest, and
// settings sync, so they take turns on this lock. Manual builds, bootstrap, and the
// scheduled update all build through `bin/build.ts`, which runs itself under it.
export const BUILD_LOCK_HELD_ENV = "AI_REGISTRY_BUILD_LOCK_HELD";
export const DEFAULT_BUILD_LOCK_WAIT_SECONDS = 600;
const LOCK_BUSY_EXIT_CODE = 75;

export type IRunUnderBuildLockOptions = {
  platform?: NodeJS.Platform;
  waitSeconds?: number;
  log?: (message: string) => void;
};

export function getBuildLockPath(repositoryRoot: string): string {
  return join(repositoryRoot, ".state", "build.lock");
}

function getLockCommand(platform: NodeJS.Platform, lockPath: string, waitSeconds: number, command: string[]): string[] {
  if (platform === "darwin") {
    return ["/usr/bin/lockf", "-k", "-s", "-t", String(waitSeconds), lockPath, ...command];
  }
  if (platform === "linux") {
    return ["flock", "-w", String(waitSeconds), "-E", String(LOCK_BUSY_EXIT_CODE), lockPath, ...command];
  }
  throw new Error(`Builds require macOS lockf or Linux flock (platform: ${platform}).`);
}

async function runLocked(
  platform: NodeJS.Platform,
  lockPath: string,
  waitSeconds: number,
  command: string[],
): Promise<number> {
  const subprocess = Bun.spawn(getLockCommand(platform, lockPath, waitSeconds, command), {
    env: { ...process.env, [BUILD_LOCK_HELD_ENV]: "1" },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return subprocess.exited;
}

// Runs `command` while holding the checkout's build lock. When another build holds
// it, says so and waits up to `waitSeconds` for it to finish; the operating system
// releases the lock when its holder exits, crashed or not. Returns the command's exit code.
export async function runUnderBuildLock(
  repositoryRoot: string,
  command: string[],
  options: IRunUnderBuildLockOptions = {},
): Promise<number> {
  const platform = options.platform ?? process.platform;
  const waitSeconds = options.waitSeconds ?? DEFAULT_BUILD_LOCK_WAIT_SECONDS;
  const log = options.log ?? console.log;
  const lockPath = getBuildLockPath(repositoryRoot);
  await mkdir(join(repositoryRoot, ".state"), { recursive: true });

  const immediateExitCode = await runLocked(platform, lockPath, 0, command);
  if (immediateExitCode !== LOCK_BUSY_EXIT_CODE) {
    return immediateExitCode;
  }

  log(`⏳ Another build of this checkout is running; waiting up to ${waitSeconds}s for ${lockPath}...`);
  const exitCode = await runLocked(platform, lockPath, waitSeconds, command);
  if (exitCode === LOCK_BUSY_EXIT_CODE) {
    throw new Error(
      `Another build held ${lockPath} for more than ${waitSeconds}s. Check for a stuck build process, then rerun.`,
    );
  }
  return exitCode;
}
