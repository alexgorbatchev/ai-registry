import { $ } from "bun";
import { join } from "path";
import { getRegistryPaths } from "../lib/getRegistryPaths";

const HOOKS_PATH = ".githooks";

async function isGitWorktree(root: string): Promise<boolean> {
  try {
    await $`git rev-parse --is-inside-work-tree`.cwd(root).quiet();
    return true;
  } catch {
    return false;
  }
}

export async function installGitHooksCommand(): Promise<void> {
  const { root } = getRegistryPaths();
  
  if (!(await isGitWorktree(root))) {
    console.log("Skipping Git hook install outside a Git worktree.");
    return;
  }

  await $`git config --local core.hooksPath ${HOOKS_PATH}`.cwd(root);
  console.log(`Git hooks now read from: ${join(root, HOOKS_PATH)}`);
}
