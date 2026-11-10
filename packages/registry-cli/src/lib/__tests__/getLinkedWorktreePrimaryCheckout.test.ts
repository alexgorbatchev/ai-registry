import { factory_testRoot } from "./fixtures";
import { afterAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { mkdir, mkdtemp, realpath, rm } from "fs/promises";
import { join } from "path";

import { getLinkedWorktreePrimaryCheckout } from "../getLinkedWorktreePrimaryCheckout";

const TEST_ROOT = factory_testRoot("linked-worktree-tests");
const createdDirectories: string[] = [];

// A primary checkout with one commit and a linked worktree beside it.
async function createRepositoryWithWorktree(): Promise<{ primary: string; worktree: string }> {
  await mkdir(TEST_ROOT, { recursive: true });
  const caseDir = await realpath(await mkdtemp(join(TEST_ROOT, "case-")));
  createdDirectories.push(caseDir);
  const primary = join(caseDir, "primary");
  const worktree = join(caseDir, "worktree");
  await mkdir(primary);
  await $`git init -q -b main && git -c user.name=test -c user.email=test@example.invalid commit -q --allow-empty -m init`
    .cwd(primary)
    .quiet();
  await $`git worktree add -q ${worktree}`.cwd(primary).quiet();
  return { primary, worktree };
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("getLinkedWorktreePrimaryCheckout", () => {
  it("names the primary checkout for the top level of a linked worktree", async () => {
    const { primary, worktree } = await createRepositoryWithWorktree();

    expect(await getLinkedWorktreePrimaryCheckout(worktree)).toBe(primary);
  });

  it("returns null for the primary checkout", async () => {
    const { primary } = await createRepositoryWithWorktree();

    expect(await getLinkedWorktreePrimaryCheckout(primary)).toBeNull();
  });

  it("returns null for a directory inside a worktree that is not its top level", async () => {
    const { worktree } = await createRepositoryWithWorktree();
    const nested = join(worktree, ".tmp", "smoke");
    await mkdir(nested, { recursive: true });

    expect(await getLinkedWorktreePrimaryCheckout(nested)).toBeNull();
  });

  it("returns null for a missing directory", async () => {
    const { primary } = await createRepositoryWithWorktree();

    expect(await getLinkedWorktreePrimaryCheckout(join(primary, "missing"))).toBeNull();
  });
});
