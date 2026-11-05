import { factory_testDirectory } from "./fixtures";
import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readSyncableSkillSources } from "../readSyncableSkillSources";

function writeSkill(registryRootPath: string, relativeSkillPath: string, content: string): void {
  const skillDirPath = join(registryRootPath, relativeSkillPath);
  mkdirSync(skillDirPath, { recursive: true });
  writeFileSync(join(skillDirPath, "SKILL.md"), content, "utf8");
}

describe("readSyncableSkillSources", () => {
  it("discovers registry and harness skills", async () => {
    const registryRootPath = factory_testDirectory("discovers-sources");
    writeSkill(registryRootPath, "skills/bun", "---\nname: bun\ndescription: bun\n---\n");
    writeSkill(
      registryRootPath,
      "harnesses/opencode/skills/opencode-config",
      "---\nname: opencode-config\ndescription: config\n---\n",
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
    ]);
  });

  it("rejects duplicate skill names across sources", async () => {
    const registryRootPath = factory_testDirectory("duplicate-sources");
    writeSkill(registryRootPath, "skills/bun", "---\nname: bun\ndescription: bun\n---\n");
    writeSkill(registryRootPath, "harnesses/opencode/skills/bun", "---\nname: bun\ndescription: duplicated bun\n---\n");

    await expect(readSyncableSkillSources(registryRootPath)).rejects.toThrow(
      "Duplicate syncable skill name bun found in harnesses/opencode and skills",
    );
  });

  it("discovers skills grouped into agent and user subdirectories", async () => {
    const registryRootPath = factory_testDirectory("discovers-sources");
    writeSkill(registryRootPath, "skills/agent/bun", "---\nname: bun\ndescription: bun\n---\n");
    writeSkill(
      registryRootPath,
      "skills/user/continue-session",
      "---\nname: continue-session\ndescription: continue\n---\n",
    );

    const sources = await readSyncableSkillSources(registryRootPath);

    expect([...sources.entries()].sort(([leftName], [rightName]) => leftName.localeCompare(rightName))).toEqual([
      [
        "bun",
        {
          name: "bun",
          sourceDirPath: join(registryRootPath, "skills", "agent", "bun"),
          sourceKind: "registry",
          owner: "skills",
        },
      ],
      [
        "continue-session",
        {
          name: "continue-session",
          sourceDirPath: join(registryRootPath, "skills", "user", "continue-session"),
          sourceKind: "registry",
          owner: "skills",
        },
      ],
    ]);
  });
});
