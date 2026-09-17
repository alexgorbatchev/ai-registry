import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

import plugin from "../build";
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  symlinkDirectoryWithOriginalFiles,
  writeBinScript,
  type IBuildSupport,
  type IProfileBuildContext,
  type ITemplateContext,
  type IUnifiedHarnessBuildContext,
} from "../../../lib/harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "claude-code-build-tests");
const originalArgv: string[] = [...process.argv];
const originalClaudeConfigDir: string | undefined = process.env.CLAUDE_CONFIG_DIR;

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return await mkdtemp(join(TEST_ROOT, "case-"));
}

async function createClaudeCodeProfile(outputDir: string, profileName: string): Promise<string> {
  const profileDir = join(outputDir, "claude-code", profileName);
  await mkdir(profileDir, { recursive: true });
  return profileDir;
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
    symlinkDirectoryWithOriginalFiles,
  };
}

function createUnifiedContext(repositoryRoot: string): IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "claude-code"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(),
  };
}

type IProfileContextOverrides = {
  globalMatchedCommands?: string[];
  globalMatchedSkills?: string[];
  permission?: Record<string, string | Record<string, string>>;
  profileLocalCommands?: string[];
  profileLocalSkills?: string[];
  systemPrompt?: string;
  tools?: Record<string, boolean>;
};

function createProfileContext(
  repositoryRoot: string,
  profileName: string,
  overrides: IProfileContextOverrides = {},
): IProfileBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "claude-code"),
    profileName,
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
    buildSupport: createBuildSupport(),
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
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
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
      expect((await lstat(join(defaultDir, "skills", skillName, "SKILL.md"))).isSymbolicLink()).toBe(true);
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
    expect((await lstat(join(defaultDir, "skills", "harness-skill", "SKILL.md"))).isSymbolicLink()).toBe(true);
  });

  it("materializes shared runtime directories in the default profile only", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    for (const runtimeDirName of ["projects", "sessions", "todos", "shell-snapshots", "plugins", "statsig", "file-history", "session-env"]) {
      const runtimeDirStats = await lstat(join(defaultDir, runtimeDirName));
      expect(runtimeDirStats.isDirectory()).toBe(true);
      expect(runtimeDirStats.isSymbolicLink()).toBe(false);
    }
  });

  it("builds per-profile CLAUDE.md and symlinks the other shared entries", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the default changes.\n");
    await writeTestFile(repositoryRoot, "commands/developer-only.md", "Developer-only command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Default local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Default local skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Developer local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "skills/developer-shared-skill/SKILL.md", "# Developer shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default", {
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
    expect(await readlink(join(developerDir, "sessions"))).toBe(join(outputRoot, "default", "sessions"));
    expect(await readlink(join(developerDir, "plugins"))).toBe(join(outputRoot, "default", "plugins"));

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

  it("generates launcher helpers for non-default profiles only", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, ".output/claude-code/default/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, ".output/claude-code/designer/CLAUDE.md", "designer\n");

    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const binDir = join(repositoryRoot, ".output", "bin");
    expect(await readdir(binDir)).toEqual(["claude-designer"]);

    const helper = await readFile(join(binDir, "claude-designer"), "utf-8");
    expect(helper).toContain('CLAUDE_CONFIG_DIR="{{output_dir}}/claude-code/designer" exec "$real_binary" "$@"');
    expect(helper).toContain("if command -v claude >/dev/null 2>&1; then");
  });

  it("links the default Claude Code profile when bootstrap did not request an override", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createClaudeCodeProfile(outputDir, "default");

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        description: "Claude Code config (default)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".claude"),
      },
    ]);
  });

  it("links the explicitly requested Claude Code profile", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createClaudeCodeProfile(outputDir, "designer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--claude-code-profile", "designer"];

    expect(await getBootstrapTargets()(outputDir)).toEqual([
      {
        description: "Claude Code config (designer)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".claude"),
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
        description: "Claude Code config (default)",
        sourcePath: profileDir,
        targetPath,
      },
    ]);
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

  it("reports that no profiles exist when nothing was generated", async () => {
    const outputDir = await createOutputDirectory();
    process.argv = ["bun", "scripts/bootstrap.ts", "--claude-code-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Claude Code profile does not exist: ${join(outputDir, "claude-code", "removed")}. No generated Claude Code profiles are available.`,
    );
  });

  it("rejects an empty --claude-code-profile value", async () => {
    const outputDir = await createOutputDirectory();
    process.argv = ["bun", "scripts/bootstrap.ts", "--claude-code-profile", ""];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      "Missing Claude Code profile name after --claude-code-profile.",
    );
  });
});
