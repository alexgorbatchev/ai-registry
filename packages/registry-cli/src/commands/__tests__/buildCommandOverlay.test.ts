import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync } from "fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";

import { buildCommand } from "../buildCommand";
import { type IRegistryPaths } from "../../lib/getRegistryPaths";
import { copyRepositoryHarnesses, loadTestShellEnvironment } from "./helpers";

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

    await mkdir(join(repoRoot, "system"), { recursive: true });
    await writeFile(join(repoRoot, "system", "system.md"), "Base prompt\n");

    await copyRepositoryHarnesses(join(repoRoot, "harnesses"));

    // Overlay structure
    await mkdir(join(overlayDir, "skills", "work-skill"), { recursive: true });
    await writeFile(join(overlayDir, "skills", "work-skill", "SKILL.md"), "---\nname: work-skill\n---\n# Work Skill\n");

    await mkdir(join(overlayDir, "commands"), { recursive: true });
    await writeFile(join(overlayDir, "commands", "work-cmd.md"), "---\ndescription: Work command\n---\n# Work Command\n");

    registryPaths = {
      root: repoRoot,
      overlays: [overlayDir],
      harnesses: join(repoRoot, "harnesses"),
      skills: join(repoRoot, "skills"),
      commands: join(repoRoot, "commands"),
      systemPrompt: join(repoRoot, "system", "system.md"),
      output: join(repoRoot, ".output"),
      temp: join(repoRoot, ".tmp"),
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds outputs combining base assets and overlay assets", async () => {
    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const outputDir = registryPaths.output;

    // OpenCode staging should include both base-skill and work-skill
    expect(existsSync(join(outputDir, "opencode", "skills", "base-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(join(outputDir, "opencode", "skills", "work-skill", "SKILL.md"))).toBe(true);

    // OpenCode commands should include both
    expect(existsSync(join(outputDir, "opencode", "commands", "base-cmd.md"))).toBe(true);
    expect(existsSync(join(outputDir, "opencode", "commands", "work-cmd.md"))).toBe(true);

    for (const target of ["codex", "pi", "claude-code"]) {
      expect(existsSync(join(outputDir, target, "skills", "base-skill", "SKILL.md"))).toBe(true);
      expect(existsSync(join(outputDir, target, "skills", "work-skill", "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(outputDir, "pi", "prompts", "work-cmd.md"))).toBe(true);
    expect(existsSync(join(outputDir, "claude-code", "commands", "work-cmd.md"))).toBe(true);

    // Manifest should exist
    expect(existsSync(join(outputDir, "manifest.json"))).toBe(true);
  });

  it("emits the last overlay skill in every harness and notes each conflict", async () => {
    const lastOverlay = join(tempDir, "last-overlay");
    const baseSkill = join(repoRoot, "skills", "base-skill");
    const firstSkill = join(overlayDir, "skills", "base-skill");
    const lastSkill = join(lastOverlay, "skills", "base-skill");
    await Bun.write(join(firstSkill, "SKILL.md"), "---\nname: base-skill\n---\nFirst overlay\n");
    const expected = "---\nname: base-skill\n---\nLast overlay\n";
    await Bun.write(join(lastSkill, "SKILL.md"), expected);
    await Bun.write(join(firstSkill, "first-only.txt"), "must not merge resources");
    registryPaths.overlays = [overlayDir, lastOverlay];
    const messages: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation((message) => messages.push(String(message)));
    try {
      await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });
    } finally {
      logSpy.mockRestore();
    }
    expect(messages.filter((message) => message.startsWith("NOTE:"))).toEqual([
      `NOTE: Skill "base-skill" conflict: ${firstSkill} replaces ${baseSkill}`,
      `NOTE: Skill "base-skill" conflict: ${lastSkill} replaces ${firstSkill}`,
    ]);
    for (const target of ["opencode", "codex", "pi", "claude-code"]) {
      const outputSkill = join(registryPaths.output, target, "skills", "base-skill");
      expect(await Bun.file(join(outputSkill, "SKILL.md")).text()).toBe(expected);
      expect(await Bun.file(join(outputSkill, "first-only.txt")).exists()).toBe(false);
    }
  });

  it("renders overlay command skills for Codex without changing the source commands", async () => {
    const commandPath = join(overlayDir, "commands", "base-cmd.md");
    const commandContent = "---\ndescription: Overlay review\n---\nReview <%- file_path %> in <%- repo_root %>. Keep {{args}} literal.\n";
    await Bun.write(commandPath, commandContent);

    await buildCommand({ hasAutoConfirm: true, registryPaths, loadShellEnvironment: loadTestShellEnvironment });

    const renderedContent = `---\ndescription: Overlay review\n---\nReview ${commandPath} in ${repoRoot}. Keep {{args}} literal.\n`;
    expect(await Bun.file(join(registryPaths.output, "codex/skills/command-base-cmd/SKILL.md")).text())
      .toBe(renderedContent);
    expect(await Bun.file(join(registryPaths.output, "codex/skills/command-base-cmd/agents/openai.yaml")).text())
      .toBe("policy:\n  allow_implicit_invocation: false\n");
    expect(existsSync(join(registryPaths.output, "codex/prompts"))).toBe(false);

    expect(await Bun.file(commandPath).text()).toBe(commandContent);
    expect(await Bun.file(join(repoRoot, "commands/base-cmd.md")).text())
      .toBe("---\ndescription: Base command\n---\n# Base Command\n");
  });
});
