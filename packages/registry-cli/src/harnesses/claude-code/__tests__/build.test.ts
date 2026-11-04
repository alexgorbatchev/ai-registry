import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { createSettingsSyncRegistry } from "../../../lib/settingsSync/createSettingsSyncRegistry";
import { createHarnessBuildContext, type IHarnessBuildContextOptions } from "../../__tests__/createHarnessBuildContext";
import plugin from "../build";

const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "claude-code-build-tests");

let testDirectoryIndex = 0;

async function createOutputDirectory(): Promise<string> {
  testDirectoryIndex += 1;
  const directory = join(TEST_ROOT, `case-${testDirectoryIndex}`);
  await mkdir(directory, { recursive: true });
  return directory;
}

async function writeTestFile(repositoryRoot: string, relativePath: string, content: string): Promise<string> {
  const fullPath = join(repositoryRoot, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await Bun.write(fullPath, content);
  return fullPath;
}

async function writeHarnessFixture(repositoryRoot: string): Promise<void> {
  await writeTestFile(repositoryRoot, "system/system.md", "Follow the repo guidance.\nEscalate risky changes.\n");
  await writeTestFile(repositoryRoot, "harnesses/claude-code/settings.json", '{\n  "theme": "dark"\n}\n');
  await writeTestFile(repositoryRoot, "harnesses/claude-code/.registry-ignore", "./fetch-source.sh\n./skills/\n");
  await writeTestFile(repositoryRoot, "harnesses/claude-code/fetch-source.sh", "#!/bin/bash\n");
  await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/harness-skill/SKILL.md", "# Harness skill\n");
}

function buildOutput(repositoryRoot: string, options: IHarnessBuildContextOptions = {}): Promise<void> {
  return plugin.buildOutput(
    createHarnessBuildContext(repositoryRoot, "claude-code", {
      skills: ["shared-skill"],
      commands: ["review.md"],
      ...options,
    }),
  );
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

describe("Claude Code harness build", () => {
  beforeEach(() => {
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(async () => {
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    }

    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("uses claude-code as the harness target", () => {
    expect(plugin.target).toBe("claude-code");
  });

  it("builds the Claude Code root from the system prompt, harness files, skills, and commands", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await buildOutput(repositoryRoot);

    const outputDir = join(repositoryRoot, ".output", "claude-code");
    expect(await readFile(join(outputDir, "CLAUDE.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    expect(await readFile(join(outputDir, "settings.json"), "utf-8")).toBe('{\n  "theme": "dark"\n}\n');
    expect(await readFile(join(outputDir, "commands", "review.md"), "utf-8")).toBe("Review the changes.\n");
    expect(await readFile(join(outputDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe("# Shared skill\n");
    expect(await readFile(join(outputDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe("# Harness skill\n");

    for (const skillName of ["shared-skill", "harness-skill"]) {
      expect((await lstat(join(outputDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(false);
    }
  });

  it("keeps repo-only harness files and runtime state out of the generated root", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");

    await buildOutput(repositoryRoot);

    // Session stores, history, and plugins belong to the real `~/.claude` home that
    // bootstrap links these entries into, so the build creates none of them.
    const outputDir = join(repositoryRoot, ".output", "claude-code");
    expect((await readdir(outputDir)).sort()).toEqual(["CLAUDE.md", "commands", "settings.json", "skills"]);
    expect(existsSync(join(outputDir, "fetch-source.sh"))).toBe(false);
    expect(existsSync(join(outputDir, ".registry-ignore"))).toBe(false);
  });

  it("registers settings.json for settings sync", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));
    await buildOutput(repositoryRoot, { settingsSyncRegistry });

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      { relativePath: "claude-code/settings.json", liveOnlyKeyPaths: [] },
    ]);
  });

  it("generates the cll helper for litellm", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);

    await buildOutput(repositoryRoot, { skills: [], commands: [] });

    const binDir = join(repositoryRoot, ".output", "bin");
    expect(await readdir(binDir)).toEqual(["cll"]);

    const cllHelper = await readFile(join(binDir, "cll"), "utf-8");
    expect(cllHelper).toContain('MODEL="${CLAUDE_MODEL:-gemini-3.7-flash}"');
    expect(cllHelper).toContain('ANTHROPIC_CUSTOM_MODEL_OPTION="$MODEL"');
    expect(cllHelper).toContain('export CLAUDE_CODE_MAX_CONTEXT_TOKENS="${CLAUDE_CODE_MAX_CONTEXT_TOKENS:-1000000}"');
    expect(cllHelper).toContain('exec "$real_binary" --dangerously-skip-permissions --model "$MODEL" "$@"');
  });

  it("fails when the shared system prompt is missing", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await rm(join(repositoryRoot, "system"), { recursive: true });

    await expect(buildOutput(repositoryRoot, { skills: [], commands: [] })).rejects.toThrow("ENOENT");
  });

  it("applies the generated Claude Code root to ~/.claude", async () => {
    const outputDir = await createOutputDirectory();

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config",
        sourcePath: join(outputDir, "claude-code"),
        targetPath: join(homedir(), ".claude"),
      },
    ]);
  });

  it("uses CLAUDE_CONFIG_DIR for the bootstrap target", async () => {
    const outputDir = await createOutputDirectory();
    const targetPath = join(outputDir, "custom-claude-config");
    process.env.CLAUDE_CONFIG_DIR = targetPath;

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config",
        sourcePath: join(outputDir, "claude-code"),
        targetPath,
      },
    ]);
  });

  it("overrides global skills with harness-specific skills on collision", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Global version\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/extra.txt", "global extra\n");
    await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/shared-skill/SKILL.md", "# Harness version\n");

    await buildOutput(repositoryRoot, { commands: [] });

    const skillDir = join(repositoryRoot, ".output", "claude-code", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);
  });

  it("stages grouped harness skills (agent and user), injecting disable-model-invocation for user skills", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(
      repositoryRoot,
      "harnesses/claude-code/skills/agent/harness-agent-skill/SKILL.md",
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    await writeTestFile(
      repositoryRoot,
      "harnesses/claude-code/skills/user/harness-user-skill/SKILL.md",
      "---\nname: harness-user-skill\n---\n# User\n",
    );

    await buildOutput(repositoryRoot, { skills: [], commands: [] });

    const skillsDir = join(repositoryRoot, ".output", "claude-code", "skills");
    expect(await readFile(join(skillsDir, "harness-agent-skill", "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(skillsDir, "harness-user-skill", "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });
});
