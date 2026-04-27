import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { readSyncableSkillSources } from "../readSyncableSkillSources";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const FIXTURE_ROOT = join(REPO_ROOT, ".tmp", "opencode-session-analysis-skill-sources");
const FIXTURE_DIRECTORIES = ["discovers-sources", "duplicate-sources"];

function createFixtureRoot(fixtureName: string): string {
  const fixturePath = join(FIXTURE_ROOT, fixtureName);
  rmSync(fixturePath, { recursive: true, force: true });
  mkdirSync(fixturePath, { recursive: true });
  return fixturePath;
}

function writeSkill(registryRootPath: string, relativeSkillPath: string, content: string): void {
  const skillDirPath = join(registryRootPath, relativeSkillPath);
  mkdirSync(skillDirPath, { recursive: true });
  writeFileSync(join(skillDirPath, "SKILL.md"), content, "utf8");
}

afterEach(() => {
  for (const fixtureName of FIXTURE_DIRECTORIES) {
    rmSync(join(FIXTURE_ROOT, fixtureName), { recursive: true, force: true });
  }
});

describe("readSyncableSkillSources", () => {
  it("discovers registry, harness, and profile-local skills", async () => {
    const registryRootPath = createFixtureRoot("discovers-sources");
    writeSkill(registryRootPath, "skills/bun", "---\nname: bun\ndescription: bun\n---\n");
    writeSkill(
      registryRootPath,
      "harnesses/opencode/skills/opencode-config",
      "---\nname: opencode-config\ndescription: config\n---\n",
    );
    writeSkill(
      registryRootPath,
      "profiles/developer/skills/project-local",
      "---\nname: project-local\ndescription: local\n---\n",
    );

    const sources = await readSyncableSkillSources(registryRootPath);

    expect([...sources.entries()].sort(([leftName], [rightName]) => leftName.localeCompare(rightName))).toEqual([
      [
        "bun",
        {
          name: "bun",
          sourceDirPath: join(registryRootPath, "skills", "bun"),
          sourceKind: "registry",
          owner: "skills",
        },
      ],
      [
        "opencode-config",
        {
          name: "opencode-config",
          sourceDirPath: join(registryRootPath, "harnesses", "opencode", "skills", "opencode-config"),
          sourceKind: "harness",
          owner: "harnesses/opencode",
        },
      ],
      [
        "project-local",
        {
          name: "project-local",
          sourceDirPath: join(registryRootPath, "profiles", "developer", "skills", "project-local"),
          sourceKind: "profile-local",
          owner: "developer",
        },
      ],
    ]);
  });

  it("rejects duplicate skill names across sources", async () => {
    const registryRootPath = createFixtureRoot("duplicate-sources");
    writeSkill(registryRootPath, "skills/bun", "---\nname: bun\ndescription: bun\n---\n");
    writeSkill(
      registryRootPath,
      "profiles/developer/skills/bun",
      "---\nname: bun\ndescription: duplicated bun\n---\n",
    );

    await expect(readSyncableSkillSources(registryRootPath)).rejects.toThrow(
      "Duplicate syncable skill name bun found in developer and skills",
    );
  });
});
