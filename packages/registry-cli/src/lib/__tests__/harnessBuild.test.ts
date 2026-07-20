import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  applyTemplateVariablesToGeneratedOutput,
  copyPathWithTemplateVariables,
  type ITemplateContext,
} from "../harnessBuild";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "harness-build-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
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

describe("harnessBuild template rendering", () => {
  afterAll(async () => {
    for (const createdDirectory of createdDirectories) {
      await rm(createdDirectory, { recursive: true, force: true });
    }
  });

  it("renders file_dir in copied generated files from the original source path", async () => {
    const repositoryRoot = await createTestDirectory();
    const templateContext = createTemplateContext(repositoryRoot);
    const sourcePath = await writeTestFile(
      repositoryRoot,
      "skills/gitea/AGENTS.md",
      "To make changes you must edit files in `{{file_dir}}`.\n",
    );
    const outputPath = join(
      repositoryRoot,
      ".tmp",
      "generated-output-staging",
      "opencode",
      "skills",
      "gitea",
      "AGENTS.md",
    );
    const sourcePathByOutputPath = new Map<string, string>();

    await copyPathWithTemplateVariables(sourcePath, outputPath, templateContext, sourcePathByOutputPath);
    await applyTemplateVariablesToGeneratedOutput(
      join(repositoryRoot, ".tmp", "generated-output-staging"),
      templateContext,
      sourcePathByOutputPath,
    );

    expect(await Bun.file(outputPath).text()).toBe(
      `To make changes you must edit files in \`${join(repositoryRoot, "skills", "gitea")}\`.\n`,
    );
  });

  it("renders repo_root in generated files without an original source mapping", async () => {
    const repositoryRoot = await createTestDirectory();
    const templateContext = createTemplateContext(repositoryRoot);
    const outputPath = await writeTestFile(
      repositoryRoot,
      ".tmp/generated-output-staging/bin/helper.sh",
      "ROOT={{repo_root}}\n",
    );

    await applyTemplateVariablesToGeneratedOutput(
      join(repositoryRoot, ".tmp", "generated-output-staging"),
      templateContext,
      new Map<string, string>(),
    );

    expect(await Bun.file(outputPath).text()).toBe(`ROOT=${repositoryRoot}\n`);
  });
});
