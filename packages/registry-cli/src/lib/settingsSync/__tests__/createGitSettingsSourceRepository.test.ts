import { afterAll, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import { createGitSettingsSourceRepository } from "../createGitSettingsSourceRepository";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "git-settings-source-repository-tests");
const createdDirectories: string[] = [];

async function createRepository(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const repositoryRoot = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(repositoryRoot);
  await $`git init --quiet --initial-branch=main`.cwd(repositoryRoot).quiet();
  await $`git config user.name Tester`.cwd(repositoryRoot).quiet();
  await $`git config user.email tester@example.com`.cwd(repositoryRoot).quiet();
  await mkdir(join(repositoryRoot, "harnesses"), { recursive: true });
  await writeFile(join(repositoryRoot, "harnesses", "settings.json"), "{}\n");
  await writeFile(join(repositoryRoot, "harnesses", "other.json"), "{}\n");
  await $`git add . && git commit --quiet -m initial`.cwd(repositoryRoot).quiet();
  return repositoryRoot;
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("createGitSettingsSourceRepository", () => {
  it("reports clean, dirty, and unversioned source files", async () => {
    const repositoryRoot = await createRepository();
    const repository = createGitSettingsSourceRepository();
    await writeFile(join(repositoryRoot, "harnesses", "other.json"), '{ "edited": true }\n');
    await writeFile(join(repositoryRoot, "harnesses", "untracked.json"), "{}\n");

    expect(await repository.getSourceState(join(repositoryRoot, "harnesses", "settings.json"))).toBe("clean");
    expect(await repository.getSourceState(join(repositoryRoot, "harnesses", "other.json"))).toBe("dirty");
    expect(await repository.getSourceState(join(repositoryRoot, "harnesses", "untracked.json"))).toBe("unversioned");
    expect(await repository.getSourceState("/settings.json")).toBe("unversioned");
  });

  it("commits only the synced files, leaving other staged and unstaged edits alone", async () => {
    const repositoryRoot = await createRepository();
    const repository = createGitSettingsSourceRepository();
    await writeFile(join(repositoryRoot, "harnesses", "settings.json"), '{ "model": "opus" }\n');
    await writeFile(join(repositoryRoot, "harnesses", "other.json"), '{ "staged": true }\n');
    await $`git add harnesses/other.json`.cwd(repositoryRoot).quiet();

    await repository.commit([join(repositoryRoot, "harnesses", "settings.json")]);

    const lastCommit = await $`git show --stat --format=%B HEAD`.cwd(repositoryRoot).text();
    expect(lastCommit).toMatchInlineSnapshot(`
      "chore(settings): sync harness settings

      Write settings changed in the harness back to harnesses/settings.json.


       harnesses/settings.json | 2 +-
       1 file changed, 1 insertion(+), 1 deletion(-)
      "
    `);
    expect((await $`git status --porcelain`.cwd(repositoryRoot).text()).trim()).toBe("M  harnesses/other.json");
  });

  it("refuses to commit files outside a Git repository", async () => {
    const repository = createGitSettingsSourceRepository();

    await expect(repository.commit(["/settings.json"])).rejects.toThrow(
      "Cannot commit synced settings: /settings.json is not inside a Git repository.",
    );
  });
});
