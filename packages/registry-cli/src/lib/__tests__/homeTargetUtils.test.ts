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
  it("lists the top-level generated and synced entries of one profile directory", () => {
    const manifest = createGeneratedOutputManifest({
      "claude-code": { kind: "directory" },
      "claude-code/default": { kind: "directory" },
      "claude-code/default/CLAUDE.md": { kind: "file", checksum: "a" },
      "claude-code/default/skills": { kind: "directory" },
      "claude-code/default/skills/review/SKILL.md": { kind: "file", checksum: "b" },
      "claude-code/designer/CLAUDE.md": { kind: "file", checksum: "c" },
      "codex/default/AGENTS.md": { kind: "file", checksum: "d" },
    });
    manifest.syncedFilePaths = ["claude-code/default/settings.json", "codex/default/config.toml"];

    expect(getManagedEntryNames(manifest, "/repo/.output", "/repo/.output/claude-code/default")).toEqual([
      "CLAUDE.md",
      "settings.json",
      "skills",
    ]);
  });

  it("does not match a sibling directory that shares the profile name as a prefix", () => {
    const manifest = createGeneratedOutputManifest({
      "pi/default-extra/models.json": { kind: "file", checksum: "a" },
      "pi/default/models.json": { kind: "file", checksum: "b" },
    });

    expect(getManagedEntryNames(manifest, "/repo/.output", "/repo/.output/pi/default")).toEqual(["models.json"]);
  });
});

