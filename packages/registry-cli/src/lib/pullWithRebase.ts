import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { getErrorMessage } from "./getErrorMessage";
import { getScheduledUpdatePaths } from "./getScheduledUpdatePaths";

export type IScheduledUpdateRunner = (cmd: string[], shouldCapture?: boolean) => Promise<string>;

async function hasRebase(gitDirectory: string): Promise<boolean> {
  const states = await Promise.all(
    ["rebase-merge/head-name", "rebase-apply/head-name"].map((path) => Bun.file(join(gitDirectory, path)).exists()),
  );
  return states.some(Boolean);
}

/**
 * Rebases the checkout onto its upstream, returning false when it stays put because of
 * uncommitted work. That work is never stashed: restoring it can conflict, and rewriting its
 * files on every run resets the quiet window that lets the commit sweep finish it.
 */
export async function pullWithRebase(
  repositoryRoot: string,
  before: string,
  run: IScheduledUpdateRunner,
): Promise<boolean> {
  const { stateDir, recoveryPath } = getScheduledUpdatePaths(repositoryRoot);
  const recoveryFile = Bun.file(recoveryPath);
  if (await recoveryFile.exists()) {
    throw new Error(`An interrupted update needs recovery. Inspect ${recoveryFile.name} before retrying.`);
  }
  const gitDirectory = await run(["git", "rev-parse", "--absolute-git-dir"], true);
  const activeOperations = await Promise.all(
    ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "index.lock"].map((path) =>
      Bun.file(join(gitDirectory, path)).exists(),
    ),
  );
  if (activeOperations.some(Boolean) || (await hasRebase(gitDirectory))) {
    throw new Error("Finish the existing Git operation before running a scheduled update.");
  }
  if (await run(["git", "status", "--porcelain", "--untracked-files=normal"], true)) {
    return false;
  }

  const git = ["git", "-c", "core.hooksPath=/dev/null", "-c", "rebase.updateRefs=false"];
  await mkdir(stateDir, { recursive: true });
  await Bun.write(recoveryFile, JSON.stringify({ before }));

  try {
    await run([...git, "pull", "--rebase", "--ff", "--no-autostash"]);
  } catch (error) {
    try {
      if (await hasRebase(gitDirectory)) {
        await run([...git, "rebase", "--abort"]);
      } else if ((await run(["git", "rev-parse", "HEAD"], true)) !== before) {
        await run([...git, "reset", "--hard", before]);
      }
      await recoveryFile.delete();
    } catch (rollbackError) {
      throw new Error(
        `Update failed: ${getErrorMessage(error)}. Recovery failed: ${getErrorMessage(rollbackError)}. ` +
          `Inspect ${recoveryFile.name} before retrying.`,
        { cause: rollbackError },
      );
    }
    throw new Error(`Update failed and was rolled back: ${getErrorMessage(error)}`, { cause: error });
  }
  await recoveryFile.delete();
  return true;
}
