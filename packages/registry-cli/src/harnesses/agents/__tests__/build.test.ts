import { factory_testRoot } from "./fixtures";
import assert from "node:assert";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

import plugin from "../../agents/build";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";

const TEST_ROOT = factory_testRoot("agents-build-tests");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

async function writeTestFile(rootDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = join(rootDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(createHarnessBuildContext(repositoryRoot, "agents", options));
}

describe("shared agent skills build", () => {
  afterEach(async () => {
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("stages every registry skill, and nothing else, into the shared skills output", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"], commands: ["review.md"] });

    const outputDir = join(repositoryRoot, ".output", "agents");
    expect(await readdir(outputDir)).toEqual(["skills"]);
    expect(await readdir(join(outputDir, "skills"))).toEqual(["shared-skill"]);
    expect(await readFile(join(outputDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe("# Shared skill\n");
    expect(existsSync(join(repositoryRoot, ".output", "bin"))).toBe(false);
  });

  it("links ~/.agents/skills to the whole shared skills output, so each skill is a real folder", async () => {
    assert(plugin.getBootstrapTargets);
    const outputDir = join(TEST_ROOT, ".output");

    expect(await plugin.getBootstrapTargets(outputDir)).toEqual([
      {
        kind: "link",
        sourcePath: join(outputDir, "agents", "skills"),
        targetPath: join(homedir(), ".agents", "skills"),
        description: "Shared agent skills",
      },
    ]);
  });
});
