import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "fs/promises";
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

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "pi-build-tests");
const originalArgv: string[] = [...process.argv];
const originalPiCodingAgentDir: string | undefined = process.env.PI_CODING_AGENT_DIR;
const createdDirectories: string[] = [];

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const outputDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(outputDir);
  return outputDir;
}

async function createPiProfile(outputDir: string, profileName: string): Promise<string> {
  const profileDir = join(outputDir, "pi", profileName);
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
  };
}

function createUnifiedContext(repositoryRoot: string): IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "pi"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(),
  };
}

type IProfileContextOverrides = {
  globalMatchedCommands?: string[];
  globalMatchedSkills?: string[];
  profileLocalCommands?: string[];
  profileLocalSkills?: string[];
  systemPrompt?: string;
};

function createProfileContext(
  repositoryRoot: string,
  profileName: string,
  overrides: IProfileContextOverrides = {},
): IProfileBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "pi"),
    profileName,
    profileDir: join(repositoryRoot, "profiles", profileName),
    manifest: {
      commands: ["review.md"],
      description: "Pi profile",
      skills: ["shared-skill"],
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

describe("Pi harness bootstrap targets", () => {
  beforeEach(() => {
    process.argv = ["bun", "scripts/bootstrap.ts"];
    delete process.env.PI_CODING_AGENT_DIR;
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    process.env.PI_CODING_AGENT_DIR = originalPiCodingAgentDir;

    await rm(TEST_ROOT, { force: true, recursive: true });
    createdDirectories.length = 0;
  });

  it("links the default Pi profile when bootstrap did not request an override", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "default");

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (default)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".pi", "agent"),
      },
    ]);
  });

  it("links the explicitly requested Pi profile", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "developer"];

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (developer)",
        sourcePath: profileDir,
        targetPath: join(homedir(), ".pi", "agent"),
      },
    ]);
  });

  it("uses PI_CODING_AGENT_DIR for the explicitly requested Pi profile target", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "designer");
    const targetPath = join(outputDir, "custom-pi-agent");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "designer"];
    process.env.PI_CODING_AGENT_DIR = targetPath;

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (designer)",
        sourcePath: profileDir,
        targetPath,
      },
    ]);
  });

  it("uses PI_CODING_AGENT_DIR for the default Pi profile target", async () => {
    const outputDir = await createOutputDirectory();
    const profileDir = await createPiProfile(outputDir, "default");
    const targetPath = join(outputDir, "custom-pi-agent");
    process.env.PI_CODING_AGENT_DIR = targetPath;

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([
      {
        description: "Pi config (default)",
        sourcePath: profileDir,
        targetPath,
      },
    ]);
  });

  it("reports generated Pi profiles when the requested profile is missing", async () => {
    const outputDir = await createOutputDirectory();
    await createPiProfile(outputDir, "designer");
    await createPiProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Pi profile does not exist: ${join(outputDir, "pi", "removed")}. Available generated Pi profiles: designer, developer.`,
    );
  });

  it("stages the default Pi profile as the shared root", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the changes.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-install.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-uninstall.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-update.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/prompts/harness.md", "Harness prompt.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Local skill\n");
    await writeTestFile(repositoryRoot, "skills/shared-skill/SKILL.md", "# Shared skill\n");

    await getStageProfile()(createProfileContext(repositoryRoot, "default"));
    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "APPEND_SYSTEM.md"), "utf-8")).toBe(
      "Follow the repo guidance.\nEscalate risky changes.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "settings.json"), "utf-8")).toBe("{}\n");
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "prompts", "review.md"), "utf-8")).toBe(
      "Review the changes.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "prompts", "local.md"), "utf-8")).toBe(
      "Local command.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "prompts", "harness.md"), "utf-8")).toBe(
      "Harness prompt.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "skills", "shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Shared skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "# Local skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "default", "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
    expect((await lstat(join(repositoryRoot, ".output", "pi", "default", "sessions"))).isDirectory()).toBe(true);
    expect((await lstat(join(repositoryRoot, ".output", "pi", "default", "sessions"))).isSymbolicLink()).toBe(false);
  });

  it("builds per-profile APPEND_SYSTEM.md and symlinks other shared Pi files", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeTestFile(repositoryRoot, "commands/review.md", "Review the default changes.\n");
    await writeTestFile(repositoryRoot, "commands/developer-only.md", "Developer-only command.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-install.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-uninstall.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-update.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/prompts/harness.md", "Harness prompt.\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/skills/harness-skill/SKILL.md", "# Harness skill\n");
    await writeTestFile(repositoryRoot, "profiles/default/commands/local.md", "Default local command.\n");
    await writeTestFile(repositoryRoot, "profiles/default/skills/local-skill/SKILL.md", "# Default local skill\n");
    await writeTestFile(repositoryRoot, "profiles/developer/commands/local.md", "Developer local command.\n");
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

    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "APPEND_SYSTEM.md"), "utf-8")).toBe(
      "Developer-only instructions.\nShould ship here.\n",
    );
    expect(await readlink(join(repositoryRoot, ".output", "pi", "developer", "settings.json"))).toBe(
      join(repositoryRoot, ".output", "pi", "default", "settings.json"),
    );
    expect(await readlink(join(repositoryRoot, ".output", "pi", "developer", "prompts"))).toBe(
      join(repositoryRoot, ".output", "pi", "default", "prompts"),
    );
    expect(await readlink(join(repositoryRoot, ".output", "pi", "developer", "sessions"))).toBe(
      join(repositoryRoot, ".output", "pi", "default", "sessions"),
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "prompts", "review.md"), "utf-8")).toBe(
      "Review the default changes.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "prompts", "local.md"), "utf-8")).toBe(
      "Default local command.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "prompts", "harness.md"), "utf-8")).toBe(
      "Harness prompt.\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "skills", "developer-shared-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer shared skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "# Developer local skill\n",
    );
    expect(await readFile(join(repositoryRoot, ".output", "pi", "developer", "skills", "harness-skill", "SKILL.md"), "utf-8")).toBe(
      "# Harness skill\n",
    );
  });

  it("generates default and named Pi launcher helpers", async () => {
    const repositoryRoot = await createOutputDirectory();
    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", "{}\n");
    await writeTestFile(repositoryRoot, ".output/.pi-profiles/default/APPEND_SYSTEM.md", "default\n");
    await writeTestFile(repositoryRoot, ".output/.pi-profiles/developer/APPEND_SYSTEM.md", "developer\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-install.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-uninstall.sh", "#!/usr/bin/env bash\n");
    await writeTestFile(repositoryRoot, "harnesses/pi/templates/pi-update.sh", "#!/usr/bin/env bash\n");

    await getFinalizeOutput()(createUnifiedContext(repositoryRoot));

    expect(await readFile(join(repositoryRoot, ".output", "bin", "pi"), "utf-8")).toMatchInlineSnapshot(`
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
if command -v pi >/dev/null 2>&1; then
  real_binary="pi"
else
  # Fallback to looking for backed-up shims in script_dir and generated_bin_dir
  latest_backup=""
  for backup_dir in "$script_dir" "$generated_bin_dir"; do
    for backup_file in "$backup_dir"/pi.backup-*; do
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
  printf 'Could not find the real pi binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

PI_CODING_AGENT_DIR="{{output_dir}}/pi/default" exec "$real_binary" "$@"
"
`);
    expect(await readFile(join(repositoryRoot, ".output", "bin", "pi-developer"), "utf-8")).toMatchInlineSnapshot(`
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
if command -v pi >/dev/null 2>&1; then
  real_binary="pi"
else
  # Fallback to looking for backed-up shims in script_dir and generated_bin_dir
  latest_backup=""
  for backup_dir in "$script_dir" "$generated_bin_dir"; do
    for backup_file in "$backup_dir"/pi.backup-*; do
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
  printf 'Could not find the real pi binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

PI_CODING_AGENT_DIR="{{output_dir}}/pi/developer" exec "$real_binary" "$@"
"
`);
  });
});
