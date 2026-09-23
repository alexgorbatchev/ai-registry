import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import {
  discoverProfiles,
  resolveMatchedAssets,
  type IDiscoveredProfile,
} from "../resolveRegistryAssets";

describe("resolveRegistryAssets", () => {
  let tempDir: string;
  let baseDir: string;
  let overlayDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(homedir(), ".tmp-registry-assets-test-"));
    baseDir = join(tempDir, "base");
    overlayDir = join(tempDir, "overlay");
    await mkdir(baseDir, { recursive: true });
    await mkdir(overlayDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("discoverProfiles", () => {
    it("discovers profiles from base directory", async () => {
      const baseProfiles = join(baseDir, "profiles");
      await mkdir(join(baseProfiles, "developer"), { recursive: true });
      await writeFile(join(baseProfiles, "developer", "profile.yaml"), "description: dev");

      await mkdir(join(baseProfiles, "designer"), { recursive: true });
      await writeFile(join(baseProfiles, "designer", "profile.json"), "{}");

      // Non-profile directory should be ignored
      await mkdir(join(baseProfiles, "not-a-profile"), { recursive: true });

      const profiles = await discoverProfiles(baseProfiles);
      expect(profiles).toHaveLength(2);
      expect(profiles.map((p) => p.profileName).sort()).toEqual(["designer", "developer"]);
      expect(profiles.find((p) => p.profileName === "developer")?.isOverlay).toBe(false);
    });

    it("merges overlay profiles and overrides base profiles on collision", async () => {
      const baseProfiles = join(baseDir, "profiles");
      const overlayProfiles = join(overlayDir, "profiles");

      await mkdir(join(baseProfiles, "developer"), { recursive: true });
      await writeFile(join(baseProfiles, "developer", "profile.yaml"), "description: base dev");

      await mkdir(join(baseProfiles, "designer"), { recursive: true });
      await writeFile(join(baseProfiles, "designer", "profile.yaml"), "description: base designer");

      // Overlay overrides developer and adds work
      await mkdir(join(overlayProfiles, "developer"), { recursive: true });
      await writeFile(join(overlayProfiles, "developer", "profile.yaml"), "description: overlay dev");

      await mkdir(join(overlayProfiles, "work"), { recursive: true });
      await writeFile(join(overlayProfiles, "work", "profile.yaml"), "description: overlay work");

      const profiles = await discoverProfiles(baseProfiles, overlayProfiles);
      expect(profiles).toHaveLength(3);
      expect(profiles.map((p) => p.profileName).sort()).toEqual(["designer", "developer", "work"]);

      const devProfile = profiles.find((p) => p.profileName === "developer");
      expect(devProfile?.isOverlay).toBe(true);
      expect(devProfile?.profileDir).toBe(join(overlayProfiles, "developer"));

      const workProfile = profiles.find((p) => p.profileName === "work");
      expect(workProfile?.isOverlay).toBe(true);
      expect(workProfile?.profileDir).toBe(join(overlayProfiles, "work"));

      const designerProfile = profiles.find((p) => p.profileName === "designer");
      expect(designerProfile?.isOverlay).toBe(false);
      expect(designerProfile?.profileDir).toBe(join(baseProfiles, "designer"));
    });

    it("handles null or non-existent overlay profiles directory gracefully", async () => {
      const baseProfiles = join(baseDir, "profiles");
      await mkdir(join(baseProfiles, "default"), { recursive: true });
      await writeFile(join(baseProfiles, "default", "profile.yaml"), "description: default");

      const profilesFromNull = await discoverProfiles(baseProfiles, null);
      expect(profilesFromNull).toHaveLength(1);

      const profilesFromMissing = await discoverProfiles(baseProfiles, join(overlayDir, "missing-profiles"));
      expect(profilesFromMissing).toHaveLength(1);
    });
  });

  describe("resolveMatchedAssets", () => {
    it("returns empty matches when patterns array is empty", async () => {
      const baseSkills = join(baseDir, "skills");
      await mkdir(join(baseSkills, "skill-a"), { recursive: true });

      const result = await resolveMatchedAssets([], baseSkills);
      expect(result.matchedNames).toEqual([]);
      expect(result.sourcePaths).toEqual({});
    });

    it("resolves matched assets from base directory", async () => {
      const baseSkills = join(baseDir, "skills");
      await mkdir(join(baseSkills, "skill-a"), { recursive: true });
      await mkdir(join(baseSkills, "skill-b"), { recursive: true });
      await mkdir(join(baseSkills, "other"), { recursive: true });

      const result = await resolveMatchedAssets(["skill-*"], baseSkills);
      expect(result.matchedNames).toEqual(["skill-a", "skill-b"]);
      expect(result.sourcePaths["skill-a"]).toBe(join(baseSkills, "skill-a"));
      expect(result.sourcePaths["skill-b"]).toBe(join(baseSkills, "skill-b"));
    });

    it("resolves matched assets from base and overlay, overriding collisions with overlay", async () => {
      const baseSkills = join(baseDir, "skills");
      const overlaySkills = join(overlayDir, "skills");

      await mkdir(join(baseSkills, "shared-skill"), { recursive: true });
      await mkdir(join(baseSkills, "base-only-skill"), { recursive: true });

      await mkdir(join(overlaySkills, "shared-skill"), { recursive: true });
      await mkdir(join(overlaySkills, "overlay-only-skill"), { recursive: true });

      const result = await resolveMatchedAssets(["*"], baseSkills, overlaySkills);
      expect(result.matchedNames).toEqual(["base-only-skill", "overlay-only-skill", "shared-skill"]);
      expect(result.sourcePaths["base-only-skill"]).toBe(join(baseSkills, "base-only-skill"));
      expect(result.sourcePaths["overlay-only-skill"]).toBe(join(overlaySkills, "overlay-only-skill"));
      // Overlay overrides base for collision:
      expect(result.sourcePaths["shared-skill"]).toBe(join(overlaySkills, "shared-skill"));
    });

    it("handles null or non-existent overlay directory gracefully", async () => {
      const baseCommands = join(baseDir, "commands");
      await mkdir(baseCommands, { recursive: true });
      await writeFile(join(baseCommands, "cmd-a.md"), "cmd a");

      const resultWithNull = await resolveMatchedAssets(["*.md"], baseCommands, null);
      expect(resultWithNull.matchedNames).toEqual(["cmd-a.md"]);

      const resultWithMissing = await resolveMatchedAssets(
        ["*.md"],
        baseCommands,
        join(overlayDir, "non-existent-commands"),
      );
      expect(resultWithMissing.matchedNames).toEqual(["cmd-a.md"]);
    });
  });
});
