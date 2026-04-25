import { $ } from "bun";
import { resolve } from "path";

import { getErrorMessage } from "./lib/getErrorMessage";

const REGISTRY_DIR = resolve(import.meta.dir, "..");
const HOOKS_PATH = ".githooks";

async function isGitWorktree(): Promise<boolean> {
  try {
    await $`git rev-parse --is-inside-work-tree`.cwd(REGISTRY_DIR).quiet();
    return true;
  } catch {
    return false;
  }
}

export async function installGitHooks(): Promise<void> {
  if (!(await isGitWorktree())) {
    console.log("Skipping Git hook install outside a Git worktree.");
    return;
  }

  await $`git config --local core.hooksPath ${HOOKS_PATH}`.cwd(REGISTRY_DIR);
  console.log(`Git hooks now read from: ${resolve(REGISTRY_DIR, HOOKS_PATH)}`);
}

async function main(): Promise<void> {
  await installGitHooks();
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exit(1);
});
