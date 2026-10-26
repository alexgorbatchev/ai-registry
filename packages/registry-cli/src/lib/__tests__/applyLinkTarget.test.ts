import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { applyLinkTarget } from "../applyLinkTarget";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "apply-link-target-tests");
const BACKUP_SUFFIX = "20261026T000000Z";
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

async function writeTestFile(rootDir: string, relativePath: string, content: string): Promise<string> {
  const filePath = join(rootDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("applyLinkTarget", () => {
  it("links a missing target, creating its parent directory", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "output/pi/default/web-search.json", "{}\n");
    const targetPath = join(root, "home", ".pi", "web-search.json");

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "linked" });
    expect(await readlink(targetPath)).toBe(sourcePath);
  });

  it("reuses an absolute link that already points at the source", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "output/pi/default/web-search.json", "{}\n");
    const targetPath = join(root, "home", "web-search.json");
    await mkdir(dirname(targetPath), { recursive: true });
    await symlink(sourcePath, targetPath);

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "unchanged" });
  });

  it("reuses a relative link that already points at the source", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "output/web-search.json", "{}\n");
    const targetPath = join(root, "home", "web-search.json");
    await mkdir(dirname(targetPath), { recursive: true });
    await symlink("../output/web-search.json", targetPath);

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "unchanged" });
  });

  it("repoints a link from another checkout", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "relocated/web-search.json", "relocated\n");
    const previousSourcePath = await writeTestFile(root, "original/web-search.json", "original\n");
    const targetPath = join(root, "home", "web-search.json");
    await mkdir(dirname(targetPath), { recursive: true });
    await symlink(previousSourcePath, targetPath);

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "relinked" });
    expect(await readFile(targetPath, "utf-8")).toBe("relocated\n");
  });

  it("repoints a dangling link", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "output/web-search.json", "generated\n");
    const targetPath = join(root, "home", "web-search.json");
    await mkdir(dirname(targetPath), { recursive: true });
    await symlink(join(root, "removed-checkout", "web-search.json"), targetPath);

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "relinked" });
    expect(await readFile(targetPath, "utf-8")).toBe("generated\n");
  });

  it("backs up a real file before linking over it", async () => {
    const root = await createTestDirectory();
    const sourcePath = await writeTestFile(root, "output/web-search.json", "generated\n");
    const targetPath = await writeTestFile(root, "home/web-search.json", "local\n");
    const backupPath = `${targetPath}.backup-${BACKUP_SUFFIX}`;

    expect(await applyLinkTarget({ kind: "link", sourcePath, targetPath, description: "Pi web search config" }, BACKUP_SUFFIX))
      .toEqual({ action: "backed_up", backupPath });
    expect(await readFile(backupPath, "utf-8")).toBe("local\n");
    expect(await readlink(targetPath)).toBe(sourcePath);
  });
});
