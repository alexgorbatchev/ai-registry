import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

import { buildCommand } from "../buildCommand";
import { type IRegistryPaths } from "../../lib/getRegistryPaths";

const TEST_ROOT = join(import.meta.dir, "..", "..", "..", "..", "..", ".tmp", "build-overlay-tests");

describe("buildCommand with overlay", () => {
  let tempDir: string;
  let repoRoot: string;
  let overlayDir: string;
  let registryPaths: IRegistryPaths;

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
    tempDir = await mkdtemp(join(TEST_ROOT, "case-"));
    repoRoot = join(tempDir, "repo");
    overlayDir = join(tempDir, "overlay");

    await mkdir(join(repoRoot, "skills", "base-skill"), { recursive: true });
    await writeFile(join(repoRoot, "skills", "base-skill", "SKILL.md"), "---\nname: base-skill\n---\n# Base Skill\n");

    await mkdir(join(repoRoot, "commands"), { recursive: true });
    await writeFile(join(repoRoot, "commands", "base-cmd.md"), "---\ndescription: Base command\n---\n# Base Command\n");

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
    await writeFile(join(overlayDir, "commands", "work-cmd.md"), "---\ndescription: Work command\n---\n# Work Command\n");

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

  it("renders overlay command skills in every Codex profile without changing the source commands", async () => {
    const commandPath = join(overlayDir, "commands", "base-cmd.md");
    const commandContent = "---\ndescription: Overlay review\n---\nReview {{file_path}} in {{repo_root}}. Keep \\{{args}} literal.\n";
    await Bun.write(commandPath, commandContent);

    await buildCommand({ hasAutoConfirm: true, registryPaths });

    const renderedContent = `---\ndescription: Overlay review\n---\nReview ${commandPath} in ${repoRoot}. Keep {{args}} literal.\n`;
    const outputRelativePath = "codex/work/skills/command-base-cmd/SKILL.md";
    const skillPath = join(registryPaths.output, outputRelativePath);
    expect(await Bun.file(skillPath).text()).toBe(renderedContent);
    expect(await Bun.file(join(registryPaths.output, "codex/default/skills/command-base-cmd/SKILL.md")).text())
      .toBe(renderedContent);
    expect(await Bun.file(join(registryPaths.output, "codex/work/skills/command-base-cmd/agents/openai.yaml")).text())
      .toBe("policy:\n  allow_implicit_invocation: false\n");
    expect(existsSync(join(registryPaths.output, "codex/default/prompts"))).toBe(false);
    expect(existsSync(join(registryPaths.output, "codex/work/prompts"))).toBe(false);
    expect(existsSync(join(registryPaths.output, ".codex-command-skills"))).toBe(false);

    expect(await Bun.file(commandPath).text()).toBe(commandContent);
    expect(await Bun.file(join(repoRoot, "commands/base-cmd.md")).text())
      .toBe("---\ndescription: Base command\n---\n# Base Command\n");
  });
});
