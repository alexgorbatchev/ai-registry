import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, lstat, readFile, readlink, rm, writeFile } from "fs/promises";
import { homedir } from "os";
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
  type IUnifiedHarnessBuildContext,
} from "../../../../scripts/lib/harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "codex-build-tests");
const originalArgv: string[] = [...process.argv];
const originalCodexHome: string | undefined = process.env.CODEX_HOME;

type IProfileContextOverrides = {
  globalMatchedSkills?: string[];
  globalMatchedCommands?: string[];
  profileLocalSkills?: string[];
  profileLocalCommands?: string[];
  systemPrompt?: string;
};

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

function createProfileContext(
  repositoryRoot: string,
  profileName: string,
  overrides: IProfileContextOverrides = {},
): IProfileBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "codex"),
    profileName,
    profileDir: join(repositoryRoot, "profiles", profileName),
    manifest: {
      commands: overrides.globalMatchedCommands ?? ["review.md"],
      description: "Developer profile",
      skills: overrides.globalMatchedSkills ?? ["shared-skill"],
      system_prompt: overrides.systemPrompt ?? "Follow the repo guidance.\nEscalate risky changes.",
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

function createUnifiedContext(repositoryRoot: string): IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "codex"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(),
  };
}

function getStageProfile(): NonNullable<typeof plugin.stageProfile> {
  assert(plugin.stageProfile);
  return plugin.stageProfile;
}

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

function getFinalizeOutput(): NonNullable<typeof plugin.finalizeOutput> {
  assert(plugin.finalizeOutput);
  return plugin.finalizeOutput;
}

