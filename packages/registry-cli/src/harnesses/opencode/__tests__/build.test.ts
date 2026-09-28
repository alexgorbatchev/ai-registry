import assert from "node:assert";
import { existsSync } from "fs";
import { afterEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import plugin from "../../opencode/build";
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
  type IBuildSupport,
  type IProfileBuildContext,
  type ITemplateContext,
} from "../../../lib/harnessBuild";
import { createRuntimeDirectoryRegistry } from "../../../lib/generatedOutputUtils";

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

function createBuildSupport(repositoryRoot: string): IBuildSupport {
  return {
    mergeDirectory,
    stageProfileAssets,
    writeBinScript,
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
      ensureRuntimeDirectory: createRuntimeDirectoryRegistry(join(repositoryRoot, ".output")).ensureRuntimeDirectory,
  };
}

function createProfileContext(repositoryRoot: string, overrides: Partial<IProfileBuildContext> = {}): IProfileBuildContext {
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
    buildSupport: createBuildSupport(repositoryRoot),
    ...overrides,
  };
}

function getStageProfile(): NonNullable<typeof plugin.stageProfile> {
  assert(plugin.stageProfile);
  return plugin.stageProfile;
}

function createUnifiedContext(repositoryRoot: string): import("../../../lib/harnessBuild").IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "opencode"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(repositoryRoot),
  };
}

function getFinalizeOutput(): NonNullable<typeof plugin.finalizeOutput> {
  assert(plugin.finalizeOutput);
  return plugin.finalizeOutput;
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

  it("handles custom manifest tools and permissions", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, {
      manifest: {
        description: "Custom profile",
        skills: ["shared-skill"],
        tools: { bash: true },
        permission: { bash: "ask" },
        system_prompt: "Custom prompt",
      },
      profileLocalSkills: [],
    }));

    const agentContent = await readFile(join(repositoryRoot, ".output", ".opencode-agents", "developer.md"), "utf-8");
    expect(agentContent).toContain("bash: true");
    expect(agentContent).toContain("bash: ask");
  });

  it("stages skills as rendered copies in finalizeOutput", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "harnesses/opencode/.registry-ignore", "./skills/\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "harnesses/opencode/skills/harness-skill/SKILL.md", "# Harness skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    expect(
      (await lstat(join(repositoryRoot, ".output", "opencode", "skills", "shared-skill", "SKILL.md"))).isSymbolicLink(),
    ).toBe(false);
    expect(
      (await lstat(join(repositoryRoot, ".output", "opencode", "skills", "local-skill", "SKILL.md"))).isSymbolicLink(),
    ).toBe(false);
    expect(
      (await lstat(join(repositoryRoot, ".output", "opencode", "skills", "harness-skill", "SKILL.md"))).isSymbolicLink(),
    ).toBe(false);
  });

  it("overrides global skills with harness-specific skills on collision", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "harnesses/opencode/.registry-ignore", "./skills/\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/extra.txt", "global extra\n");
    await writeTestFile(repositoryRoot, "harnesses/opencode/skills/shared-skill/SKILL.md", "# Harness version\n");

    await getStageProfile()(createProfileContext(repositoryRoot, {
      globalMatchedSkills: ["shared-skill"],
      profileLocalSkills: [],
    }));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const skillDir = join(repositoryRoot, ".output", "opencode", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);
  });

  it("stages grouped harness skills (agent and user), injecting disable-model-invocation for user skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "harnesses/opencode/.registry-ignore", "./skills/\n");
    await writeTestFile(
      repositoryRoot,
      "harnesses/opencode/skills/agent/harness-agent-skill/SKILL.md",
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    await writeTestFile(
      repositoryRoot,
      "harnesses/opencode/skills/user/harness-user-skill/SKILL.md",
      "---\nname: harness-user-skill\n---\n# User\n",
    );

    await getStageProfile()(createProfileContext(repositoryRoot, {
      globalMatchedSkills: [],
      profileLocalSkills: [],
    }));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const agentSkillDir = join(repositoryRoot, ".output", "opencode", "skills", "harness-agent-skill");
    const userSkillDir = join(repositoryRoot, ".output", "opencode", "skills", "harness-user-skill");

    expect(await readFile(join(agentSkillDir, "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(userSkillDir, "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });
});
