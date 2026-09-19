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
import { createRuntimeDirectoryRegistry, type IRuntimeDirectoryRegistry } from "../../../lib/generatedOutputUtils";
import plugin from "../build";

const originalArgv = [...process.argv];
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const originalXdgDataHome = process.env.XDG_DATA_HOME;

const TEST_ROOT = join(
  process.cwd(),
  "packages",
  "registry-cli",
  "src",
  "harnesses",
  "claude-code",
  ".tmp",
  "claude-code-build-tests",
);
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
  runtimeDirectoryRegistry?: IRuntimeDirectoryRegistry;
  systemPrompt?: string;
  tools?: Record<string, boolean>;
  permission?: Record<string, string | Record<string, string>>;
};

function createBuildSupport(
  repositoryRoot: string,
  runtimeDirectoryRegistry: IRuntimeDirectoryRegistry = createRuntimeDirectoryRegistry(join(repositoryRoot, ".output")),
): IBuildSupport {
  return {
    mergeDirectory,
    stageProfileAssets,
    writeBinScript,
    copyDirectoryWithTemplateVariables,
    copyPathWithTemplateVariables,
    ensureRuntimeDirectory: runtimeDirectoryRegistry.ensureRuntimeDirectory,
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
    buildSupport: createBuildSupport(repositoryRoot, overrides.runtimeDirectoryRegistry),
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
    // The project store lives outside the generated output, so every test points
    // XDG_DATA_HOME at the scratch tree instead of the developer's real store.
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

  it("materializes shared runtime directories in the default profile only", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    const runtimeDirectoryRegistry = createRuntimeDirectoryRegistry(join(repositoryRoot, ".output"));
    await getStageProfile()(createProfileContext(repositoryRoot, "default", { runtimeDirectoryRegistry }));

    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    for (const runtimeDirName of ["statsig", "file-history", "session-env"]) {
      const runtimeDirStats = await lstat(join(defaultDir, runtimeDirName));
      expect(runtimeDirStats.isDirectory()).toBe(true);
      expect(runtimeDirStats.isSymbolicLink()).toBe(false);
    }

    // Claude Code owns these afterwards, so they must be registered as runtime
    // directories rather than becoming manifest-managed entries. The persistent
    // stores are deliberately absent: they are not runtime state.
    expect(runtimeDirectoryRegistry.getRuntimeDirectoryPaths()).toEqual([
      "claude-code/default/file-history",
      "claude-code/default/session-env",
      "claude-code/default/statsig",
    ]);
  });

  it("links every persistent store from the XDG data directory into the default profile", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    const runtimeDirectoryRegistry = createRuntimeDirectoryRegistry(join(repositoryRoot, ".output"));
    await getStageProfile()(createProfileContext(repositoryRoot, "default", { runtimeDirectoryRegistry }));

    const defaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    for (const storeDirName of ["plugins", "projects", "sessions", "shell-snapshots", "todos"]) {
      const storePath = join(defaultDir, storeDirName);
      const storeStats = await lstat(storePath);
      expect(storeStats.isSymbolicLink()).toBe(true);
      expect(await readlink(storePath)).toBe(join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", storeDirName));
      expect(existsSync(storePath)).toBe(true);
    }
  });

  it("migrates existing directory-based stores into the persistent location", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    // Simulate an existing build that had real directories under .output/claude-code/default/
    const existingDefaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    await mkdir(join(existingDefaultDir, "projects"), { recursive: true });
    await Bun.write(join(existingDefaultDir, "projects", "legacy.txt"), "legacy memory\n");
    await mkdir(join(existingDefaultDir, "sessions"), { recursive: true });
    await Bun.write(join(existingDefaultDir, "sessions", "legacy.json"), "legacy session\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    // Staging must have moved the directories into the persistent store root
    // and replaced them with symlinks.
    const projectStorePath = join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", "projects");
    const sessionStorePath = join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", "sessions");

    expect(await readFile(join(projectStorePath, "legacy.txt"), "utf-8")).toBe("legacy memory\n");
    expect(await readFile(join(sessionStorePath, "legacy.json"), "utf-8")).toBe("legacy session\n");

    expect((await lstat(join(existingDefaultDir, "projects"))).isSymbolicLink()).toBe(true);
    expect((await lstat(join(existingDefaultDir, "sessions"))).isSymbolicLink()).toBe(true);
    expect(await readlink(join(existingDefaultDir, "projects"))).toBe(projectStorePath);
    expect(await readlink(join(existingDefaultDir, "sessions"))).toBe(sessionStorePath);
  });

  it("fails staging when both the legacy output directory and the persistent store exist", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    const existingDefaultDir = join(repositoryRoot, ".output", "claude-code", "default");
    await mkdir(join(existingDefaultDir, "projects"), { recursive: true });
    await mkdir(join(TEST_XDG_DATA_HOME, "ai-registry", "claude-code", "projects"), { recursive: true });

    await expect(getStageProfile()(createProfileContext(repositoryRoot, "default"))).rejects.toThrow(
      "Cannot move the Claude Code projects store",
    );
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

  it("generates launcher helpers for non-default profiles and cll for litellm", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeHarnessFixture(repositoryRoot);
    await writeTestFile(repositoryRoot, ".output/claude-code/default/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, ".output/claude-code/designer/CLAUDE.md", "designer\n");

    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    const binDir = join(repositoryRoot, ".output", "bin");
    expect((await readdir(binDir)).sort()).toEqual(["claude-designer", "cll"]);

    const helper = await readFile(join(binDir, "claude-designer"), "utf-8");
    expect(helper).toContain('CLAUDE_CONFIG_DIR="{{output_dir}}/claude-code/designer" exec "$real_binary" "$@"');
    expect(helper).toContain("if command -v claude >/dev/null 2>&1; then");

    const cllHelper = await readFile(join(binDir, "cll"), "utf-8");
    expect(cllHelper).toContain('MODEL="${CLAUDE_MODEL:-gemini-3.7-flash}"');
    expect(cllHelper).toContain('ANTHROPIC_CUSTOM_MODEL_OPTION="$MODEL"');
    expect(cllHelper).toContain('exec "$real_binary" --dangerously-skip-permissions --model "$MODEL" "$@"');
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
});

async function createClaudeCodeProfile(outputDir: string, profileName: string): Promise<string> {
  const profileDir = join(outputDir, "claude-code", profileName);
  await mkdir(profileDir, { recursive: true });
  return profileDir;
}