describe("Codex harness build plugin", () => {
  beforeEach(() => {
    process.argv = ["bun", "scripts/bootstrap.ts"];
    delete process.env.CODEX_HOME;
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    process.env.CODEX_HOME = originalCodexHome;
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("stages the default Codex profile as the shared root", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/rules/default.rules", "prefix_rule(pattern = [\"git\", \"reset\"], decision = \"forbidden\")\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "AGENTS.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "prompts", "review.md"), "utf-8")).toBe(
      "Review the changes.\n",
    );
    expect(
      await readFile(join(repositoryRoot, ".output", "codex", "default", "prompts", "--default-local.md"), "utf-8"),
    ).toBe("Local command.\n");
    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Shared skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "# Local skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "default", "rules", "default.rules"), "utf-8")).toBe(
      "prefix_rule(pattern = [\"git\", \"reset\"], decision = \"forbidden\")\n",
    );
    expect(await readlink(join(repositoryRoot, ".output", "codex", "default", "config.toml"))).toBe(
      join(repositoryRoot, ".tmp", "codex", "config.toml"),
    );
    await expect(lstat(join(repositoryRoot, ".output", "codex", "default", "auth.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(repositoryRoot, ".tmp", "codex", "config.toml"), "utf-8")).toBe("model = \"gpt-5.5\"\n");
  });

  it("builds per-profile AGENTS.md and symlinks other shared non-default Codex files", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the default changes.\n");
    await writeTestFile(repositoryRoot, "commands/developer-only.md", "Developer-only command.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "skills/developer-shared-skill/SKILL.md", "# Developer shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Default local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Default local skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/commands/local.md", "Developer local command.\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Developer local skill\n");

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

    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "AGENTS.md"), "utf-8")).toBe(
      "Developer-only instructions.\nShould ship here.\n",
    );
    expect(await readlink(join(repositoryRoot, ".output", "codex", "developer", "prompts"))).toBe(
      join(repositoryRoot, ".output", "codex", "default", "prompts"),
    );
    expect(await readlink(join(repositoryRoot, ".output", "codex", "developer", "config.toml"))).toBe(
      join(repositoryRoot, ".output", "codex", "default", "config.toml"),
    );
    await expect(lstat(join(repositoryRoot, ".output", "codex", "developer", "auth.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "prompts", "review.md"), "utf-8")).toBe(
      "Review the default changes.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "prompts", "--default-local.md"), "utf-8")).toBe(
      "Default local command.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "skills", "developer-shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer shared skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer local skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "codex", "developer", "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
  });

  it("preserves unmanaged entries in an existing mutable Codex config", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, ".tmp/codex/config.toml", "approval_policy = \"never\"\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    expect(await readFile(join(repositoryRoot, ".tmp", "codex", "config.toml"), "utf-8")).toBe(
      "approval_policy = \"never\"\nmodel = \"gpt-5.5\"\n",
    );
  });

  it("refreshes existing mutable Codex config from the harness seed while preserving local state", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n\n[features]\ngoals = true\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(
      repositoryRoot,
      ".tmp/codex/config.toml",
      "model = \"gpt-4.1\"\n\n[projects.\"/repo\"]\ntrust_level = \"trusted\"\n",
    );

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    expect(await readFile(join(repositoryRoot, ".tmp", "codex", "config.toml"), "utf-8")).toBe(
      "model = \"gpt-5.5\"\n\n[projects.\"/repo\"]\ntrust_level = \"trusted\"\n\n[features]\ngoals = true\n",
    );
  });

  it("removes stale managed Codex config keys when a newer harness seed omits them", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(
      repositoryRoot,
      ".tmp/codex/config.toml",
      "model = \"gpt-4.1\"\n\n[features]\ngoals = true\n\n[projects.\"/repo\"]\ntrust_level = \"trusted\"\n",
    );
    await writeTestFile(
      repositoryRoot,
      ".tmp/codex/managed-config.json",
      `${JSON.stringify({ model: "gpt-4.1", features: { goals: true } }, null, 2)}\n`,
    );

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));

    expect(await readFile(join(repositoryRoot, ".tmp", "codex", "config.toml"), "utf-8")).toBe(
      "model = \"gpt-5.5\"\n\n[projects.\"/repo\"]\ntrust_level = \"trusted\"\n",
    );
  });

  it("generates default and named Codex launcher helpers", async () => {
    const repositoryRoot = await createTestDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", "model = \"gpt-5.5\"\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Default command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Default local skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/commands/local.md", "Developer command.\n");
    await writeTestFile(repositoryRoot, "profiles/developer/skills/local-skill/SKILL.md", "# Developer local skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));
    await getStageProfile()(createProfileContext(repositoryRoot, "developer"));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    expect(await readFile(join(repositoryRoot, ".output", "bin", "codex"), "utf-8")).toMatchInlineSnapshot(`
"#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
generated_bin_dir="{{output_dir}}/bin"
filtered_path=""

IFS=':' read -r -a path_entries <<< "\${PATH:-}"
for path_entry in "\${path_entries[@]}"; do
  normalized_path="\${path_entry:-.}"
  if [ "$normalized_path" = "$script_dir" ] || [ "$normalized_path" = "$generated_bin_dir" ]; then
    continue
  fi

  if [ -n "$filtered_path" ]; then
    filtered_path="\${filtered_path}:$normalized_path"
  else
    filtered_path="$normalized_path"
  fi
done

PATH="$filtered_path"
export PATH

real_binary=""
if command -v codex >/dev/null 2>&1; then
  real_binary="codex"
else
  # Fallback to looking for backed-up shims in script_dir and generated_bin_dir
  latest_backup=""
  for backup_dir in "$script_dir" "$generated_bin_dir"; do
    for backup_file in "$backup_dir"/codex.backup-*; do
      if [ -x "$backup_file" ]; then
        if [ -z "$latest_backup" ] || [ "$backup_file" -nt "$latest_backup" ]; then
          latest_backup="$backup_file"
        fi
      fi
    done
  done

  if [ -n "$latest_backup" ]; then
    real_binary="$latest_backup"
  fi
fi

if [ -z "$real_binary" ]; then
  printf 'Could not find the real codex binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

CODEX_HOME="{{output_dir}}/codex/default" exec "$real_binary" "$@"
"
`);
    expect(await readFile(join(repositoryRoot, ".output", "bin", "codex-developer"), "utf-8")).toMatchInlineSnapshot(`
"#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
generated_bin_dir="{{output_dir}}/bin"
filtered_path=""

IFS=':' read -r -a path_entries <<< "\${PATH:-}"
for path_entry in "\${path_entries[@]}"; do
  normalized_path="\${path_entry:-.}"
  if [ "$normalized_path" = "$script_dir" ] || [ "$normalized_path" = "$generated_bin_dir" ]; then
    continue
  fi

  if [ -n "$filtered_path" ]; then
    filtered_path="\${filtered_path}:$normalized_path"
  else
    filtered_path="$normalized_path"
  fi
done

PATH="$filtered_path"
export PATH

real_binary=""
if command -v codex >/dev/null 2>&1; then
  real_binary="codex"
else
  # Fallback to looking for backed-up shims in script_dir and generated_bin_dir
  latest_backup=""
  for backup_dir in "$script_dir" "$generated_bin_dir"; do
    for backup_file in "$backup_dir"/codex.backup-*; do
      if [ -x "$backup_file" ]; then
        if [ -z "$latest_backup" ] || [ "$backup_file" -nt "$latest_backup" ]; then
          latest_backup="$backup_file"
        fi
      fi
    done
  done

  if [ -n "$latest_backup" ]; then
    real_binary="$latest_backup"
  fi
fi

if [ -z "$real_binary" ]; then
  printf 'Could not find the real codex binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

CODEX_HOME="{{output_dir}}/codex/developer" exec "$real_binary" "$@"
"
`);
  });

  it("links the default Codex profile when bootstrap did not request an override", async () => {
    const outputDir = await createTestDirectory();
    const profilePath = join(outputDir, "codex", "default");
    await mkdir(profilePath, { recursive: true });

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Codex home (default)",
        sourcePath: profilePath,
        targetPath: join(homedir(), ".codex"),
      },
    ]);
  });

  it("links the explicitly requested Codex profile root", async () => {
    const outputDir = await createTestDirectory();
    const profilePath = join(outputDir, "codex", "developer");
    await mkdir(profilePath, { recursive: true });
    process.argv = ["bun", "scripts/bootstrap.ts", "--codex-profile", "developer"];

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Codex home (developer)",
        sourcePath: profilePath,
        targetPath: join(homedir(), ".codex"),
      },
    ]);
  });

  it("uses CODEX_HOME for the explicitly requested Codex profile target", async () => {
    const outputDir = await createTestDirectory();
    const profilePath = join(outputDir, "codex", "designer");
    const targetPath = join(outputDir, "custom-codex-home");
    await mkdir(profilePath, { recursive: true });
    process.argv = ["bun", "scripts/bootstrap.ts", "--codex-profile", "designer"];
    process.env.CODEX_HOME = targetPath;

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Codex home (designer)",
        sourcePath: profilePath,
        targetPath,
      },
    ]);
  });

  it("uses CODEX_HOME for the default Codex profile target", async () => {
    const outputDir = await createTestDirectory();
    const profilePath = join(outputDir, "codex", "default");
    const targetPath = join(outputDir, "custom-codex-home");
    await mkdir(profilePath, { recursive: true });
    process.env.CODEX_HOME = targetPath;

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Codex home (default)",
        sourcePath: profilePath,
        targetPath,
      },
    ]);
  });

  it("reports generated Codex profiles when the requested profile is missing", async () => {
    const outputDir = await createTestDirectory();
    await mkdir(join(outputDir, "codex", "designer"), { recursive: true });
    await mkdir(join(outputDir, "codex", "developer"), { recursive: true });
    process.argv = ["bun", "scripts/bootstrap.ts", "--codex-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Codex profile does not exist: ${join(outputDir, "codex", "removed")}. Available generated Codex profiles: designer, developer.`,
    );
  });
});
