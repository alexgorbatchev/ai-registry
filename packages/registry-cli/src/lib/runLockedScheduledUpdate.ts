import { mkdir } from "node:fs/promises";
import { join } from "node:path";

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
  const loggerCommand = [process.execPath, join(import.meta.dir, "../bin/scheduled-update-logger.ts")];
  const command = platform === "darwin"
    ? ["/usr/bin/lockf", "-k", "-s", "-t", "0", lockPath, ...loggerCommand]
    : ["flock", "-n", "-E", "75", lockPath, ...loggerCommand];
  const subprocess = Bun.spawn(command, {
    cwd: repositoryRoot,
    env: { ...process.env, AI_REGISTRY_SCHEDULED_WORKER: JSON.stringify(workerCommand) },
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await subprocess.exited;
  if (exitCode === 75) return "busy";
  if (exitCode !== 0) {
    throw new Error(`Scheduled update failed (exit code ${exitCode}). See ${logPath}`);
  }
  return "completed";
}
