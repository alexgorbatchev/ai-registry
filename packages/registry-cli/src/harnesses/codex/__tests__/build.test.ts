import assert from "node:assert";
import { existsSync } from "fs";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, lstat, readFile, readdir, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

import plugin from "../../codex/build";
import { applyTemplateVariablesToGeneratedOutput } from "../../../lib/harnessBuild";
import { collectGeneratedOutputEntries } from "../../../lib/generatedOutputUtils";
import { createSettingsSyncRegistry } from "../../../lib/settingsSync/createSettingsSyncRegistry";
import { syncBackModifiedFiles } from "../../../commands/buildCommand";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "codex-build-tests");
const originalCodexHome: string | undefined = process.env.CODEX_HOME;
const originalTrustedDirs: string | undefined = process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS;

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
  await writeTestFile(repositoryRoot, "system/system.md", "Follow the repo guidance.\nEscalate risky changes.\n");
  await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", 'model = "gpt-5.5"\n');
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(createHarnessBuildContext(repositoryRoot, "codex", options));
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("Codex harness build plugin", () => {
  beforeEach(() => {
    delete process.env.CODEX_HOME;
    delete process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS;
  });

  afterEach(async () => {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    if (originalTrustedDirs === undefined) {
      delete process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS;
    } else {
      process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS = originalTrustedDirs;
    }
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("builds the Codex root with instructions, config, rules, skills, and command skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(
      repositoryRoot,
      "commands/review.md",
      "---\ndescription: Test workflow\n---\nReview the changes.\n",
    );
    await writeTestFile(
      repositoryRoot,
      "harnesses/codex/rules/default.rules",
      'prefix_rule(pattern = ["git", "reset"], decision = "forbidden")\n',
    );
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"], commands: ["review.md"] });

    const outputDir = join(repositoryRoot, ".output", "codex");
    expect(existsSync(join(outputDir, "prompts"))).toBe(false);
    expect(await Bun.file(join(outputDir, "skills", "command-review", "agents", "openai.yaml")).text()).toBe(
      "policy:\n  allow_implicit_invocation: false\n",
    );
    expect(await readFile(join(outputDir, "AGENTS.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    // Sessions, logs, and databases belong to the real `~/.codex` home that bootstrap
    // links these entries into, so the build creates none of them.
    expect((await readdir(outputDir)).sort()).toEqual(["AGENTS.md", "config.toml", "rules", "skills"]);
    expect(await readFile(join(outputDir, "skills", "command-review", "SKILL.md"), "utf-8")).toBe(
      "---\ndescription: Test workflow\n---\nReview the changes.\n",
    );
    for (const skillName of ["shared-skill", "harness-skill"]) {
      expect((await lstat(join(outputDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(false);
    }
    expect(await readFile(join(outputDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe("# Shared skill\n");
    expect(await readFile(join(outputDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe("# Harness skill\n");
    expect(await readFile(join(outputDir, "rules", "default.rules"), "utf-8")).toBe(
      'prefix_rule(pattern = ["git", "reset"], decision = "forbidden")\n',
    );
    expect(await readFile(join(outputDir, "config.toml"), "utf-8")).toBe('model = "gpt-5.5"\n');
    expect(existsSync(join(repositoryRoot, ".output", "bin"))).toBe(false);
  });

  it("registers config.toml for settings sync with local paths, notices, hook trust, app-managed entries, and MCP credentials kept live-only", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));

    await buildOutput(repositoryRoot, { settingsSyncRegistry });

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      {
        relativePath: "codex/config.toml",
        sourceJsonObjects: [
          {
            keyPath: ["mcp_servers", "node_repl", "env", "NODE_REPL_TRUSTED_SERVICES"],
            ownerTableKeyPath: ["mcp_servers", "node_repl"],
            ownerTableKeys: ["command", "url"],
          },
        ],
        liveOnlyKeyPaths: [
          ["projects", "*"],
          ["notice"],
          ["skills", "config"],
          ["hooks", "state"],
          ["notify"],
          ["marketplaces", "openai-bundled"],
          ["marketplaces", "openai-primary-runtime"],
          ["mcp_servers", "node_repl"],
          ["mcp_servers", "cua_repl"],
          ["tui", "model_availability_nux"],
          ["mcp_servers", "*", "env"],
          ["mcp_servers", "*", "http_headers"],
        ],
      },
    ]);
  });

  it("trusts every checkout under the folders listed in AI_REGISTRY_CODEX_TRUSTED_DIRS", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await mkdir(join(repositoryRoot, "projects", "app", ".git"), { recursive: true });
    await mkdir(join(repositoryRoot, "projects", "tool", ".git"), { recursive: true });
    process.env.AI_REGISTRY_CODEX_TRUSTED_DIRS = "projects";

    await buildOutput(repositoryRoot);

    const config = Bun.TOML.parse(await readFile(join(repositoryRoot, ".output", "codex", "config.toml"), "utf-8"));
    expect(config).toEqual({
      model: "gpt-5.5",
      projects: {
        [join(repositoryRoot, "projects", "app")]: { trust_level: "trusted" },
        [join(repositoryRoot, "projects", "tool")]: { trust_level: "trusted" },
      },
    });
    expect(await readFile(join(repositoryRoot, "harnesses", "codex", "config.toml"), "utf-8")).toBe(
      'model = "gpt-5.5"\n',
    );
  });

  it("fails when the harness config is missing", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "system/system.md", "Instructions.\n");

    await expect(buildOutput(repositoryRoot)).rejects.toThrow(
      `Codex harness config does not exist: ${join(repositoryRoot, "harnesses", "codex", "config.toml")}`,
    );
  });

  it("applies the generated Codex root to ~/.codex", async () => {
    const outputDir = await createTestDirectory();

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Codex home",
        sourcePath: join(outputDir, "codex"),
        targetPath: join(homedir(), ".codex"),
      },
    ]);
  });

  it("uses CODEX_HOME for the bootstrap target", async () => {
    const outputDir = await createTestDirectory();
    const targetPath = join(outputDir, "custom-codex-home");
    process.env.CODEX_HOME = targetPath;

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Codex home",
        sourcePath: join(outputDir, "codex"),
        targetPath,
      },
    ]);
  });

  it("overrides global skills with harness-specific skills on collision", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/extra.txt", "global extra\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/shared-skill/SKILL.md", "# Harness version\n");

    await buildOutput(repositoryRoot, { skills: ["shared-skill"] });

    const skillDir = join(repositoryRoot, ".output", "codex", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);
  });

  it("stages grouped harness skills (agent and user), injecting disable-model-invocation for user skills", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(
      repositoryRoot,
      "harnesses/codex/skills/agent/harness-agent-skill/SKILL.md",
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    await writeTestFile(
      repositoryRoot,
      "harnesses/codex/skills/user/harness-user-skill/SKILL.md",
      "---\nname: harness-user-skill\n---\n# User\n",
    );

    await buildOutput(repositoryRoot);

    const skillsDir = join(repositoryRoot, ".output", "codex", "skills");
    expect(await readFile(join(skillsDir, "harness-agent-skill", "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(skillsDir, "harness-user-skill", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });

  it("rejects commands that normalize to the same native skill name", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/--review.md", "---\ndescription: Review changes\n---\nReview.\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "---\ndescription: Review changes\n---\nReview again.\n");

    await expect(buildOutput(repositoryRoot, { commands: ["--review.md", "review.md"] })).rejects.toThrow(
      "Duplicate Codex command skill name: command-review",
    );
  });

  it("rejects a command that collides with a selected skill and keeps the skill", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "---\ndescription: Review changes\n---\nReview.\n");
    await writeTestFile(
      repositoryRoot,
      "skills/command-review/SKILL.md",
      "---\nname: command-review\ndescription: Existing skill\n---\nInspect.\n",
    );

    await expect(buildOutput(repositoryRoot, { skills: ["command-review"], commands: ["review.md"] })).rejects.toThrow(
      "Codex command skill command-review collides with a skill of the same name.",
    );
    expect(
      await Bun.file(join(repositoryRoot, ".output", "codex", "skills", "command-review", "SKILL.md")).text(),
    ).toBe("---\nname: command-review\ndescription: Existing skill\n---\nInspect.\n");
  });

  it("preserves original command provenance through template rendering and sync-back", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const commandPath = await writeTestFile(
      repositoryRoot,
      "overlay/commands/review.md",
      "---\ndescription: Review\n---\nInspect <%- file_path %> under <%- repo_root %>. Keep {{args}}.\n",
    );
    const sourcePathByOutputPath = new Map<string, string>();
    const context = createHarnessBuildContext(repositoryRoot, "codex", {
      commands: ["review.md"],
      commandSourcePaths: { "review.md": commandPath },
      sourcePathByOutputPath,
    });
    await plugin.buildOutput(context);
    await applyTemplateVariablesToGeneratedOutput(context.outputDir, context.templateContext, sourcePathByOutputPath);

    const relativePath = "codex/skills/command-review/SKILL.md";
    const outputPath = join(context.outputDir, relativePath);
    expect(sourcePathByOutputPath.get(outputPath)).toBe(commandPath);
    expect(await Bun.file(outputPath).text()).toBe(
      `---\ndescription: Review\n---\nInspect ${commandPath} under ${repositoryRoot}. Keep {{args}}.\n`,
    );
    const editedOutputDir = join(repositoryRoot, ".tmp", "edited-output");
    const baseline = await collectGeneratedOutputEntries(context.outputDir);
    const sourceChecksum = new Bun.CryptoHasher("sha256").update(await Bun.file(commandPath).text()).digest("hex");
    await writeTestFile(
      editedOutputDir,
      relativePath,
      `---\ndescription: Updated review\n---\nInspect changes under ${repositoryRoot}.\n`,
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
      "---\ndescription: Updated review\n---\nInspect changes under <%- repo_root %>.\n",
    );
  });

  it("maps AGENTS.md back to the shared system prompt for generated-edit recovery", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeHarnessFixture(repositoryRoot);
    const sourcePathByOutputPath = new Map<string, string>();
    const context = createHarnessBuildContext(repositoryRoot, "codex", { sourcePathByOutputPath });

    await plugin.buildOutput(context);

    expect(sourcePathByOutputPath.get(join(context.outputDir, "codex", "AGENTS.md"))).toBe(
      join(repositoryRoot, "system", "system.md"),
    );
  });
});
