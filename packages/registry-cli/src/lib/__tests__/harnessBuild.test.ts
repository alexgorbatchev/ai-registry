import { afterAll, describe, expect, it } from "bun:test";
import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { existsSync } from "fs";
import {
  applyTemplateVariablesToGeneratedOutput,
  copyDirectoryWithTemplateVariables,
  copyPathWithTemplateVariables,
  symlinkDirectoryWithOriginalFiles,
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

  it("respects .registry-ignore when copying a directory", async () => {
    const repositoryRoot = await createTestDirectory();
    const templateContext = createTemplateContext(repositoryRoot);

    const sourceDir = join(repositoryRoot, "harness-source");
    const targetDir = join(repositoryRoot, "harness-target");

    await writeTestFile(sourceDir, "should-be-kept.txt", "Keep this");
    await writeTestFile(sourceDir, "fetch-source.sh", "#!/bin/bash");
    await writeTestFile(sourceDir, ".tmp/some-source/file.txt", "source content");
    await writeTestFile(sourceDir, ".registry-ignore", "./fetch-source.sh\n./.tmp/\n");

    await copyDirectoryWithTemplateVariables(sourceDir, targetDir, templateContext);

    expect(existsSync(join(targetDir, "should-be-kept.txt"))).toBe(true);
    expect(existsSync(join(targetDir, "fetch-source.sh"))).toBe(false);
    expect(existsSync(join(targetDir, ".tmp"))).toBe(false);
    expect(existsSync(join(targetDir, ".tmp/some-source/file.txt"))).toBe(false);
  });

  it("creates symbolic links to original files when symlinking a skill directory", async () => {
    const repositoryRoot = await createTestDirectory();

    const sourceDir = join(repositoryRoot, "skills", "my-skill");
    const targetDir = join(repositoryRoot, "output", "skills", "my-skill");

    await writeTestFile(sourceDir, "SKILL.md", "# Skill Title");
    await writeTestFile(sourceDir, "references/ref.md", "# Reference");

    await symlinkDirectoryWithOriginalFiles(sourceDir, targetDir);

    const skillStat = await lstat(join(targetDir, "SKILL.md"));
    expect(skillStat.isSymbolicLink()).toBe(true);
    expect(await readlink(join(targetDir, "SKILL.md"))).toBe(join(sourceDir, "SKILL.md"));

    const refStat = await lstat(join(targetDir, "references", "ref.md"));
    expect(refStat.isSymbolicLink()).toBe(true);
    expect(await readlink(join(targetDir, "references", "ref.md"))).toBe(join(sourceDir, "references", "ref.md"));
  });
});
