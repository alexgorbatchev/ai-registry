import assert from "node:assert";
import { existsSync } from "fs";
import { afterEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import plugin from "../../opencode/build";
import { createSettingsSyncRegistry } from "../../../lib/settingsSync/createSettingsSyncRegistry";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "opencode-build-tests");
const originalOpencodeConfigDir: string | undefined = process.env.OPENCODE_CONFIG_DIR;
const originalXdgConfigHome: string | undefined = process.env.XDG_CONFIG_HOME;

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

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

async function writeHarnessFixture(repositoryRoot: string): Promise<void> {
  await writeTestFile(repositoryRoot, "harnesses/opencode/.registry-ignore", "./skills/\n");
  await writeTestFile(
    repositoryRoot,
    "harnesses/opencode/opencode.jsonc",
    '{\n  // shared config\n  "theme": "dark"\n}\n',
  );
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(createHarnessBuildContext(repositoryRoot, "opencode", options));
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("OpenCode harness build plugin", () => {
  afterEach(async () => {
    restoreEnvironmentVariable("OPENCODE_CONFIG_DIR", originalOpencodeConfigDir);
    restoreEnvironmentVariable("XDG_CONFIG_HOME", originalXdgConfigHome);
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("applies the generated config to the OpenCode config home under XDG_CONFIG_HOME", async () => {
    const outputDir = await createTestDirectory();
    delete process.env.OPENCODE_CONFIG_DIR;
    process.env.XDG_CONFIG_HOME = join(outputDir, "config");

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        sourcePath: join(outputDir, "opencode"),
        targetPath: join(outputDir, "config", "opencode"),
        description: "OpenCode config",
      },
    ]);
  });

  it("applies the generated config to OPENCODE_CONFIG_DIR when it is set", async () => {
    const outputDir = await createTestDirectory();
    process.env.OPENCODE_CONFIG_DIR = join(outputDir, "custom-opencode");

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        sourcePath: join(outputDir, "opencode"),
        targetPath: join(outputDir, "custom-opencode"),
        description: "OpenCode config",
      },
    ]);
  });

  it("builds the OpenCode config with registry skills and commands and no generated agents", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "harnesses/opencode/commands/harness.md", "Harness command.\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "harnesses/opencode/skills/harness-skill/SKILL.md", "# Harness skill\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"], commands: ["review.md"] });

    const outputDir = join(repositoryRoot, ".output", "opencode");
    expect((await readdir(outputDir)).sort()).toEqual(["commands", "opencode.jsonc", "skills"]);
    expect(existsSync(join(outputDir, "agents"))).toBe(false);
    expect((await readdir(join(outputDir, "commands"))).sort()).toEqual(["harness.md", "review.md"]);
    for (const skillName of ["shared-skill", "harness-skill"]) {
      expect((await lstat(join(outputDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(false);
    }
    expect((await readdir(join(repositoryRoot, ".output", "bin"))).sort()).toEqual([
      "air-opencode-conversation-extract",
      "air-opencode-session-analysis",
      "air-opencode-session-export",
    ]);
  });

  it("rejects a registry command that collides with a harness command", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "harnesses/opencode/commands/review.md", "Harness review.\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "Registry review.\n");

    await expect(buildOutput(repositoryRoot, { commands: ["review.md"] })).rejects.toThrow(
      `Cannot stage command review.md because the output path already exists: ${join(repositoryRoot, ".output", "opencode", "commands", "review.md")}`,
    );
  });

  it("registers opencode.jsonc for settings sync", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);

    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));
    await buildOutput(repositoryRoot, { settingsSyncRegistry });

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      {
        relativePath: "opencode/opencode.jsonc",
        liveOnlyKeyPaths: [
          ["mcp", "*", "headers"],
          ["mcp", "*", "environment"],
        ],
      },
    ]);
  });

  it("overrides global skills with harness-specific skills on collision", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/extra.txt", "global extra\n");
    await writeTestFile(repositoryRoot, "harnesses/opencode/skills/shared-skill/SKILL.md", "# Harness version\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"] });

    const skillDir = join(repositoryRoot, ".output", "opencode", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);
  });

  it("stages grouped harness skills (agent and user), injecting disable-model-invocation for user skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
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

    await buildOutput(repositoryRoot);

    const skillsDir = join(repositoryRoot, ".output", "opencode", "skills");
    expect(await readFile(join(skillsDir, "harness-agent-skill", "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(skillsDir, "harness-user-skill", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });
});
