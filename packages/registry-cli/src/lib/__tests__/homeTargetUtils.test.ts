import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { createGeneratedOutputManifest } from "../generatedOutputUtils";
import { applyHomeTarget, getManagedEntryNames } from "../homeTargetUtils";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "home-target-utils-tests");
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

describe("getManagedEntryNames", () => {
  it("lists the top-level generated and synced entries of one harness output directory", () => {
    const manifest = createGeneratedOutputManifest({
      "claude-code": { kind: "directory" },
      "claude-code/CLAUDE.md": { kind: "file", checksum: "a" },
      "claude-code/skills": { kind: "directory" },
      "claude-code/skills/review/SKILL.md": { kind: "file", checksum: "b" },
      "codex/AGENTS.md": { kind: "file", checksum: "d" },
    });
    manifest.syncedFilePaths = ["claude-code/settings.json", "codex/config.toml"];

    expect(getManagedEntryNames(manifest, "/repo/.output", "/repo/.output/claude-code")).toEqual([
      "CLAUDE.md",
      "settings.json",
      "skills",
    ]);
  });

  it("does not match a sibling directory that shares the harness name as a prefix", () => {
    const manifest = createGeneratedOutputManifest({
      "pi-extra/models.json": { kind: "file", checksum: "a" },
      "pi/models.json": { kind: "file", checksum: "b" },
    });

    expect(getManagedEntryNames(manifest, "/repo/.output", "/repo/.output/pi")).toEqual(["models.json"]);
  });
});

describe("applyHomeTarget", () => {
  it("creates a real home and links every managed entry into it", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    await writeTestFile(sourcePath, "CLAUDE.md", "memory\n");
    await writeTestFile(sourcePath, "skills/review/SKILL.md", "# Review\n");
    const homePath = join(root, "home", ".claude");

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Claude Code config" },
      ["CLAUDE.md", "skills"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: ["CLAUDE.md", "skills"], relinked: [], backedUp: [], removed: [] });
    expect((await lstat(homePath)).isDirectory()).toBe(true);
    expect(await readlink(join(homePath, "CLAUDE.md"))).toBe(join(sourcePath, "CLAUDE.md"));
    expect(await readFile(join(homePath, "skills", "review", "SKILL.md"), "utf-8")).toBe("# Review\n");
  });

  it("keeps runtime state in the home and only repoints links from another checkout", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "relocated", "harness");
    const previousSourcePath = join(root, "original", "harness");
    await writeTestFile(sourcePath, "CLAUDE.md", "relocated\n");
    await writeTestFile(previousSourcePath, "CLAUDE.md", "original\n");
    const homePath = join(root, "home");
    await writeTestFile(homePath, "history.jsonl", "{\"display\":\"keep me\"}\n");
    await writeTestFile(homePath, "projects/app/session.jsonl", "transcript\n");
    await symlink(join(previousSourcePath, "CLAUDE.md"), join(homePath, "CLAUDE.md"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Claude Code config" },
      ["CLAUDE.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: [], relinked: ["CLAUDE.md"], backedUp: [], removed: [] });
    expect(await readFile(join(homePath, "CLAUDE.md"), "utf-8")).toBe("relocated\n");
    expect(await readFile(join(homePath, "history.jsonl"), "utf-8")).toBe("{\"display\":\"keep me\"}\n");
    expect(await readFile(join(homePath, "projects", "app", "session.jsonl"), "utf-8")).toBe("transcript\n");
  });

  it("leaves links that already point at the generated entry untouched", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home");
    await mkdir(homePath, { recursive: true });
    await symlink(join(sourcePath, "AGENTS.md"), join(homePath, "AGENTS.md"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: [], relinked: [], backedUp: [], removed: [] });
  });

  it("backs up a real entry that occupies a managed name before linking it", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    await writeTestFile(sourcePath, "settings.json", "{\"generated\":true}\n");
    const homePath = join(root, "home");
    await writeTestFile(homePath, "settings.json", "{\"local\":true}\n");

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Pi config" },
      ["settings.json"],
      BACKUP_SUFFIX,
    );

    const backupPath = join(homePath, `settings.json.backup-${BACKUP_SUFFIX}`);
    expect(result).toEqual({
      linked: [],
      relinked: [],
      backedUp: [{ name: "settings.json", backupPath }],
      removed: [],
    });
    expect(await readFile(backupPath, "utf-8")).toBe("{\"local\":true}\n");
    expect(await readlink(join(homePath, "settings.json"))).toBe(join(sourcePath, "settings.json"));
  });

  it("removes dangling links into the generated output while keeping foreign links", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home");
    await mkdir(homePath, { recursive: true });
    await symlink(join(sourcePath, "rules"), join(homePath, "rules"));
    await symlink(join(root, "elsewhere", "missing"), join(homePath, "foreign"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: ["AGENTS.md"], relinked: [], backedUp: [], removed: ["rules"] });
    expect((await readdir(homePath)).sort()).toEqual(["AGENTS.md", "foreign"]);
  });

  it("refuses a home that is still a symlink to a directory", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home", ".codex");
    await mkdir(dirname(homePath), { recursive: true });
    await symlink(sourcePath, homePath);

    await expect(applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    )).rejects.toThrow(
      `${homePath} is a symlink to ${sourcePath}. Harness homes are real directories that keep runtime state outside the registry; move the state it points at into a real directory at ${homePath}, then rerun bootstrap.`,
    );
    expect(await readlink(homePath)).toBe(sourcePath);
  });

  it("refuses a home path that is a file", async () => {
    const root = await createTestDirectory();
    const homePath = await writeTestFile(root, "home/.codex", "not a directory\n");

    await expect(applyHomeTarget(
      { kind: "home", sourcePath: join(root, "output"), targetPath: homePath, description: "Codex home" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    )).rejects.toThrow(`${homePath} exists but is not a directory.`);
  });

  it("refuses to apply an output the manifest records nothing for", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "harness");
    const homePath = join(root, "home");

    await expect(applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home" },
      [],
      BACKUP_SUFFIX,
    )).rejects.toThrow(`The generated output manifest records no entries for ${sourcePath}. Rebuild before bootstrapping.`);
    expect(existsSync(homePath)).toBe(false);
  });
});
