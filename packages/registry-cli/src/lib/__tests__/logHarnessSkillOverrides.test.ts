import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { logHarnessSkillOverrides } from "../logHarnessSkillOverrides";
import type { IUnifiedHarnessBuildContext } from "../harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "log-harness-skill-overrides-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

async function writeTestFile(baseDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = join(baseDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

function createUnifiedContext(
  repositoryRoot: string,
  target: string,
  options: { hasOverlay?: boolean } = {},
): IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", target),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: {
      repo_root: repositoryRoot,
      skills_dir: join(repositoryRoot, "skills"),
      commands_dir: join(repositoryRoot, "commands"),
      profiles_dir: join(repositoryRoot, "profiles"),
      output_dir: join(repositoryRoot, ".output"),
      ...(options.hasOverlay ? { overlay_dir: join(repositoryRoot, "overlay") } : {}),
    },
    buildSupport: {
      mergeDirectory: async () => {},
      stageProfileAssets: async () => {},
      writeBinScript: async () => {},
      copyDirectoryWithTemplateVariables: async () => {},
      copyPathWithTemplateVariables: async () => {},
      ensureRuntimeDirectory: async () => {},
    },
  };
}

describe("logHarnessSkillOverrides", () => {
  afterAll(async () => {
    for (const createdDirectory of createdDirectories) {
      await rm(createdDirectory, { recursive: true, force: true });
    }
  });

  it("detects and logs harness skills that override global skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/github-fix-issues/SKILL.md", "# Global\n");
    await writeTestFile(repositoryRoot, "skills/other-skill/SKILL.md", "# Other\n");
    await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/github-fix-issues/SKILL.md", "# Harness\n");
    await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/claude-only/SKILL.md", "# Claude only\n");

    const logged: string[] = [];
    const context = createUnifiedContext(repositoryRoot, "claude-code");

    const overrides = await logHarnessSkillOverrides(context, "claude-code", (message) => {
      logged.push(message);
    });

    expect(overrides).toEqual(["github-fix-issues"]);
    expect(logged).toEqual(["   ↳ claude-code skill overrides (1): github-fix-issues"]);
  });

  it("detects and logs harness skills that override overlay skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "overlay/skills/custom-skill/SKILL.md", "# Overlay\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/skills/custom-skill/SKILL.md", "# Harness\n");

    const logged: string[] = [];
    const context = createUnifiedContext(repositoryRoot, "pi", { hasOverlay: true });

    const overrides = await logHarnessSkillOverrides(context, "pi", (message) => {
      logged.push(message);
    });

    expect(overrides).toEqual(["custom-skill"]);
    expect(logged).toEqual(["   ↳ pi skill overrides (1): custom-skill"]);
  });

  it("returns empty array and does not log when there are no collisions", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/global-only/SKILL.md", "# Global\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/codex-only/SKILL.md", "# Codex only\n");

    const logged: string[] = [];
    const context = createUnifiedContext(repositoryRoot, "codex");

    const overrides = await logHarnessSkillOverrides(context, "codex", (message) => {
      logged.push(message);
    });

    expect(overrides).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("returns empty array when harness skills directory does not exist", async () => {
    const repositoryRoot = await createTestDirectory();
    const logged: string[] = [];
    const context = createUnifiedContext(repositoryRoot, "opencode");

    const overrides = await logHarnessSkillOverrides(context, "opencode", (message) => {
      logged.push(message);
    });

    expect(overrides).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("ignores non-directory entries in harness skills directory", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/file-item/SKILL.md", "# Global\n");
    await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/file-item", "just a file\n");

    const logged: string[] = [];
    const context = createUnifiedContext(repositoryRoot, "claude-code");

    const overrides = await logHarnessSkillOverrides(context, "claude-code", (message) => {
      logged.push(message);
    });

    expect(overrides).toEqual([]);
    expect(logged).toEqual([]);
  });
});