describe("applyHomeTarget", () => {
  it("creates a real home and links every managed entry into it", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    await writeTestFile(sourcePath, "CLAUDE.md", "memory\n");
    await writeTestFile(sourcePath, "skills/review/SKILL.md", "# Review\n");
    const homePath = join(root, "home", ".claude");

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Claude Code config (default)" },
      ["CLAUDE.md", "skills"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: ["CLAUDE.md", "skills"], relinked: [], backedUp: [], removed: [], shared: [], diverged: [] });
    expect((await lstat(homePath)).isDirectory()).toBe(true);
    expect(await readlink(join(homePath, "CLAUDE.md"))).toBe(join(sourcePath, "CLAUDE.md"));
    expect(await readFile(join(homePath, "skills", "review", "SKILL.md"), "utf-8")).toBe("# Review\n");
  });

  it("keeps runtime state in the home and only repoints links from another checkout", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "relocated", "default");
    const previousSourcePath = join(root, "original", "default");
    await writeTestFile(sourcePath, "CLAUDE.md", "relocated\n");
    await writeTestFile(previousSourcePath, "CLAUDE.md", "original\n");
    const homePath = join(root, "home");
    await writeTestFile(homePath, "history.jsonl", "{\"display\":\"keep me\"}\n");
    await writeTestFile(homePath, "projects/app/session.jsonl", "transcript\n");
    await symlink(join(previousSourcePath, "CLAUDE.md"), join(homePath, "CLAUDE.md"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Claude Code config (default)" },
      ["CLAUDE.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: [], relinked: ["CLAUDE.md"], backedUp: [], removed: [], shared: [], diverged: [] });
    expect(await readFile(join(homePath, "CLAUDE.md"), "utf-8")).toBe("relocated\n");
    expect(await readFile(join(homePath, "history.jsonl"), "utf-8")).toBe("{\"display\":\"keep me\"}\n");
    expect(await readFile(join(homePath, "projects", "app", "session.jsonl"), "utf-8")).toBe("transcript\n");
  });

  it("leaves links that already point at the generated entry untouched", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home");
    await mkdir(homePath, { recursive: true });
    await symlink(join(sourcePath, "AGENTS.md"), join(homePath, "AGENTS.md"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home (default)" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: [], relinked: [], backedUp: [], removed: [], shared: [], diverged: [] });
  });

  it("backs up a real entry that occupies a managed name before linking it", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    await writeTestFile(sourcePath, "settings.json", "{\"generated\":true}\n");
    const homePath = join(root, "home");
    await writeTestFile(homePath, "settings.json", "{\"local\":true}\n");

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Pi config (default)" },
      ["settings.json"],
      BACKUP_SUFFIX,
    );

    const backupPath = join(homePath, `settings.json.backup-${BACKUP_SUFFIX}`);
    expect(result).toEqual({
      linked: [],
      relinked: [],
      backedUp: [{ name: "settings.json", backupPath }],
      removed: [],
      shared: [],
      diverged: [],
    });
    expect(await readFile(backupPath, "utf-8")).toBe("{\"local\":true}\n");
    expect(await readlink(join(homePath, "settings.json"))).toBe(join(sourcePath, "settings.json"));
  });

  it("removes dangling links into the generated profile while keeping foreign links", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home");
    await mkdir(homePath, { recursive: true });
    await symlink(join(sourcePath, "rules"), join(homePath, "rules"));
    await symlink(join(root, "elsewhere", "missing"), join(homePath, "foreign"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home (default)" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: ["AGENTS.md"], relinked: [], backedUp: [], removed: ["rules"], shared: [], diverged: [] });
    expect((await readdir(homePath)).sort()).toEqual(["AGENTS.md", "foreign"]);
  });

  it("shares the default home's runtime entries with a profile home and reports its own copies as diverged", async () => {
    const root = await createTestDirectory();
    const defaultSourcePath = join(root, "output", "default");
    const sourcePath = join(root, "output", "designer");
    await writeTestFile(defaultSourcePath, "CLAUDE.md", "default memory\n");
    await writeTestFile(sourcePath, "skills/design/SKILL.md", "# Design\n");
    const sharedHomePath = join(root, "home", ".claude");
    await writeTestFile(sharedHomePath, "projects/app/session.jsonl", "transcript\n");
    await writeTestFile(sharedHomePath, "history.jsonl", "shared history\n");
    await writeTestFile(sharedHomePath, "skills/default-only/SKILL.md", "# Default only\n");
    await writeTestFile(sharedHomePath, "settings.json.backup-20261025T120000Z", "{}\n");
    await symlink(join(defaultSourcePath, "CLAUDE.md"), join(sharedHomePath, "CLAUDE.md"));
    const homePath = join(root, "data", "profiles", "designer");
    await writeTestFile(homePath, "history.jsonl", "designer history\n");

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Claude Code profile home (designer)", sharedHomePath },
      ["skills"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({
      linked: ["skills"],
      relinked: [],
      backedUp: [],
      removed: [],
      shared: ["projects"],
      diverged: ["history.jsonl"],
    });
    expect(await readlink(join(homePath, "projects"))).toBe(join(sharedHomePath, "projects"));
    expect(await readFile(join(homePath, "history.jsonl"), "utf-8")).toBe("designer history\n");
    expect(existsSync(join(homePath, "CLAUDE.md"))).toBe(false);
    expect((await readdir(join(homePath, "skills"))).sort()).toEqual(["design"]);
  });

  it("removes a shared link when the default home no longer has the entry", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "designer");
    await writeTestFile(sourcePath, "AGENTS.md", "designer\n");
    const sharedHomePath = join(root, "home", ".codex");
    await mkdir(sharedHomePath, { recursive: true });
    const homePath = join(root, "data", "profiles", "designer");
    await mkdir(homePath, { recursive: true });
    await symlink(join(sharedHomePath, "log"), join(homePath, "log"));

    const result = await applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex profile home (designer)", sharedHomePath },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    );

    expect(result).toEqual({ linked: ["AGENTS.md"], relinked: [], backedUp: [], removed: ["log"], shared: [], diverged: [] });
  });

  it("refuses a home that is still a symlink to a directory", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    await writeTestFile(sourcePath, "AGENTS.md", "agents\n");
    const homePath = join(root, "home", ".codex");
    await mkdir(dirname(homePath), { recursive: true });
    await symlink(sourcePath, homePath);

    await expect(applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home (default)" },
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
      { kind: "home", sourcePath: join(root, "output"), targetPath: homePath, description: "Codex home (default)" },
      ["AGENTS.md"],
      BACKUP_SUFFIX,
    )).rejects.toThrow(`${homePath} exists but is not a directory.`);
  });

  it("refuses to apply a profile the manifest records nothing for", async () => {
    const root = await createTestDirectory();
    const sourcePath = join(root, "output", "default");
    const homePath = join(root, "home");

    await expect(applyHomeTarget(
      { kind: "home", sourcePath, targetPath: homePath, description: "Codex home (default)" },
      [],
      BACKUP_SUFFIX,
    )).rejects.toThrow(`The generated output manifest records no entries for ${sourcePath}. Rebuild before bootstrapping.`);
    expect(existsSync(homePath)).toBe(false);
  });
});
