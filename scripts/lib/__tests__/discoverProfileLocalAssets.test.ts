import assert from "node:assert";
import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { discoverProfileLocalAssets } from "../discoverProfileLocalAssets";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "discover-profile-local-assets-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

async function writeProfileFile(profileDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = join(profileDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

describe("discoverProfileLocalAssets", () => {
  afterAll(async () => {
    for (const createdDirectory of createdDirectories) {
      await rm(createdDirectory, { recursive: true, force: true });
    }
  });

  it("discovers top-level local commands and skills", async () => {
    const profileDir = await createTestDirectory();
    await writeProfileFile(profileDir, "commands/review.md", "review\n");
    await writeProfileFile(profileDir, "commands/fix.md", "fix\n");
    await writeProfileFile(profileDir, "skills/private-debug/SKILL.md", "---\nname: private-debug\n---\n");

    const result = await discoverProfileLocalAssets(profileDir);

    expect(result).toEqual({
      profileLocalCommands: ["fix.md", "review.md"],
      profileLocalSkills: ["private-debug"],
    });
  });

  it("rejects nested local command directories", async () => {
    const profileDir = await createTestDirectory();
    await writeProfileFile(profileDir, "commands/nested/review.md", "review\n");

    const result = discoverProfileLocalAssets(profileDir);

    await expect(result).rejects.toThrow("Profile-local commands must be top-level Markdown files only");
  });

  it("rejects non-markdown local command files", async () => {
    const profileDir = await createTestDirectory();
    await writeProfileFile(profileDir, "commands/review.txt", "review\n");

    const result = discoverProfileLocalAssets(profileDir);

    await expect(result).rejects.toThrow("Profile-local commands must use .md filenames");
  });

  it("rejects top-level local skill files", async () => {
    const profileDir = await createTestDirectory();
    await writeProfileFile(profileDir, "skills/private-debug.md", "bad\n");

    const result = discoverProfileLocalAssets(profileDir);

    await expect(result).rejects.toThrow("Profile-local skills must be top-level directories only");
  });

  it("rejects local skill directories without SKILL.md", async () => {
    const profileDir = await createTestDirectory();
    await writeProfileFile(profileDir, "skills/private-debug/README.md", "bad\n");

    const result = discoverProfileLocalAssets(profileDir);

    await expect(result).rejects.toThrow("Profile-local skills must include SKILL.md");
  });
});
