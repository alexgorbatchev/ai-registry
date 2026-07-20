import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { syncBack } from "../syncBack";
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
  type IBuildSupport,
  type ITemplateContext,
  type IUnifiedHarnessBuildContext,
} from "../../../../../scripts/lib/harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "syncback-tests");
const createdDirectories: string[] = [];

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const outputDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(outputDir);
  return outputDir;
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

describe("Pi syncBack", () => {
  let repositoryRoot: string;
  let activeDir: string;

  beforeEach(async () => {
    repositoryRoot = await createOutputDirectory();
    activeDir = join(repositoryRoot, "active-agent");
    process.env.PI_CODING_AGENT_DIR = activeDir;
  });

  afterEach(async () => {
    delete process.env.PI_CODING_AGENT_DIR;
    await rm(TEST_ROOT, { force: true, recursive: true });
    createdDirectories.length = 0;
  });

  it("does not update source when active configuration matches source", async () => {
    const sourceSettings = '{"packages": ["npm:a"]}\n';
    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", sourceSettings);
    await writeTestFile(repositoryRoot, ".output/pi/default/settings.json", sourceSettings);
    await writeTestFile(activeDir, "settings.json", sourceSettings);

    const context = createUnifiedContext(repositoryRoot);
    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "pi", "settings.json"), "utf-8");
    expect(sourceContent).toBe(sourceSettings);
  });

  it("updates repository source when active configuration has runtime changes", async () => {
    const compiledSettings = '{"packages": ["npm:a"]}\n';
    const activeSettings = '{"packages": ["npm:a", "npm:b"]}\n';

    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", compiledSettings);
    await writeTestFile(repositoryRoot, ".output/pi/default/settings.json", compiledSettings);
    await writeTestFile(activeDir, "settings.json", activeSettings);

    const context = createUnifiedContext(repositoryRoot);
    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "pi", "settings.json"), "utf-8");
    expect(JSON.parse(sourceContent)).toEqual({ packages: ["npm:a", "npm:b"] });
  });

  it("throws conflict error when both repository source and active config have changed from compiled version", async () => {
    const compiledSettings = '{"packages": ["npm:a"]}\n';
    const sourceSettings = '{"packages": ["npm:a", "npm:source"]}\n';
    const activeSettings = '{"packages": ["npm:a", "npm:active"]}\n';

    await writeTestFile(repositoryRoot, "harnesses/pi/settings.json", sourceSettings);
    await writeTestFile(repositoryRoot, ".output/pi/default/settings.json", compiledSettings);
    await writeTestFile(activeDir, "settings.json", activeSettings);

    const context = createUnifiedContext(repositoryRoot);
    await expect(syncBack(context)).rejects.toThrow(
      "Conflict detected in Pi settings.json! Both repository source and active settings have changed. Please resolve manually."
    );
  });
});
