import { $ } from "bun";
import { existsSync } from "fs";
import { realpath } from "fs/promises";
import { dirname } from "path";

// Returns the primary checkout's directory when `root` is the top level of a linked Git
// worktree, or null for a primary checkout and for a directory that is not the top level
// of any checkout, such as the bootstrap smoke clone inside `.tmp/`.
export async function getLinkedWorktreePrimaryCheckout(root: string): Promise<string | null> {
  if (!existsSync(root)) return null;
  const result = await $`git rev-parse --path-format=absolute --show-toplevel --git-dir --git-common-dir`
    .cwd(root)
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) return null;

  const [topLevel, gitDir, commonDir] = result.stdout.toString().trim().split("\n");
  if (topLevel === undefined || gitDir === undefined || commonDir === undefined) return null;
  if ((await realpath(topLevel)) !== (await realpath(root)) || gitDir === commonDir) return null;

  return dirname(commonDir);
}
