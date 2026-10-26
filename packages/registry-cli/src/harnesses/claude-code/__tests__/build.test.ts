import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readlink, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type {
  IBuildSupport,
  IProfileBuildContext,
  IProfileManifest,
  ITemplateContext,
  IUnifiedHarnessBuildContext,
} from "../../../lib/harnessBuild";
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
} from "../../../lib/harnessBuild";
import {
  createSettingsSyncRegistry,
  type ISettingsSyncRegistry,
} from "../../../lib/settingsSync/createSettingsSyncRegistry";
import plugin from "../build";

const originalArgv = [...process.argv];
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const originalXdgDataHome = process.env.XDG_DATA_HOME;

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "claude-code-build-tests");
const TEST_XDG_DATA_HOME = join(TEST_ROOT, "xdg-data-home");

let testDirectoryIndex = 0;

async function createOutputDirectory(): Promise<string> {
  testDirectoryIndex += 1;
  const directory = join(TEST_ROOT, `case-${testDirectoryIndex}`);
  await mkdir(directory, { recursive: true });
  return directory;
}

async function writeTestFile(
  repositoryRoot: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const fullPath = join(repositoryRoot, relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await Bun.write(fullPath, content);
  return fullPath;
}

function createTemplateContext(repositoryRoot: string) {
  return {
    commands_dir: join(repositoryRoot, "commands"),
    file_dir: repositoryRoot,
    file_path: join(repositoryRoot, "source.md"),
    output_dir: join(repositoryRoot, ".output"),
    profiles_dir: join(repositoryRoot, "profiles"),
    repo_root: repositoryRoot,
    skills_dir: join(repositoryRoot, "skills"),
  };
}

function createUnifiedContext(repositoryRoot: string): IUnifiedHarnessBuildContext {
  return {
    buildSupport: createBuildSupport(repositoryRoot),
    harnessDir: join(repositoryRoot, "harnesses", "claude-code"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
  };
}

type IProfileContextOverrides = {
  globalMatchedSkills?: string[];
  globalMatchedCommands?: string[];
  profileLocalSkills?: string[];
  profileLocalCommands?: string[];
  settingsSyncRegistry?: ISettingsSyncRegistry;
  systemPrompt?: string;
  tools?: Record<string, boolean>;
  permission?: Record<string, string | Record<string, string>>;
};

function createBuildSupport(
  repositoryRoot: string,
  settingsSyncRegistry: ISettingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output")),
): IBuildSupport {
  return {
    mergeDirectory,
    stageProfileAssets,
    writeBinScript,
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
    syncSettingsFile: settingsSyncRegistry.syncSettingsFile,
  };
}

function createProfileContext(
  repositoryRoot: string,
  profileName: string,
  overrides: IProfileContextOverrides = {},
): IProfileBuildContext {
  return {
    profileName,
    harnessDir: join(repositoryRoot, "harnesses", "claude-code"),
    profileDir: join(repositoryRoot, "profiles", profileName),
    manifest: {
      commands: ["review.md"],
      description: "Claude Code profile",
      permission: overrides.permission,
      skills: ["shared-skill"],
      system_prompt: overrides.systemPrompt ?? "Follow the repo guidance.\nEscalate risky changes.",
      tools: overrides.tools,
    },
    globalMatchedSkills: overrides.globalMatchedSkills ?? ["shared-skill"],
    globalMatchedCommands: overrides.globalMatchedCommands ?? ["review.md"],
    profileLocalSkills: overrides.profileLocalSkills ?? ["local-skill"],
    profileLocalCommands: overrides.profileLocalCommands ?? ["local.md"],
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(repositoryRoot, overrides.settingsSyncRegistry),
  };
}

async function writeHarnessFixture(repositoryRoot: string): Promise<void> {
  await writeTestFile(repositoryRoot, "harnesses/claude-code/settings.json", '{\n  "theme": "dark"\n}\n');
  await writeTestFile(repositoryRoot, "harnesses/claude-code/.registry-ignore", "./fetch-source.sh\n./skills/\n");
  await writeTestFile(repositoryRoot, "harnesses/claude-code/fetch-source.sh", "#!/bin/bash\n");
  await writeTestFile(repositoryRoot, "harnesses/claude-code/skills/harness-skill/SKILL.md", "# Harness skill\n");
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

function getFinalizeOutput(): NonNullable<typeof plugin.finalizeOutput> {
  assert(plugin.finalizeOutput);
  return plugin.finalizeOutput;
}

function getStageProfile(): NonNullable<typeof plugin.stageProfile> {
  assert(plugin.stageProfile);
  return plugin.stageProfile;
}

describe("Claude Code harness build", () => {
  beforeEach(() => {
    process.argv = ["bun", "scripts/bootstrap.ts"];
    delete process.env.CLAUDE_CONFIG_DIR;
    // Profile homes live under XDG_DATA_HOME, so every test points it at the
    // scratch tree instead of the developer's real data directory.
    process.env.XDG_DATA_HOME = TEST_XDG_DATA_HOME;
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    }

    if (originalXdgDataHome === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = originalXdgDataHome;
    }

    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("uses claude-code as the harness target", () => {
    expect(plugin.target).toBe("claude-code");
  });

  it("stages the default profile as the shared Claude Code base", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");

    expect(await readFile(join(defaultDir, "CLAUDE.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    expect(await readFile(join(defaultDir, "settings.json"), "utf-8")).toBe('{\n  "theme": "dark"\n}\n');
    expect(await readFile(join(defaultDir, "commands", "review.md"), "utf-8")).toBe("Review the changes.\n");
    expect(await readFile(join(defaultDir, "commands", "--default-local.md"), "utf-8")).toBe("Local command.\n");
    expect(await readFile(join(defaultDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe("# Shared skill\n");
    expect(await readFile(join(defaultDir, "skills", "local-skill", "SKILL.md"), "utf-8")).toBe("# Local skill\n");
    expect(await readFile(join(defaultDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe("# Harness skill\n");

    for (const skillName of ["shared-skill", "local-skill", "harness-skill"]) {
      expect((await lstat(join(defaultDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(false);
    }
  });

  it("keeps repo-only harness files out of the generated profile root", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    expect(existsSync(join(defaultDir, "fetch-source.sh"))).toBe(false);
    expect(existsSync(join(defaultDir, ".registry-ignore"))).toBe(false);
    // `skills/` is ignored by the raw harness copy so the skill bundles stay symlinks.
    expect((await lstat(join(defaultDir, "skills", "harness-skill", "SKILL.md"))).isSymbolicLink()).toBe(false);
  });

  it("keeps runtime state out of the generated default profile", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    // Session stores, history, and plugins belong to the real `~/.claude` home that
    // bootstrap links these entries into, so the build creates none of them.
    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    expect((await readdir(defaultDir)).sort()).toEqual(["CLAUDE.md", "commands", "settings.json", "skills"]);
    expect(existsSync(join(TEST_XDG_DATA_HOME, "ai-registry"))).toBe(false);
  });

  it("registers the default profile's settings.json for settings sync", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Local skill\n");

    const settingsSyncRegistry = createSettingsSyncRegistry(join(repositoryRoot, ".output"));
    await getStageProfile()(createProfileContext(repositoryRoot, "default", { settingsSyncRegistry }));
    await getStageProfile()(createProfileContext(repositoryRoot, "developer", { settingsSyncRegistry }));

    expect(settingsSyncRegistry.getSyncedSettingsFiles()).toEqual([
      { relativePath: "claude-code/default/settings.json", liveOnlyKeyPaths: [] },
    ]);
  });

  it("stages non-default profiles with per-profile memory and skills", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Local skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "developer", {
      systemPrompt: "Developer instructions.\nStay focused.",
    }));

    const developerDir = join(repositoryRoot, ".output", "claude-code", "developer");
    expect(await readFile(join(developerDir, "CLAUDE.md"), "utf-8")).toBe(
      "Developer instructions.\nStay focused.\n",
    );
    expect(await readFile(join(developerDir, "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Shared skill\n",
    );
    expect(await readFile(join(developerDir, "skills", "local-skill", "SKILL.md"), "utf-8")).toBe("# Local skill\n");
    expect(await readFile(join(developerDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
  });

  it("builds per-profile CLAUDE.md and symlinks the other shared entries", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the default changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Default local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Default local skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/commands/local.md", "Developer local command.\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Developer local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "skills/developer-shared-skill/SKILL.md", "# Developer shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default", {
      profileLocalCommands: ["local.md"],
      profileLocalSkills: ["local-skill"],
      systemPrompt: "Default instructions.\nStay shared.",
    }));
    await getStageProfile()(createProfileContext(repositoryRoot, "developer", {
      globalMatchedCommands: ["developer-only.md"],
      globalMatchedSkills: ["developer-shared-skill"],
      profileLocalCommands: ["local.md"],
      profileLocalSkills: ["local-skill"],
      systemPrompt: "Developer-only instructions.\nShould ship here.",
    }));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const outputRoot = join(repositoryRoot, ".output", "claude-code");
    const developerDir = join(outputRoot, "developer");

    expect(await readFile(join(developerDir, "CLAUDE.md"), "utf-8")).toBe(
      "Developer-only instructions.\nShould ship here.\n",
    );
    expect(await readlink(join(developerDir, "settings.json"))).toBe(join(outputRoot, "default", "settings.json"));
    expect(await readlink(join(developerDir, "commands"))).toBe(join(outputRoot, "default", "commands"));
    // Runtime state is shared through the profile home that bootstrap creates, not here.
    expect((await readdir(developerDir)).sort()).toEqual(["CLAUDE.md", "commands", "settings.json", "skills"]);

    // Shared commands resolve through the symlink; skills stay per-profile.
    expect(await readFile(join(developerDir, "commands", "review.md"), "utf-8")).toBe(
      "Review the default changes.\n",
    );
    expect(await readFile(join(developerDir, "skills", "developer-shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer shared skill\n",
    );
    expect(await readFile(join(developerDir, "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer local skill\n",
    );
    expect(await readFile(join(developerDir, "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
    expect(existsSync(join(developerDir, "skills", "shared-skill"))).toBe(false);
  });

  it("rejects profiles that declare tools or permission", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);

    await expect(
      getStageProfile()(createProfileContext(repositoryRoot, "developer", { tools: { bash: false } })),
    ).rejects.toThrow('Claude Code harness does not support manifest.tools yet for profile "developer".');

    await expect(
      getStageProfile()(createProfileContext(repositoryRoot, "designer", { permission: { edit: "ask" } })),
    ).rejects.toThrow('Claude Code harness does not support manifest.permission yet for profile "designer".');
  });

  it("fails when the default profile was not generated", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await createClaudeCodeProfile(join(repositoryRoot, ".output"), "developer");

    await expect(getFinalizeOutput()(createUnifiedContext(repositoryRoot))).rejects.toThrow(
      `Generated Claude Code default profile does not exist: ${join(repositoryRoot, ".output", "claude-code", "default")}`,
    );
  });

  it("generates launcher helpers for non-default profiles and cll for litellm", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, ".output/claude-code/default/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, ".output/claude-code/designer/CLAUDE.md", "designer\n");

    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const binDir = join(repositoryRoot, ".output", "bin");
    expect((await readdir(binDir)).sort()).toEqual(["claude-designer", "cll"]);

    const helper = await readFile(join(binDir, "claude-designer"), "utf-8");
    expect(helper).toContain(
      'CLAUDE_CONFIG_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/ai-registry/claude-code/profiles/designer" exec "$real_binary" "$@"',
    );
    expect(helper).toContain("if command -v claude >/dev/null 2>&1; then");

    const cllHelper = await readFile(join(binDir, "cll"), "utf-8");
    expect(cllHelper).toContain('MODEL="${CLAUDE_MODEL:-gemini-3.7-flash}"');
    expect(cllHelper).toContain('ANTHROPIC_CUSTOM_MODEL_OPTION="$MODEL"');
    expect(cllHelper).toContain('export CLAUDE_CODE_MAX_CONTEXT_TOKENS="${CLAUDE_CODE_MAX_CONTEXT_TOKENS:-1000000}"');
    expect(cllHelper).toContain('exec "$real_binary" --dangerously-skip-permissions --model "$MODEL" "$@"');
  });

  it("applies the default Claude Code profile when bootstrap did not request an override", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createClaudeCodeProfile(outputDir, "default");

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config (default)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".claude"),
      },
    ]);
  });

  it("applies the explicitly requested Claude Code profile and gives it its own home", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createClaudeCodeProfile(outputDir, "designer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--claude-code-profile", "designer"];

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config (designer)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".claude"),
      },
      {
        kind: "home",
        description: "Claude Code profile home (designer)",
        sourcePath: profileDir,
        targetPath: join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", "profiles", "designer"),
        sharedHomePath: join(homedir(), ".claude"),
      },
    ]);
  });

  it("gives every non-default Claude Code profile a home that shares the default home's runtime state", async () => {
    const outputDir = await createOutputDirectory();
    const defaultProfileDir = await createClaudeCodeProfile(outputDir, "default");
    const designerProfileDir = await createClaudeCodeProfile(outputDir, "designer");
    const targetPath = join(outputDir, "custom-claude-config");
    process.env.CLAUDE_CONFIG_DIR = targetPath;

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config (default)",
        sourcePath: defaultProfileDir,
        targetPath,
      },
      {
        kind: "home",
        description: "Claude Code profile home (designer)",
        sourcePath: designerProfileDir,
        targetPath: join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", "profiles", "designer"),
        sharedHomePath: targetPath,
      },
    ]);
  });

  it("uses CLAUDE_CONFIG_DIR for the bootstrap target", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createClaudeCodeProfile(outputDir, "default");
    const targetPath = join(outputDir, "custom-claude-config");
    process.env.CLAUDE_CONFIG_DIR = targetPath;

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        kind: "home",
        description: "Claude Code config (default)",
        sourcePath: profileDir,
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

    await getStageProfile()(createProfileContext(repositoryRoot, "default", {
      globalMatchedSkills: ["shared-skill"],
      globalMatchedCommands: [],
      profileLocalSkills: [],
      profileLocalCommands: [],
    }));
    await getStageProfile()(createProfileContext(repositoryRoot, "developer", {
      globalMatchedSkills: ["shared-skill"],
      globalMatchedCommands: [],
      profileLocalSkills: [],
      profileLocalCommands: [],
    }));

    const skillDir = join(repositoryRoot, ".output", "claude-code", "default", "skills", "shared-skill");
    expect(await readFile(join(skillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(skillDir, "extra.txt"))).toBe(false);

    const devSkillDir = join(repositoryRoot, ".output", "claude-code", "developer", "skills", "shared-skill");
    expect(await readFile(join(devSkillDir, "SKILL.md"), "utf-8")).toBe("# Harness version\n");
    expect(existsSync(join(devSkillDir, "extra.txt"))).toBe(false);
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

    await getStageProfile()(createProfileContext(repositoryRoot, "default", {
      globalMatchedSkills: [],
      globalMatchedCommands: [],
      profileLocalSkills: [],
      profileLocalCommands: [],
    }));

    const agentSkillDir = join(repositoryRoot, ".output", "claude-code", "default", "skills", "harness-agent-skill");
    const userSkillDir = join(repositoryRoot, ".output", "claude-code", "default", "skills", "harness-user-skill");

    expect(await readFile(join(agentSkillDir, "SKILL.md"), "utf-8")).toBe(
      "---\nname: harness-agent-skill\n---\n# Agent\n",
    );
    expect(await readFile(join(userSkillDir, "SKILL.md"), "utf-8")).toBe(
      "---\ndisable-model-invocation: true\nname: harness-user-skill\n---\n# User\n",
    );
  });

  it("reports generated Claude Code profiles when the requested profile is missing", async () => {
    const outputDir = await createOutputDirectory();
    await createClaudeCodeProfile(outputDir, "designer");
    await createClaudeCodeProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--claude-code-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Claude Code profile does not exist: ${join(outputDir, "claude-code", "removed")}. Available generated Claude Code profiles: designer, developer.`,
    );
  });
});

async function createClaudeCodeProfile(outputDir: string, profileName: string): Promise<string> {
  const profileDir = join(outputDir, "claude-code", profileName);
  await mkdir(profileDir, { recursive: true });
  return profileDir;
}
