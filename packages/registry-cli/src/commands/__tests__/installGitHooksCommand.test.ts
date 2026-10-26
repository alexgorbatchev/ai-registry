import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { $ } from "bun";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { installGitHooksCommand } from "../installGitHooksCommand";

// Outside this repository, so the "not a Git worktree" case is not inside one.
const TEST_ROOT = join(tmpdir(), "registry-cli-install-git-hooks-tests");

describe("installGitHooksCommand", () => {
  let root: string;
  let logLines: string[];

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    root = await mkdtemp(join(TEST_ROOT, "case-"));
    logLines = [];
    spyOn(console, "log").mockImplementation((...values: unknown[]) => {
      logLines.push(values.join(" "));
    });
  });

  afterEach(async () => {
    mock.restore();
    await rm(root, { recursive: true, force: true });
  });

  it("points the repository's hooks at the checked-in .githooks directory", async () => {
    await $`git init --quiet`.cwd(root);

    await installGitHooksCommand(root);

    expect((await $`git config --local core.hooksPath`.cwd(root).text()).trim()).toBe(".githooks");
    expect(logLines).toEqual([`Git hooks now read from: ${join(root, ".githooks")}`]);
  });

  it("skips installation outside a Git worktree", async () => {
    await installGitHooksCommand(root);

    expect(logLines).toEqual(["Skipping Git hook install outside a Git worktree."]);
  });
});
