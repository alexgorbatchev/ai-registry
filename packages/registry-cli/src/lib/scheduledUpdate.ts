import { dirname } from "node:path";

import { getRegistryOverlays } from "./getRegistryPaths";
import { pullWithRebase } from "./pullWithRebase";
import type { IScheduledUpdateRunner } from "./pullWithRebase";
import { pushScheduledCommits } from "./pushScheduledCommits";

type IScheduledUpdateResult = "bootstrapped" | "bootstrapped-and-pushed" | "bootstrapped-without-pull";

function createRunner(repositoryRoot: string, bunExecutable: string): IScheduledUpdateRunner {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${dirname(bunExecutable)}:${process.env.PATH ?? ""}`,
    GIT_TERMINAL_PROMPT: "0",
    AI_REGISTRY_SETTINGS_AUTO_COMMIT: "0",
  };
  return async (cmd, shouldCapture = false, cwd = repositoryRoot) => {
    const subprocess = Bun.spawn(cmd, {
      cwd,
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

async function pullOverlays(repositoryRoot: string, run: IScheduledUpdateRunner): Promise<void> {
  const primaryRoot = await run(["git", "rev-parse", "--show-toplevel"], true);
  const pulledRoots = new Set([primaryRoot]);
  for (const overlay of getRegistryOverlays(repositoryRoot)) {
    const overlayRoot = await run(["git", "rev-parse", "--show-toplevel"], true, overlay);
    if (pulledRoots.has(overlayRoot)) continue;
    pulledRoots.add(overlayRoot);
    const runOverlay: IScheduledUpdateRunner = (cmd, shouldCapture) => run(cmd, shouldCapture, overlayRoot);
    const before = await runOverlay(["git", "rev-parse", "HEAD"], true);
    await pullWithRebase(overlayRoot, before, runOverlay);
  }
}

// cron-person approves this checkout's `.cronrc` by hash, so a pulled schedule change
// would block every later run on this machine until someone approves it there. The job
// already runs whatever code it pulls, so it approves a pulled change itself and
// reinstalls the crontab before anything else can fail.
async function approvePulledSchedule(before: string, run: IScheduledUpdateRunner): Promise<void> {
  const changedPaths = await run(["git", "diff", "--name-only", before, "HEAD", "--", ".cronrc"], true);
  if (changedPaths === "") return;
  console.log("Approving the pulled .cronrc change and reinstalling the crontab...");
  await run(["just", "cron-enable"]);
}

export async function scheduledUpdate(
  repositoryRoot: string,
  bunExecutable: string,
  run: IScheduledUpdateRunner = createRunner(repositoryRoot, bunExecutable),
): Promise<IScheduledUpdateResult> {
  const before = await run(["git", "rev-parse", "HEAD"], true);
  const hasPulled = await pullWithRebase(repositoryRoot, before, run);
  if (hasPulled) {
    await approvePulledSchedule(before, run);
  }
  await pullOverlays(repositoryRoot, run);
  // Bootstrap on every run, not only after incoming commits: the build also syncs
  // settings the harnesses changed on this machine, leaving those edits uncommitted.
  await run(["just", "bootstrap", "-y"]);
  if (!hasPulled) {
    // An unreconciled branch can only be rejected, so outgoing commits wait for a clean run.
    return "bootstrapped-without-pull";
  }
  const hasPushed = await pushScheduledCommits(run);
  return hasPushed ? "bootstrapped-and-pushed" : "bootstrapped";
}
