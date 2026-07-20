import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import opencodePlugin from "../../harnesses/opencode/build";
const syncBack = opencodePlugin.syncBack!;
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
  type IBuildSupport,
  type ITemplateContext,
} from "../harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "syncback-tests");

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

describe("OpenCode syncBack", () => {
  let repositoryRoot: string;
  let activeDir: string;

  beforeEach(async () => {
    repositoryRoot = await createTestDirectory();
    activeDir = join(repositoryRoot, "active-agent");
    process.env.OPENCODE_CONFIG_DIR = activeDir;
  });

  afterEach(async () => {
    delete process.env.OPENCODE_CONFIG_DIR;
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("does not update source when active configuration matches source", async () => {
    const sourceConfig = '{"plugin": ["file://{{repo_root}}/vendor/opencode-context-inspector"]}\n';
    const compiledConfig = '{"plugin": ["file://' + repositoryRoot + '/vendor/opencode-context-inspector"]}\n';

    await writeTestFile(repositoryRoot, "harnesses/opencode/opencode.jsonc", sourceConfig);
    await writeTestFile(repositoryRoot, ".output/opencode/opencode.jsonc", compiledConfig);
    await writeTestFile(activeDir, "opencode.jsonc", compiledConfig);

    const context = {
      harnessDir: join(repositoryRoot, "harnesses", "opencode"),
      outputDir: join(repositoryRoot, ".output"),
      templateContext: createTemplateContext(repositoryRoot),
      buildSupport: createBuildSupport(),
    };

    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "opencode", "opencode.jsonc"), "utf-8");
    expect(sourceContent).toBe(sourceConfig);
  });

  it("updates repository source when active configuration has runtime changes", async () => {
    const compiledConfig = '{"plugin": ["file://' + repositoryRoot + '/vendor/opencode-context-inspector"]}\n';
    const activeConfig = '{"plugin": ["file://' + repositoryRoot + '/vendor/opencode-context-inspector", "file://' + repositoryRoot + '/vendor/another"]}\n';

    await writeTestFile(repositoryRoot, "harnesses/opencode/opencode.jsonc", '{"plugin": ["file://{{repo_root}}/vendor/opencode-context-inspector"]}\n');
    await writeTestFile(repositoryRoot, ".output/opencode/opencode.jsonc", compiledConfig);
    await writeTestFile(activeDir, "opencode.jsonc", activeConfig);

    const context = {
      harnessDir: join(repositoryRoot, "harnesses", "opencode"),
      outputDir: join(repositoryRoot, ".output"),
      templateContext: createTemplateContext(repositoryRoot),
      buildSupport: createBuildSupport(),
    };

    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "opencode", "opencode.jsonc"), "utf-8");
    expect(JSON.parse(sourceContent)).toEqual({
      plugin: [
        "file://{{repo_root}}/vendor/opencode-context-inspector",
        "file://{{repo_root}}/vendor/another"
      ]
    });
  });

  it("throws conflict error when both repository source and active config have changed from compiled version", async () => {
    const compiledConfig = '{"plugin": ["file://' + repositoryRoot + '/vendor/opencode-context-inspector"]}\n';
    const sourceConfig = '{"plugin": ["file://{{repo_root}}/vendor/opencode-context-inspector", "file://{{repo_root}}/vendor/source"]}\n';
    const activeConfig = '{"plugin": ["file://' + repositoryRoot + '/vendor/opencode-context-inspector", "file://' + repositoryRoot + '/vendor/active"]}\n';

    await writeTestFile(repositoryRoot, "harnesses/opencode/opencode.jsonc", sourceConfig);
    await writeTestFile(repositoryRoot, ".output/opencode/opencode.jsonc", compiledConfig);
    await writeTestFile(activeDir, "opencode.jsonc", activeConfig);

    const context = {
      harnessDir: join(repositoryRoot, "harnesses", "opencode"),
      outputDir: join(repositoryRoot, ".output"),
      templateContext: createTemplateContext(repositoryRoot),
      buildSupport: createBuildSupport(),
    };

    await expect(syncBack(context)).rejects.toThrow(
      "Conflict detected in OpenCode config! Both repository source and active settings have changed. Please resolve manually."
    );
  });
});
