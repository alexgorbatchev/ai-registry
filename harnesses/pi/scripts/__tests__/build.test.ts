import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
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

function getBootstrapTargets(): NonNullable<typeof plugin.getBootstrapTargets> {
  assert(plugin.getBootstrapTargets);
  return plugin.getBootstrapTargets;
}

function getFinalizeOutput(): NonNullable<typeof plugin.finalizeOutput> {
  assert(plugin.finalizeOutput);
  return plugin.finalizeOutput;
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

  it("does not require a default Pi profile when bootstrap did not request Pi linking", async () => {
    const outputDir = await createOutputDirectory();

    const targets = await getBootstrapTargets()(outputDir);

    expect(targets).toEqual([]);
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

  it("reports generated Pi profiles when the requested profile is missing", async () => {
    const outputDir = await createOutputDirectory();
    await createPiProfile(outputDir, "designer");
    await createPiProfile(outputDir, "developer");
    process.argv = ["bun", "scripts/bootstrap.ts", "--pi-profile", "removed"];

    await expect(getBootstrapTargets()(outputDir)).rejects.toThrow(
      `Generated Pi profile does not exist: ${join(outputDir, "pi", "removed")}. Available generated Pi profiles: designer, developer.`,
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

script_dir=\"$(cd \"$(dirname \"$0\")\" && pwd -P)\"
generated_bin_dir=\"{{output_dir}}/bin\"
filtered_path=\"\"

IFS=':' read -r -a path_entries <<< \"\${PATH:-}\"
for path_entry in \"\${path_entries[@]}\"; do
  normalized_path=\"\${path_entry:-.}\"
  if [ \"$normalized_path\" = \"$script_dir\" ] || [ \"$normalized_path\" = \"$generated_bin_dir\" ]; then
    continue
  fi

  if [ -n \"$filtered_path\" ]; then
    filtered_path=\"\${filtered_path}:$normalized_path\"
  else
    filtered_path=\"$normalized_path\"
  fi
done

PATH=\"$filtered_path\"
export PATH

if ! command -v pi >/dev/null 2>&1; then
  printf 'Could not find the real pi binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

PI_CODING_AGENT_DIR=\"{{output_dir}}/pi/default\" exec pi \"$@\"
"
`);
    expect(await readFile(join(repositoryRoot, ".output", "bin", "pi-developer"), "utf-8")).toMatchInlineSnapshot(`
"#!/usr/bin/env bash
set -euo pipefail

script_dir=\"$(cd \"$(dirname \"$0\")\" && pwd -P)\"
generated_bin_dir=\"{{output_dir}}/bin\"
filtered_path=\"\"

IFS=':' read -r -a path_entries <<< \"\${PATH:-}\"
for path_entry in \"\${path_entries[@]}\"; do
  normalized_path=\"\${path_entry:-.}\"
  if [ \"$normalized_path\" = \"$script_dir\" ] || [ \"$normalized_path\" = \"$generated_bin_dir\" ]; then
    continue
  fi

  if [ -n \"$filtered_path\" ]; then
    filtered_path=\"\${filtered_path}:$normalized_path\"
  else
    filtered_path=\"$normalized_path\"
  fi
done

PATH=\"$filtered_path\"
export PATH

if ! command -v pi >/dev/null 2>&1; then
  printf 'Could not find the real pi binary outside ai-registry wrapper paths.\\n' >&2
  exit 1
fi

PI_CODING_AGENT_DIR=\"{{output_dir}}/pi/developer\" exec pi \"$@\"
"
`);
  });
});
