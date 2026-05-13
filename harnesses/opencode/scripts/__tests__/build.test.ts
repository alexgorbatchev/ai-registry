import assert from "node:assert";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import plugin from "../build";
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
  type IBuildSupport,
  type IProfileBuildContext,
  type ITemplateContext,
} from "../../../../scripts/lib/harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "opencode-build-tests");

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, "case-"));
}

async function writeTestFile(rootDir: string, relativePath: string, content: string): Promise<string> {
  const filePath = join(rootDir, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

function createTemplateContext(repositoryRoot: string): ITemplateContext {
  return {
    repo_root: repositoryRoot,
    skills_dir: join(repositoryRoot, "skills"),
    commands_dir: join(repositoryRoot, "commands"),
    profiles_dir: join(repositoryRoot, "profiles"),
    output_dir: join(repositoryRoot, ".output"),
  };
}

function createBuildSupport(): IBuildSupport {
  return {
    mergeDirectory,
    stageProfileAssets,
    writeBinScript,
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
  };
}

function createProfileContext(repositoryRoot: string): IProfileBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "opencode"),
    profileName: "developer",
    profileDir: join(repositoryRoot, "profiles", "developer"),
    manifest: {
      commands: [],
      description: "Developer profile",
      skills: ["shared-skill"],
      system_prompt: "Follow the repo guidance.",
    },
    globalMatchedSkills: ["shared-skill"],
    globalMatchedCommands: [],
    profileLocalSkills: ["local-skill"],
    profileLocalCommands: [],
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(),
  };
}

function getStageProfile(): NonNullable<typeof plugin.stageProfile> {
  assert(plugin.stageProfile);
  return plugin.stageProfile;
}

describe("OpenCode harness build plugin", () => {
  afterEach(async () => {
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("adds a harness-name skill wildcard to generated agent permissions", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Local skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot));

    expect(await readFile(join(repositoryRoot, ".output", ".opencode-agents", "developer.md"), "utf-8")).toBe([
      "---",
      "description: Developer profile",
      "mode: primary",
      "permission: ",
      "  skill: ",
      "    \"*\": deny",
      "    opencode-*: allow",
      "    shared-skill: allow",
      "    local-skill: allow",
      "---",
      "Follow the repo guidance.",
    ].join("\n"));
  });
});
