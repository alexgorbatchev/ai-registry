import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { writeTimestampedOutput } from "./writeTimestampedOutput";

type ILockedScheduledUpdateResult = "completed" | "busy";

export async function runLockedScheduledUpdate(
  repositoryRoot: string,
  workerCommand: string[],
  platform: NodeJS.Platform = process.platform,
): Promise<ILockedScheduledUpdateResult> {
  if (platform !== "darwin" && platform !== "linux") {
    throw new Error(`Scheduled updates require macOS lockf or Linux flock (platform: ${platform}).`);
  }

  await mkdir(join(repositoryRoot, ".tmp"), { recursive: true });
  const lockPath = join(repositoryRoot, ".tmp/scheduled-update.lock");
  const logPath = join(repositoryRoot, ".tmp/scheduled-update.log");
  const command = platform === "darwin"
    ? ["/usr/bin/lockf", "-k", "-s", "-t", "0", lockPath, ...workerCommand]
    : ["flock", "-n", "-E", "75", lockPath, ...workerCommand];
  // Open the append destination before starting work, including runs with no output.
  await $`printf %s ${""} >> ${logPath}`;
  const subprocess = Bun.spawn(["/bin/sh", "-c", 'exec "$@" 2>&1', "scheduled-update", ...command], {
    cwd: repositoryRoot,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const [exitCode] = await Promise.all([
    subprocess.exited,
    writeTimestampedOutput(subprocess.stdout, async (output) => {
      await $`printf %s ${output} >> ${logPath}`;
    }),
  ]);
  if (exitCode === 75) {
    return "busy";
  }
  if (exitCode !== 0) {
    throw new Error(`Scheduled update failed (exit code ${exitCode}). See ${logPath}`);
  }
  return "completed";
}
