import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { syncPublicScripts } from "../syncPublicScripts";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "sync-public-scripts-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

async function writeScriptFile(scriptsDir: string, fileName: string, content: string = "#!/usr/bin/env bash\n"): Promise<string> {
  const scriptPath = join(scriptsDir, fileName);
  await mkdir(dirname(scriptPath), { recursive: true });
  await writeFile(scriptPath, content, "utf-8");
  return scriptPath;
}

describe("syncPublicScripts", () => {
  afterAll(async () => {
    for (const createdDirectory of createdDirectories) {
      await rm(createdDirectory, { recursive: true, force: true });
    }
  });

  it("links all air-prefixed scripts and ignores other entries", async () => {
    const testDir = await createTestDirectory();
    const scriptsDir = join(testDir, "scripts");
    const binDir = join(testDir, "bin");
    const firstPublicScriptPath = await writeScriptFile(scriptsDir, "air-first");
    const secondPublicScriptPath = await writeScriptFile(scriptsDir, "air-second");
    await writeScriptFile(scriptsDir, "not-public");

    const result = await syncPublicScripts({ binDir, scriptsDir, getTimestamp: () => "20260425T000000Z" });

    expect(result).toEqual({
      cleanedBrokenLinks: [],
      linkedScripts: [
        { action: "linked", scriptName: "air-first" },
        { action: "linked", scriptName: "air-second" },
      ],
    });
    expect(await readlink(join(binDir, "air-first"))).toBe(firstPublicScriptPath);
    expect(await readlink(join(binDir, "air-second"))).toBe(secondPublicScriptPath);
    expect((await readdir(binDir)).sort()).toEqual(["air-first", "air-second"]);
  });

  it("removes broken air symlinks and leaves other broken links alone", async () => {
    const testDir = await createTestDirectory();
    const scriptsDir = join(testDir, "scripts");
    const binDir = join(testDir, "bin");
    const publicScriptPath = await writeScriptFile(scriptsDir, "air-first");
    await mkdir(binDir, { recursive: true });
    await symlink(join(testDir, "missing-air-target"), join(binDir, "air-stale"));
    await symlink(join(testDir, "missing-other-target"), join(binDir, "other-stale"));

    const result = await syncPublicScripts({ binDir, scriptsDir, getTimestamp: () => "20260425T000000Z" });

    expect(result).toEqual({
      cleanedBrokenLinks: ["air-stale"],
      linkedScripts: [{ action: "linked", scriptName: "air-first" }],
    });
    expect(await readlink(join(binDir, "air-first"))).toBe(publicScriptPath);
    expect((await readdir(binDir)).sort()).toEqual(["air-first", "other-stale"]);
  });

  it("relinks outdated air symlinks and backs up conflicting files", async () => {
    const testDir = await createTestDirectory();
    const scriptsDir = join(testDir, "scripts");
    const binDir = join(testDir, "bin");
    const firstPublicScriptPath = await writeScriptFile(scriptsDir, "air-first");
    const secondPublicScriptPath = await writeScriptFile(scriptsDir, "air-second");
    const staleScriptPath = join(testDir, "stale-air-first");
    await writeFile(staleScriptPath, "old\n", "utf-8");
    await mkdir(binDir, { recursive: true });
    await symlink(staleScriptPath, join(binDir, "air-first"));
    await writeFile(join(binDir, "air-second"), "existing file\n", "utf-8");

    const result = await syncPublicScripts({ binDir, scriptsDir, getTimestamp: () => "20260425T000000Z" });

    expect(result).toEqual({
      cleanedBrokenLinks: [],
      linkedScripts: [
        { action: "relinked", scriptName: "air-first" },
        {
          action: "backed_up",
          backupPath: join(binDir, "air-second.backup-20260425T000000Z"),
          scriptName: "air-second",
        },
      ],
    });
    expect(await readlink(join(binDir, "air-first"))).toBe(firstPublicScriptPath);
    expect(await readlink(join(binDir, "air-second"))).toBe(secondPublicScriptPath);
    expect(await readFile(join(binDir, "air-second.backup-20260425T000000Z"), "utf-8")).toBe("existing file\n");
  });
});
