import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import codexPlugin from "../../harnesses/codex/build";
const syncBack = codexPlugin.syncBack!;
import {
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  mergeDirectory,
  stageProfileAssets,
  writeBinScript,
  type IBuildSupport,
  type ITemplateContext,
  type IUnifiedHarnessBuildContext,
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

function createUnifiedContext(repositoryRoot: string): IUnifiedHarnessBuildContext {
  return {
    harnessDir: join(repositoryRoot, "harnesses", "codex"),
    outputDir: join(repositoryRoot, ".output"),
    templateContext: createTemplateContext(repositoryRoot),
    buildSupport: createBuildSupport(),
  };
}

describe("Codex syncBack", () => {
  let repositoryRoot: string;

  beforeEach(async () => {
    repositoryRoot = await createTestDirectory();
  });

  afterEach(async () => {
    await rm(TEST_ROOT, { force: true, recursive: true });
  });

  it("does not update source when active configuration matches source", async () => {
    const configContent = 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n';
    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", configContent);
    await writeTestFile(repositoryRoot, ".output/codex/default/config.toml", configContent);
    await writeTestFile(repositoryRoot, ".tmp/codex/config.toml", configContent);

    const context = createUnifiedContext(repositoryRoot);
    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "codex", "config.toml"), "utf-8");
    expect(sourceContent).toBe(configContent);
  });

  it("updates repository source when active configuration has runtime changes on managed keys", async () => {
    const compiledContent = 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n';
    const activeContent = 'approval_policy = "always"\nsandbox_mode = "danger-full-access"\n[projects."/repo"]\ntrust_level = "trusted"\n';

    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", compiledContent);
    await writeTestFile(repositoryRoot, ".output/codex/default/config.toml", compiledContent);
    await writeTestFile(repositoryRoot, ".tmp/codex/config.toml", activeContent);

    const context = createUnifiedContext(repositoryRoot);
    await syncBack(context);

    const sourceContent = await readFile(join(repositoryRoot, "harnesses", "codex", "config.toml"), "utf-8");
    expect(Bun.TOML.parse(sourceContent)).toEqual({
      approval_policy: "always",
      sandbox_mode: "danger-full-access",
      projects: {
        "/repo": {
          trust_level: "trusted"
        }
      }
    });
  });

  it("throws conflict error when both repository source and active config have changed from compiled version", async () => {
    const compiledContent = 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n';
    const sourceContent = 'approval_policy = "ask"\nsandbox_mode = "danger-full-access"\n';
    const activeContent = 'approval_policy = "always"\nsandbox_mode = "danger-full-access"\n';

    await writeTestFile(repositoryRoot, "harnesses/codex/config.toml", sourceContent);
    await writeTestFile(repositoryRoot, ".output/codex/default/config.toml", compiledContent);
    await writeTestFile(repositoryRoot, ".tmp/codex/config.toml", activeContent);

    const context = createUnifiedContext(repositoryRoot);
    await expect(syncBack(context)).rejects.toThrow(
      "Conflict detected in Codex config.toml at keys: approval_policy! Both repository source and active settings have changed. Please resolve manually."
    );
  });
});
