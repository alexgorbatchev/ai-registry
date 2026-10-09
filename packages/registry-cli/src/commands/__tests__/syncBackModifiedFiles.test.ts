import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { syncBackModifiedFiles } from "../buildCommand";
import type { IGeneratedOutputDrift } from "../../lib/generatedOutputUtils";
import { copyDirectoryWithTemplateVariables } from "../../lib/harnessBuild";

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
  it("recovers user skill edits into the selected variant while preserving the default and other hosts", async () => {
    const repositoryRoot = await createTestDirectory();
    const sourceDir = join(repositoryRoot, "skills/user/example");
    const defaultPath = await writeTestFile(sourceDir, "SKILL.md", "---\nname: example\ndescription: Example\nauthor: upstream\n---\nDefault.\n");
    const variantPath = await writeTestFile(sourceDir, "variants/workstation-a/SKILL.md", "---\nname: example\ndescription: Example\nauthor: upstream\n---\nHost A.\n");
    const otherPath = await writeTestFile(sourceDir, "variants/workstation-b/SKILL.md", "Host B.\n");
    const outputDir = join(repositoryRoot, ".output");
    const nextOutputDir = join(repositoryRoot, ".tmp/staging");
    const relativePath = "codex/default/skills/example/SKILL.md";
    const sourcePaths = new Map<string, string>();
    await copyDirectoryWithTemplateVariables(sourceDir, dirname(join(nextOutputDir, relativePath)), {}, sourcePaths, "workstation-a");
    expect(sourcePaths.get(join(nextOutputDir, relativePath))).toBe(variantPath);
    const editedContent = "---\ndisable-model-invocation: true\nname: upstream-example\ndescription: Example\nauthor: upstream\n---\nEdited host A.\n";
    await writeTestFile(outputDir, relativePath, editedContent);

    await syncBackModifiedFiles([{ path: relativePath, reason: "modified" }], outputDir, nextOutputDir, sourcePaths, {});

    expect(await Bun.file(variantPath).text()).toBe("---\nname: example\ndescription: Example\nauthor: upstream\n---\nEdited host A.\n");
    expect(await Bun.file(defaultPath).text()).toBe("---\nname: example\ndescription: Example\nauthor: upstream\n---\nDefault.\n");
    expect(await Bun.file(otherPath).text()).toBe("Host B.\n");
    expect(await Bun.file(join(nextOutputDir, relativePath)).text()).toBe(editedContent);
  });

  it("rejects recovery into a different source before writing any edits", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const nextOutputDir = join(repositoryRoot, ".tmp/staging");
    const relativePath = "codex/default/skills/example/SKILL.md";
    const originalSource = await writeTestFile(repositoryRoot, "skills/agent/example/variants/workstation-a/SKILL.md", "Host A.\n");
    const nextSource = await writeTestFile(repositoryRoot, "skills/agent/example/variants/workstation-b/SKILL.md", "Host B.\n");
    const nextOutputPath = await writeTestFile(nextOutputDir, relativePath, "Host B.\n");
    await writeTestFile(outputDir, relativePath, "Edited host A.\n");
    await expect(syncBackModifiedFiles(
      [{ path: relativePath, reason: "modified" }], outputDir, nextOutputDir,
      new Map([[nextOutputPath, nextSource]]), {}, { [relativePath]: originalSource },
    )).rejects.toThrow();
    expect(await Bun.file(originalSource).text()).toBe("Host A.\n");
    expect(await Bun.file(nextSource).text()).toBe("Host B.\n");
    expect(await Bun.file(nextOutputPath).text()).toBe("Host B.\n");
  });

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
