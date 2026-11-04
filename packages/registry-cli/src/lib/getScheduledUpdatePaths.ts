import { join } from "node:path";

export type IScheduledUpdatePaths = {
  stateDir: string;
  lockPath: string;
  logPath: string;
  recoveryPath: string;
};

/**
 * Locates the scheduled update's long-lived files under the checkout's git-ignored `.state/`.
 * The workspace scheduler takes the same lock for members with `.cronrc`, so the lock path is a
 * cross-repository contract.
 */
export function getScheduledUpdatePaths(repositoryRoot: string): IScheduledUpdatePaths {
  const stateDir = join(repositoryRoot, ".state");
  return {
    stateDir,
    lockPath: join(stateDir, "scheduled-update.lock"),
    logPath: join(stateDir, "scheduled-update.log"),
    recoveryPath: join(stateDir, "scheduled-update-recovery.json"),
  };
}
