import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { getErrorMessage } from "./getErrorMessage";

export type IScheduledUpdateRunner = (cmd: string[], shouldCapture?: boolean) => Promise<string>;

async function hasRebase(gitDirectory: string): Promise<boolean> {
  const states = await Promise.all(["rebase-merge/head-name", "rebase-apply/head-name"].map(
    (path) => Bun.file(join(gitDirectory, path)).exists(),
  ));
  return states.some(Boolean);
}

async function dropSavedStash(stash: string, run: IScheduledUpdateRunner): Promise<void> {
  const entries = await run(["git", "stash", "list", "--format=%H %gd"], true);
  const reference = entries.split("\n").find((entry) => entry.startsWith(`${stash} `))?.slice(stash.length + 1);
  if (!reference) {
    throw new Error(`Saved stash ${stash} is missing; inspect Git state before retrying.`);
  }
  await run(["git", "stash", "drop", reference]);
}

export async function pullWithRebase(
  repositoryRoot: string,
  before: string,
  run: IScheduledUpdateRunner,
): Promise<void> {
  const recoveryFile = Bun.file(join(repositoryRoot, ".tmp/scheduled-update-recovery.json"));
  if (await recoveryFile.exists()) {
    throw new Error(`An interrupted update needs recovery. Inspect ${recoveryFile.name} before retrying.`);
  }
  const gitDirectory = await run(["git", "rev-parse", "--absolute-git-dir"], true);
  const activeOperations = await Promise.all(["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "index.lock"].map(
    (path) => Bun.file(join(gitDirectory, path)).exists(),
  ));
  if (activeOperations.some(Boolean) || await hasRebase(gitDirectory)) {
    throw new Error("Finish the existing Git operation before running a scheduled update.");
  }

  const git = ["git", "-c", "core.hooksPath=/dev/null", "-c", "rebase.updateRefs=false"];
  const label = `scheduled-update ${before} ${Date.now()}`;
  await mkdir(join(repositoryRoot, ".tmp"), { recursive: true });
  await Bun.write(recoveryFile, JSON.stringify({ before, label }));
  let stash = "";
  if (await run(["git", "status", "--porcelain", "--untracked-files=no"], true)) {
    await run([...git, "stash", "push", "--message", label]);
    stash = await run(["git", "rev-parse", "refs/stash"], true);
    const subject = await run(["git", "log", "-1", "--format=%s", stash], true);
    if (!subject.endsWith(label)) {
      throw new Error(`Could not identify the saved local changes. Inspect ${recoveryFile.name} before retrying.`);
    }
    await Bun.write(recoveryFile, JSON.stringify({ before, label, stash }));
  }

  try {
    await run([...git, "pull", "--rebase", "--ff", "--no-autostash"]);
    if (stash) {
      await run([...git, "stash", "apply", "--index", stash]);
    }
  } catch (error) {
    try {
      if (await hasRebase(gitDirectory)) {
        await run([...git, "rebase", "--abort"]);
      } else if (await run(["git", "rev-parse", "HEAD"], true) !== before) {
        await run([...git, "reset", "--hard", before]);
      }
      if (stash) {
        await run([...git, "stash", "apply", "--index", stash]);
        await dropSavedStash(stash, run);
      }
      await recoveryFile.delete();
    } catch (rollbackError) {
      throw new Error(
        `Update failed: ${getErrorMessage(error)}. Recovery failed: ${getErrorMessage(rollbackError)}. `
        + `Saved changes: ${stash || "none"}; inspect ${recoveryFile.name} before retrying.`,
        { cause: rollbackError },
      );
    }
    throw new Error(`Update failed and was rolled back: ${getErrorMessage(error)}`, { cause: error });
  }
  if (stash) {
    await dropSavedStash(stash, run);
  }
  await recoveryFile.delete();
}
