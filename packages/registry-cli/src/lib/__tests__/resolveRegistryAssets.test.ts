import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import { resolveRegistryAssets } from "../resolveRegistryAssets";

describe("resolveRegistryAssets", () => {
  let tempDir: string;
  let baseDir: string;
  let overlayDir: string;

  beforeEach(async () => {
    await mkdir(join(import.meta.dir, "..", ".tmp"), { recursive: true });
    tempDir = await mkdtemp(join(import.meta.dir, "..", ".tmp", "registry-assets-test-"));
    baseDir = join(tempDir, "base");
    overlayDir = join(tempDir, "overlay");
    await mkdir(baseDir, { recursive: true });
    await mkdir(overlayDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("selects the last overlay bundle and reports each distinct conflict", async () => {
    const baseSkills = join(baseDir, "skills");
    const first = join(overlayDir, "first");
    const last = join(overlayDir, "last");
    await mkdir(join(baseSkills, "agent", "shared"), { recursive: true });
    await mkdir(join(first, "user", "shared"), { recursive: true });
    await mkdir(join(last, "shared"), { recursive: true });

    const result = await resolveRegistryAssets(baseSkills, [first, last]);

    expect(result.sourcePaths).toEqual({ shared: join(last, "shared") });
    expect(Array.from(result.userSkillNames)).toEqual([]);
    expect(result.conflicts).toEqual([
      {
        name: "shared",
        previousSource: join(baseSkills, "agent", "shared"),
        selectedSource: join(first, "user", "shared"),
      },
      { name: "shared", previousSource: join(first, "user", "shared"), selectedSource: join(last, "shared") },
    ]);
  });

  it("collects every command file and selects the last overlay copy", async () => {
    const first = join(overlayDir, "first");
    const last = join(overlayDir, "last");
    await Bun.write(join(baseDir, "commands", "shared.md"), "base");
    await Bun.write(join(baseDir, "commands", "base-only.md"), "base only");
    await Bun.write(join(baseDir, "commands", ".hidden.md"), "hidden");
    await Bun.write(join(first, "commands", "shared.md"), "first");
    await Bun.write(join(last, "commands", "shared.md"), "last");

    const result = await resolveRegistryAssets(join(baseDir, "commands"), [
      join(first, "commands"),
      join(last, "commands"),
    ]);

    expect(result.names).toEqual(["base-only.md", "shared.md"]);
    expect(await Bun.file(result.sourcePaths["shared.md"]!).text()).toBe("last");
    expect(result.conflicts.map((conflict) => conflict.selectedSource)).toEqual([
      join(first, "commands", "shared.md"),
      join(last, "commands", "shared.md"),
    ]);
  });

  it("collects base and overlay skills, overriding collisions with the overlay", async () => {
    const baseSkills = join(baseDir, "skills");
    const overlaySkills = join(overlayDir, "skills");
    await mkdir(join(baseSkills, "shared-skill"), { recursive: true });
    await mkdir(join(baseSkills, "base-only-skill"), { recursive: true });
    await mkdir(join(overlaySkills, "shared-skill"), { recursive: true });
    await mkdir(join(overlaySkills, "overlay-only-skill"), { recursive: true });

    const result = await resolveRegistryAssets(baseSkills, [overlaySkills]);

    expect(result.names).toEqual(["base-only-skill", "overlay-only-skill", "shared-skill"]);
    expect(result.sourcePaths["base-only-skill"]).toBe(join(baseSkills, "base-only-skill"));
    expect(result.sourcePaths["overlay-only-skill"]).toBe(join(overlaySkills, "overlay-only-skill"));
    expect(result.sourcePaths["shared-skill"]).toBe(join(overlaySkills, "shared-skill"));
  });

  it("ignores missing base and overlay directories", async () => {
    const baseCommands = join(baseDir, "commands");
    await mkdir(baseCommands, { recursive: true });
    await writeFile(join(baseCommands, "cmd-a.md"), "cmd a");

    const withMissingOverlay = await resolveRegistryAssets(baseCommands, [join(overlayDir, "non-existent-commands")]);
    expect(withMissingOverlay.names).toEqual(["cmd-a.md"]);

    const withMissingBase = await resolveRegistryAssets(join(baseDir, "missing"), [baseCommands]);
    expect(withMissingBase.names).toEqual(["cmd-a.md"]);
  });

  it("collects grouped and flat skill directories while ignoring root guidance files", async () => {
    const baseSkills = join(baseDir, "skills");
    await mkdir(join(baseSkills, "agent", "bun"), { recursive: true });
    await mkdir(join(baseSkills, "agent", "typescript"), { recursive: true });
    await mkdir(join(baseSkills, "user", "continue-session"), { recursive: true });
    await mkdir(join(baseSkills, "flat-skill"), { recursive: true });
    await mkdir(join(baseSkills, "agent", ".scratch"), { recursive: true });
    await Bun.write(join(baseSkills, "AGENTS.md"), "# Skill authoring guidance");
    await Bun.write(join(baseSkills, "README.md"), "# Skills");

    const result = await resolveRegistryAssets(baseSkills);

    expect(result.names).toEqual(["bun", "continue-session", "flat-skill", "typescript"]);
    expect(result.sourcePaths["flat-skill"]).toBe(join(baseSkills, "flat-skill"));
    expect(result.sourcePaths["bun"]).toBe(join(baseSkills, "agent", "bun"));
    expect(result.sourcePaths["continue-session"]).toBe(join(baseSkills, "user", "continue-session"));
    expect(Array.from(result.userSkillNames)).toEqual(["continue-session"]);
  });

  it("merges a flat overlay with grouped base skills without treating its files as skills", async () => {
    const baseSkills = join(baseDir, "skills");
    const overlaySkills = join(overlayDir, "skills");
    await mkdir(join(baseSkills, "agent", "base-skill"), { recursive: true });
    await mkdir(join(overlaySkills, "overlay-flat-skill"), { recursive: true });
    await Bun.write(join(overlaySkills, "AGENTS.md"), "# Overlay skill authoring guidance");

    const result = await resolveRegistryAssets(baseSkills, [overlaySkills]);

    expect(result.names).toEqual(["base-skill", "overlay-flat-skill"]);
    expect(result.sourcePaths["overlay-flat-skill"]).toBe(join(overlaySkills, "overlay-flat-skill"));
  });

  it("throws when the same skill name exists in both agent and user", async () => {
    const baseSkills = join(baseDir, "skills");
    await mkdir(join(baseSkills, "agent", "duplicate-skill"), { recursive: true });
    await mkdir(join(baseSkills, "user", "duplicate-skill"), { recursive: true });

    await expect(resolveRegistryAssets(baseSkills)).rejects.toThrow(
      'Duplicate skill name "duplicate-skill" found in both agent and user',
    );
  });

  it("takes the user flag from the overlay bundle that replaces a grouped skill", async () => {
    const baseSkills = join(baseDir, "skills");
    const overlaySkills = join(overlayDir, "skills");
    await mkdir(join(baseSkills, "agent", "shared-skill"), { recursive: true });
    await mkdir(join(baseSkills, "user", "base-user-skill"), { recursive: true });
    await mkdir(join(baseSkills, "user", "demoted-skill"), { recursive: true });
    await mkdir(join(overlaySkills, "user", "shared-skill"), { recursive: true });
    await mkdir(join(overlaySkills, "agent", "demoted-skill"), { recursive: true });

    const result = await resolveRegistryAssets(baseSkills, [overlaySkills]);

    expect(result.names).toEqual(["base-user-skill", "demoted-skill", "shared-skill"]);
    expect(result.sourcePaths["shared-skill"]).toBe(join(overlaySkills, "user", "shared-skill"));
    expect(Array.from(result.userSkillNames).sort()).toEqual(["base-user-skill", "shared-skill"]);
  });
});
