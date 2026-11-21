import { factory_testRoot } from "./fixtures";
import assert from "node:assert";
import { existsSync } from "fs";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

import plugin from "../build";
import { syncBackModifiedFiles } from "../../../commands/buildCommand";
import { collectGeneratedOutputEntries } from "../../../lib/generatedOutputUtils";
import { applyTemplateVariablesToGeneratedOutput } from "../../../lib/harnessBuild";
import { createSettingsSyncRegistry } from "../../../lib/settingsSync/createSettingsSyncRegistry";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";

const TEST_ROOT = factory_testRoot("antigravity-build-tests");

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
  await writeTestFile(repositoryRoot, "system/system.md", "Follow the repo guidance.\n");
  await writeTestFile(repositoryRoot, "harnesses/antigravity/mcp_config.json", '{\n  "mcpServers": {}\n}\n');
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(createHarnessBuildContext(repositoryRoot, "antigravity", options));
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("Antigravity harness build plugin", () => {
  afterEach(async () => {
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("builds the global config folder with the system prompt, every skill, user-only command skills, and MCP servers", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "---\nname: shared-skill\n---\n# Shared\n");
    await writeTestFile(
      repositoryRoot,
      "harnesses/antigravity/skills/user/harness-skill/SKILL.md",
      "---\nname: harness-skill\n---\n# Harness\n",
    );
    await writeTestFile(repositoryRoot, "commands/--review.md", "---\ndescription: Review changes\n---\nReview.\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"], commands: ["--review.md"] });

    const outputDir = join(repositoryRoot, ".output", "antigravity");
    // Projects and other runtime state belong to the real `~/.gemini/config` that
    // bootstrap links these entries into, so the build creates none of them.
    expect((await readdir(outputDir)).sort()).toEqual(["AGENTS.md", "mcp_config.json", "skills"]);
    expect(await readFile(join(outputDir, "AGENTS.md"), "utf-8")).toBe("Follow the repo guidance.\n");
    expect(await readFile(join(outputDir, "mcp_config.json"), "utf-8")).toBe('{\n  "mcpServers": {}\n}\n');
    expect((await readdir(join(outputDir, "skills"))).sort()).toEqual([
      "command-review",
      "harness-skill",
      "shared-skill",
    ]);
    expect(await readFile(join(outputDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe(
      "---\nname: shared-skill\n---\n# Shared\n",
    );
    expect(await readFile(join(outputDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-skill\n---\n# Harness\n",
    );
    expect(await readFile(join(outputDir, "skills", "command-review", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\ndescription: Review changes\n---\nReview.\n",
    );
  });

  it("lets a harness skill override a registry skill of the same name", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "harnesses/antigravity/skills/shared-skill/SKILL.md", "# Harness version\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"] });

    expect(
      await readFile(join(repositoryRoot, ".output", "antigravity", "skills", "shared-skill", "SKILL.md"), "utf-8"),
    ).toBe("# Harness version\n");
  });

  it("rejects a command whose skill name collides with a skill", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "---\ndescription: Review changes\n---\nReview.\n");
    await writeTestFile(repositoryRoot, "skills/command-review/SKILL.md", "# Existing skill\n");

    await expect(buildOutput(repositoryRoot, { skills: ["command-review"], commands: ["review.md"] })).rejects.toThrow(
      "Antigravity command skill command-review collides with a skill of the same name.",
    );
  });

  it("registers mcp_config.json for settings sync without linking it into the config folder", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));

    await buildOutput(repositoryRoot, { settingsSyncRegistry });

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      { relativePath: "antigravity/mcp_config.json", liveOnlyKeyPaths: [], shouldLinkIntoHome: false },
    ]);
  });

  it("ships no MCP config when the harness declares none", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "system/system.md", "Instructions.\n");

    await buildOutput(repositoryRoot);

    expect(existsSync(join(repositoryRoot, ".output", "antigravity", "mcp_config.json"))).toBe(false);
    expect(existsSync(join(repositoryRoot, ".output", "antigravity", "AGENTS.md"))).toBe(true);
  });

  it("links the output into ~/.gemini/config and writes MCP servers into its mcp_config.json", async () => {
    const outputDir = await createTestDirectory();
    const configDir = join(homedir(), ".gemini", "config");

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        sourcePath: join(outputDir, "antigravity"),
        targetPath: configDir,
        description: "Antigravity config",
      },
      {
        kind: "entries",
        sourcePath: join(outputDir, "antigravity", "mcp_config.json"),
        targetPath: join(configDir, "mcp_config.json"),
        description: "Antigravity MCP servers",
        tables: [["mcpServers"]],
        liveOnlyEntryKeys: ["headers", "env"],
      },
    ]);
  });

  it("recovers an edited command skill into its command source without the injected invocation flag", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const commandPath = await writeTestFile(
      repositoryRoot,
      "commands/review.md",
      "---\ndescription: Review\n---\nInspect <%- repo_root %>.\n",
    );
    const sourcePathByOutputPath = new Map<string, string>();
    const context = createHarnessBuildContext(repositoryRoot, "antigravity", {
      commands: ["review.md"],
      sourcePathByOutputPath,
    });
    await plugin.buildOutput(context);
    await applyTemplateVariablesToGeneratedOutput(context.outputDir, context.templateContext, sourcePathByOutputPath);

    const relativePath = "antigravity/skills/command-review/SKILL.md";
    const outputPath = join(context.outputDir, relativePath);
    expect(sourcePathByOutputPath.get(outputPath)).toBe(commandPath);
    const baseline = await collectGeneratedOutputEntries(context.outputDir);
    const sourceChecksum = new Bun.CryptoHasher("sha256").update(await Bun.file(commandPath).text()).digest("hex");
    const editedOutputDir = join(repositoryRoot, ".tmp", "edited-output");
    await writeTestFile(
      editedOutputDir,
      relativePath,
      `---\ndisable-model-invocation: true\ndescription: Updated review\n---\nInspect ${repositoryRoot} again.\n`,
    );

    await syncBackModifiedFiles(
      [{ path: relativePath, reason: "modified" }],
      editedOutputDir,
      context.outputDir,
      sourcePathByOutputPath,
      context.templateContext,
      { [relativePath]: commandPath },
      baseline,
      { [relativePath]: sourceChecksum },
    );

    expect(await Bun.file(commandPath).text()).toBe(
      "---\ndescription: Updated review\n---\nInspect <%- repo_root %> again.\n",
    );
  });

  it("maps AGENTS.md back to the shared system prompt for generated-edit recovery", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const sourcePathByOutputPath = new Map<string, string>();
    const context = createHarnessBuildContext(repositoryRoot, "antigravity", { sourcePathByOutputPath });

    await plugin.buildOutput(context);

    expect(sourcePathByOutputPath.get(join(context.outputDir, "antigravity", "AGENTS.md"))).toBe(
      join(repositoryRoot, "system", "system.md"),
    );
  });
});
