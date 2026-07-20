import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { syncBackModifiedFiles } from "../buildCommand";
import type { IGeneratedOutputDrift } from "../../lib/generatedOutputUtils";

const TEST_ROOT = join(import.meta.dir, "..", "..", "lib", "__tests__", ".tmp", "sync-back-tests");
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

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("syncBackModifiedFiles", () => {
  it("correctly syncs back modified files and reverses template tokens", async () => {
    const repositoryRoot = await createTestDirectory();
    const sourceDir = join(repositoryRoot, "skills");
    const outputDir = join(repositoryRoot, ".output");
    const nextOutputDir = join(repositoryRoot, ".tmp", "staging");

    const sourceFileRelativePath = "my-skill/SKILL.md";
    const sourceFilePath = join(sourceDir, sourceFileRelativePath);
    await writeTestFile(sourceDir, sourceFileRelativePath, "Original content with {{skills_dir}}");

    // Output dir has the modified file with absolute path resolved
    const outputRelativePath = "pi/default/skills/my-skill/SKILL.md";
    const resolvedPathText = `Modified content with ${sourceDir}`;
    await writeTestFile(outputDir, outputRelativePath, resolvedPathText);

    // Staging dir has the compiled file before modifications
    const nextOutputPath = join(nextOutputDir, outputRelativePath);
    await writeTestFile(nextOutputDir, outputRelativePath, `Original content compiled with ${sourceDir}`);

    const sourcePathByOutputPath = new Map<string, string>();
    sourcePathByOutputPath.set(nextOutputPath, sourceFilePath);

    const templateContext = {
      repo_root: repositoryRoot,
      skills_dir: sourceDir,
    };

    const drift: IGeneratedOutputDrift[] = [
      { path: outputRelativePath, reason: "modified" },
    ];

    await syncBackModifiedFiles(
      drift,
      outputDir,
      nextOutputDir,
      sourcePathByOutputPath,
      templateContext,
    );

    // 1. Source file should have been updated with the reversed content
    const sourceContent = await readFile(sourceFilePath, "utf-8");
    expect(sourceContent).toBe("Modified content with {{skills_dir}}");

    // 2. The staging file should have been updated with the modified file from outputDir
    const stagingContent = await readFile(nextOutputPath, "utf-8");
    expect(stagingContent).toBe(resolvedPathText);
  });

  it("safely ignores non-modified drift items", async () => {
    const repositoryRoot = await createTestDirectory();
    const sourceDir = join(repositoryRoot, "skills");
    const outputDir = join(repositoryRoot, ".output");
    const nextOutputDir = join(repositoryRoot, ".tmp", "staging");

    const sourceFileRelativePath = "my-skill/SKILL.md";
    const sourceFilePath = join(sourceDir, sourceFileRelativePath);
    await writeTestFile(sourceDir, sourceFileRelativePath, "Original content");

    const outputRelativePath = "pi/default/skills/my-skill/SKILL.md";
    await writeTestFile(outputDir, outputRelativePath, "Modified content");

    const nextOutputPath = join(nextOutputDir, outputRelativePath);
    await writeTestFile(nextOutputDir, outputRelativePath, "Original compiled");

    const sourcePathByOutputPath = new Map<string, string>();
    sourcePathByOutputPath.set(nextOutputPath, sourceFilePath);

    const drift: IGeneratedOutputDrift[] = [
      { path: outputRelativePath, reason: "missing" },
    ];

    await syncBackModifiedFiles(
      drift,
      outputDir,
      nextOutputDir,
      sourcePathByOutputPath,
      {},
    );

    // Source file should NOT be updated because reason is "added" rather than "modified"
    const sourceContent = await readFile(sourceFilePath, "utf-8");
    expect(sourceContent).toBe("Original content");
  });

  it("safely handles missing original source file mappings", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const nextOutputDir = join(repositoryRoot, ".tmp", "staging");

    const outputRelativePath = "pi/default/skills/my-skill/SKILL.md";
    await writeTestFile(outputDir, outputRelativePath, "Modified content");

    const nextOutputPath = join(nextOutputDir, outputRelativePath);
    await writeTestFile(nextOutputDir, outputRelativePath, "Original compiled");

    const sourcePathByOutputPath = new Map<string, string>(); // empty map

    const drift: IGeneratedOutputDrift[] = [
      { path: outputRelativePath, reason: "modified" },
    ];

    // This should run without throwing any errors
    await syncBackModifiedFiles(
      drift,
      outputDir,
      nextOutputDir,
      sourcePathByOutputPath,
      {},
    );

    // Staging file should NOT be modified
    const stagingContent = await readFile(nextOutputPath, "utf-8");
    expect(stagingContent).toBe("Original compiled");
  });
});
