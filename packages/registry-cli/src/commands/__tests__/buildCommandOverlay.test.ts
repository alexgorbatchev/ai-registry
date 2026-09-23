import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import { buildCommand } from "../buildCommand";
import { type IRegistryPaths } from "../../lib/getRegistryPaths";

describe("buildCommand with overlay", () => {
  let tempDir: string;
  let repoRoot: string;
  let overlayDir: string;
  let registryPaths: IRegistryPaths;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(homedir(), ".tmp-build-overlay-test-"));
    repoRoot = join(tempDir, "repo");
    overlayDir = join(tempDir, "overlay");

    await mkdir(join(repoRoot, "skills", "base-skill"), { recursive: true });
    await writeFile(join(repoRoot, "skills", "base-skill", "SKILL.md"), "---\nname: base-skill\n---\n# Base Skill\n");

    await mkdir(join(repoRoot, "commands"), { recursive: true });
    await writeFile(join(repoRoot, "commands", "base-cmd.md"), "# Base Command\n");

    await mkdir(join(repoRoot, "profiles", "default"), { recursive: true });
    await writeFile(
      join(repoRoot, "profiles", "default", "profile.yaml"),
      "description: default profile\nskills:\n  - '*'\ncommands:\n  - '*'\nsystem_prompt: 'Base prompt'\n",
    );

    // Use real harnesses from repo
    const realHarnessesDir = join(process.cwd(), "harnesses");

    // Overlay structure
    await mkdir(join(overlayDir, "skills", "work-skill"), { recursive: true });
    await writeFile(join(overlayDir, "skills", "work-skill", "SKILL.md"), "---\nname: work-skill\n---\n# Work Skill\n");

    await mkdir(join(overlayDir, "commands"), { recursive: true });
    await writeFile(join(overlayDir, "commands", "work-cmd.md"), "# Work Command\n");

    await mkdir(join(overlayDir, "profiles", "work"), { recursive: true });
    await writeFile(
      join(overlayDir, "profiles", "work", "profile.yaml"),
      "description: work profile\nskills:\n  - '*'\ncommands:\n  - '*'\nsystem_prompt: 'Work prompt'\n",
    );

    registryPaths = {
      root: repoRoot,
      overlay: overlayDir,
      harnesses: realHarnessesDir,
      skills: join(repoRoot, "skills"),
      commands: join(repoRoot, "commands"),
      profiles: join(repoRoot, "profiles"),
      output: join(repoRoot, ".output"),
      temp: join(repoRoot, ".tmp"),
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds outputs combining base assets and overlay assets", async () => {
    await buildCommand({
      hasAutoConfirm: true,
      registryPaths,
    });

    const outputDir = registryPaths.output;

    // OpenCode staging should include both base-skill and work-skill
    expect(existsSync(join(outputDir, "opencode", "skills", "base-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(join(outputDir, "opencode", "skills", "work-skill", "SKILL.md"))).toBe(true);

    // OpenCode commands should include both
    expect(existsSync(join(outputDir, "opencode", "commands", "base-cmd.md"))).toBe(true);
    expect(existsSync(join(outputDir, "opencode", "commands", "work-cmd.md"))).toBe(true);

    // OpenCode agents should include default and work
    expect(existsSync(join(outputDir, "opencode", "agents", "default.md"))).toBe(true);
    expect(existsSync(join(outputDir, "opencode", "agents", "work.md"))).toBe(true);

    // Pi output should have generated the work profile
    expect(existsSync(join(outputDir, "pi", "work"))).toBe(true);
    expect(existsSync(join(outputDir, "pi", "work", "skills", "work-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(join(outputDir, "pi", "work", "skills", "base-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(join(outputDir, "bin", "pi-work"))).toBe(true);

    // Manifest should exist
    expect(existsSync(join(outputDir, "manifest.json"))).toBe(true);
  });
});
