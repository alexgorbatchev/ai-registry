import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ISkillUsageCountEntry } from "../createSkillUsageReport";
import { getProjectSkillSyncPaths, syncProjectSkills } from "../syncProjectSkills";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const FIXTURE_ROOT = join(REPO_ROOT, ".tmp", "opencode-session-analysis-skill-sync");
const FIXTURE_DIRECTORIES = ["writes-manifest", "reuses-manifest", "detects-drift"];

function createFixtureRoot(fixtureName: string): string {
  const fixturePath = join(FIXTURE_ROOT, fixtureName);
  rmSync(fixturePath, { recursive: true, force: true });
  mkdirSync(fixturePath, { recursive: true });
  return fixturePath;
}

function createSkillSource(rootPath: string, skillName: string, body: string): string {
  const skillDirPath = join(rootPath, skillName);
  mkdirSync(skillDirPath, { recursive: true });
  writeFileSync(join(skillDirPath, "SKILL.md"), body, "utf8");
  return skillDirPath;
}

function readManifest(manifestPath: string): {
  version: number;
  generatedAt: string;
  registryRootPath: string;
  projectRootPath: string;
  selectedSkills: string[];
  files: Record<string, string>;
} {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

afterEach(() => {
  for (const fixtureName of FIXTURE_DIRECTORIES) {
    rmSync(join(FIXTURE_ROOT, fixtureName), { recursive: true, force: true });
  }
});

describe("syncProjectSkills", () => {
  it("copies the selected skills and writes a sync manifest", async () => {
    const fixtureRootPath = createFixtureRoot("writes-manifest");
    const registryRootPath = join(fixtureRootPath, "registry");
    const projectRootPath = join(fixtureRootPath, "project");
    mkdirSync(registryRootPath, { recursive: true });
    mkdirSync(projectRootPath, { recursive: true });

    const availableSkillDirByName = new Map<string, string>([
      ["bun", createSkillSource(join(registryRootPath, "skills"), "bun", "bun skill\n")],
      [
        "readme-writer",
        createSkillSource(join(registryRootPath, "skills"), "readme-writer", "readme skill\n"),
      ],
    ]);
    const usedSkills: ISkillUsageCountEntry[] = [
      { name: "bun", count: 2, averagePerDay: 2 },
      { name: "readme-writer", count: 1, averagePerDay: 1 },
      { name: "missing-skill", count: 1, averagePerDay: 1 },
    ];

    const result = await syncProjectSkills({
      availableSkillDirByName,
      autoConfirm: false,
      confirmOverwrite: async () => true,
      isInteractive: true,
      pickSkills: async () => ["readme-writer"],
      projectRootPath,
      promptForSelection: true,
      registryRootPath,
      usedSkills,
    });

    const { manifestPath, skillsDirPath } = getProjectSkillSyncPaths(projectRootPath);
    const manifest = readManifest(manifestPath);

    expect(result).toEqual({
      manifestPath,
      selectedSkills: ["readme-writer"],
      skillsDirPath,
      warningMessages: ["Used skills not found in the registry and skipped: missing-skill."],
    });
    expect(readFileSync(join(skillsDirPath, "readme-writer", "SKILL.md"), "utf8")).toBe("readme skill\n");
    expect(existsSync(join(skillsDirPath, "bun"))).toBe(false);
    expect(manifest.version).toBe(1);
    expect(manifest.registryRootPath).toBe(registryRootPath);
    expect(manifest.projectRootPath).toBe(projectRootPath);
    expect(manifest.selectedSkills).toEqual(["readme-writer"]);
    expect(Object.keys(manifest.files)).toEqual(["skills/readme-writer/SKILL.md"]);
    expect(manifest.files["skills/readme-writer/SKILL.md"]?.length).toBe(64);
    expect(manifest.generatedAt.length).toBeGreaterThan(0);
  });

  it("reuses the saved manifest selection and warns about newly used unsynced skills", async () => {
    const fixtureRootPath = createFixtureRoot("reuses-manifest");
    const registryRootPath = join(fixtureRootPath, "registry");
    const projectRootPath = join(fixtureRootPath, "project");
    mkdirSync(registryRootPath, { recursive: true });
    mkdirSync(projectRootPath, { recursive: true });

    const availableSkillDirByName = new Map<string, string>([
      ["bun", createSkillSource(join(registryRootPath, "skills"), "bun", "bun skill\n")],
      [
        "readme-writer",
        createSkillSource(join(registryRootPath, "skills"), "readme-writer", "readme skill\n"),
      ],
    ]);

    await syncProjectSkills({
      availableSkillDirByName,
      autoConfirm: false,
      confirmOverwrite: async () => true,
      isInteractive: true,
      pickSkills: async () => ["bun"],
      projectRootPath,
      promptForSelection: true,
      registryRootPath,
      usedSkills: [{ name: "bun", count: 1, averagePerDay: 1 }],
    });

    const result = await syncProjectSkills({
      availableSkillDirByName,
      autoConfirm: false,
      isInteractive: false,
      projectRootPath,
      promptForSelection: false,
      registryRootPath,
      usedSkills: [
        { name: "bun", count: 2, averagePerDay: 2 },
        { name: "readme-writer", count: 1, averagePerDay: 1 },
      ],
    });

    const { skillsDirPath } = getProjectSkillSyncPaths(projectRootPath);

    expect(readFileSync(join(skillsDirPath, "bun", "SKILL.md"), "utf8")).toBe("bun skill\n");
    expect(existsSync(join(skillsDirPath, "readme-writer"))).toBe(false);
    expect(result.warningMessages).toEqual([
      "New used skills are available but not included in the saved manifest: readme-writer. Re-run with --pick to update the selection.",
    ]);
  });

  it("fails when managed files drift and no overwrite confirmation is available", async () => {
    const fixtureRootPath = createFixtureRoot("detects-drift");
    const registryRootPath = join(fixtureRootPath, "registry");
    const projectRootPath = join(fixtureRootPath, "project");
    mkdirSync(registryRootPath, { recursive: true });
    mkdirSync(projectRootPath, { recursive: true });

    const availableSkillDirByName = new Map<string, string>([
      ["bun", createSkillSource(join(registryRootPath, "skills"), "bun", "bun skill\n")],
    ]);

    await syncProjectSkills({
      availableSkillDirByName,
      autoConfirm: false,
      confirmOverwrite: async () => true,
      isInteractive: true,
      pickSkills: async () => ["bun"],
      projectRootPath,
      promptForSelection: true,
      registryRootPath,
      usedSkills: [{ name: "bun", count: 1, averagePerDay: 1 }],
    });

    const { skillsDirPath } = getProjectSkillSyncPaths(projectRootPath);
    writeFileSync(join(skillsDirPath, "bun", "SKILL.md"), "locally modified\n", "utf8");

    await expect(
      syncProjectSkills({
        availableSkillDirByName,
        autoConfirm: false,
        isInteractive: false,
        projectRootPath,
        promptForSelection: false,
        registryRootPath,
        usedSkills: [{ name: "bun", count: 1, averagePerDay: 1 }],
      }),
    ).rejects.toThrow(
      "Skill sync cancelled. Managed .opencode skill files were modified and no interactive confirmation is available. Re-run with --yes to overwrite them.",
    );
  });
});
