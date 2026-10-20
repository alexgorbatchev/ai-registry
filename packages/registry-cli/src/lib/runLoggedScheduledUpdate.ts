import { $ } from "bun";
import { join } from "node:path";

import { pruneScheduledUpdateLog } from "./pruneScheduledUpdateLog";
import { writeTimestampedOutput } from "./writeTimestampedOutput";

export async function runLoggedScheduledUpdate(repositoryRoot: string, workerCommand: string[]): Promise<number> {
  const logPath = join(repositoryRoot, ".tmp/scheduled-update.log");
  await pruneScheduledUpdateLog(logPath);
  // Open the append destination before starting work, including runs with no output.
  await $`printf %s ${""} >> ${logPath}`;
  const subprocess = Bun.spawn(["/bin/sh", "-c", 'exec "$@" 2>&1', "scheduled-update", ...workerCommand], {
    cwd: repositoryRoot,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  try {
    await writeTimestampedOutput(subprocess.stdout, async (output) => {
      await $`printf %s ${output} >> ${logPath}`;
    });
  } catch (error) {
    subprocess.kill();
    throw error;
  } finally {
    await subprocess.exited;
  }
  return subprocess.exited;
}
