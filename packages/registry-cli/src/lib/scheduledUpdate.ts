import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

type IScheduledUpdateResult = "unchanged" | "bootstrapped";
type IScheduledUpdateRunner = (cmd: string[], shouldCapture?: boolean) => Promise<string>;

function createRunner(repositoryRoot: string, bunExecutable: string): IScheduledUpdateRunner {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${dirname(bunExecutable)}:${process.env.PATH ?? ""}`,
    GIT_TERMINAL_PROMPT: "0",
  };
  return async (cmd, shouldCapture = false) => {
    const subprocess = Bun.spawn(cmd, {
      cwd: repositoryRoot,
      env,
      stdin: "ignore",
      stdout: shouldCapture ? "pipe" : "inherit",
      stderr: "inherit",
    });
    const stdout = shouldCapture ? new Response(subprocess.stdout).text() : Promise.resolve("");
    const [output, exitCode] = await Promise.all([stdout, subprocess.exited]);
    if (exitCode !== 0) {
      throw new Error(`Command failed (exit code ${exitCode}): ${cmd.join(" ")}`);
    }
    return output.trim();
  };
}

export async function scheduledUpdate(
  repositoryRoot: string,
  bunExecutable: string,
  run: IScheduledUpdateRunner = createRunner(repositoryRoot, bunExecutable),
): Promise<IScheduledUpdateResult> {
  const status = await run(["git", "status", "--porcelain", "--untracked-files=no"], true);
  if (status) {
    throw new Error("Tracked local changes exist. Commit or stash them before running the scheduled update.");
  }

  const before = await run(["git", "rev-parse", "HEAD"], true);
  await run(["git", "-c", "core.hooksPath=/dev/null", "pull", "--ff-only", "--no-rebase", "--no-autostash"]);
  const after = await run(["git", "rev-parse", "HEAD"], true);
  const pendingFile = Bun.file(join(repositoryRoot, ".tmp/scheduled-update-pending"));
  if (before === after && !(await pendingFile.exists())) {
    return "unchanged";
  }

  await mkdir(join(repositoryRoot, ".tmp"), { recursive: true });
  await Bun.write(pendingFile, after);
  await run([bunExecutable, "run", "bootstrap", "--", "-y"]);
  await pendingFile.delete();
  return "bootstrapped";
}
