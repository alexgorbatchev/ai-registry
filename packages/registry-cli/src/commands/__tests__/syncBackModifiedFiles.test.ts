import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { assertGeneratedOutputsAreSafeToReplace, syncBackModifiedFiles } from "../buildCommand";
import type { IGeneratedOutputDrift } from "../../lib/generatedOutputUtils";
import { copyDirectoryWithTemplateVariables } from "../../lib/harnessBuild";
import { collectGeneratedOutputEntries, createGeneratedOutputManifest } from "../../lib/generatedOutputUtils";

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
  it("preserves source edits hidden by identical rendered output", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const original = "<%- repo_root %>";
    const source = await writeTestFile(root, "source.md", root);
    const staged = await writeTestFile(stagingDir, "source.md", root);
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    const output = await writeTestFile(outputDir, "source.md", "harness edit");
    await expect(syncBackModifiedFiles(
      [{ path: "source.md", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), { repo_root: root }, {}, baseline,
      { "source.md": new Bun.CryptoHasher("sha256").update(original).digest("hex") },
    )).rejects.toThrow(`Cannot recover source.md: source ${source} changed since generation. Preserve both versions and reconcile their edits before retrying.`);
    expect(await Bun.file(source).text()).toBe(root);
    expect(await Bun.file(output).text()).toBe("harness edit");
  });

  it("preserves existing drift when the manifest has no source fingerprint", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "source.md", "original");
    const staged = await writeTestFile(stagingDir, "source.md", "original");
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    await writeTestFile(outputDir, "source.md", "harness edit");
    await expect(syncBackModifiedFiles(
      [{ path: "source.md", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), {}, {}, baseline,
    )).rejects.toThrow("Cannot recover source.md: no source fingerprint in the manifest. Preserve the generated edit and reconcile it into source before establishing a fresh baseline.");
    expect(await Bun.file(source).text()).toBe("original");
  });
  it("automatically recovers unattended edits while preserving runtime and staged files", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "settings.json", "original");
    const staged = await writeTestFile(stagingDir, "settings.json", "original");
    const manifest = createGeneratedOutputManifest(await collectGeneratedOutputEntries(stagingDir));
    manifest.sourceChecksums = { "settings.json": new Bun.CryptoHasher("sha256").update("original").digest("hex") };
    const output = await writeTestFile(outputDir, "settings.json", "harness edit");
    const session = await writeTestFile(outputDir, "sessions/active.jsonl", "session data");
    const auth = await writeTestFile(outputDir, "auth.json", "runtime data");

    expect(await assertGeneratedOutputsAreSafeToReplace(
      manifest, outputDir, stagingDir, new Map([[staged, source]]), {}, ["sessions"],
    )).toBe(true);
    expect(await Bun.file(source).text()).toBe("harness edit");
    expect(await Bun.file(output).text()).toBe("harness edit");
    expect(await Bun.file(staged).text()).toBe("original");
    expect(await Bun.file(session).text()).toBe("session data");
    expect(await Bun.file(auth).text()).toBe("runtime data");

    // Simulate the fresh generation pass, without invoking build or bootstrap.
    await Bun.write(staged, Bun.file(source));
    expect(await assertGeneratedOutputsAreSafeToReplace(
      manifest, outputDir, stagingDir, new Map([[staged, source]]), {}, ["sessions"], false,
    )).toBe(false);
  });

  it("propagates save failures and preserves source and harness edits", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "settings.json", "original");
    const staged = await writeTestFile(stagingDir, "settings.json", "original");
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    const output = await writeTestFile(outputDir, "settings.json", "harness edit");
    await expect(syncBackModifiedFiles(
      [{ path: "settings.json", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), {}, {}, baseline,
      { "settings.json": new Bun.CryptoHasher("sha256").update("original").digest("hex") },
      () => Promise.reject(new Error("save unavailable")),
    )).rejects.toThrow(`Cannot save recovered edit for settings.json to ${source}; generated output is preserved. Resolve the save failure before retrying.`);
    expect(await Bun.file(source).text()).toBe("original");
    expect(await Bun.file(output).text()).toBe("harness edit");
    expect(await Bun.file(staged).text()).toBe("original");
  });

  it("suspends repeated recovery before saving when regeneration already ran", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "settings.json", "original");
    const staged = await writeTestFile(stagingDir, "settings.json", "original");
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    const output = await writeTestFile(outputDir, "settings.json", "harness edit");
    await expect(syncBackModifiedFiles(
      [{ path: "settings.json", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), {}, {}, baseline,
      { "settings.json": new Bun.CryptoHasher("sha256").update("original").digest("hex") },
      undefined, false,
    )).rejects.toThrow("Generated files changed again during regeneration. Output application is suspended; preserve the edits and retry after reconciliation.");
    expect(await Bun.file(source).text()).toBe("original");
    expect(await Bun.file(output).text()).toBe("harness edit");
  });
  it("preserves simultaneous source and harness edits", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const staged = await writeTestFile(stagingDir, "settings.json", "original");
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    const source = await writeTestFile(root, "settings.json", "source edit");
    await Bun.write(staged, "source edit");
    const output = await writeTestFile(outputDir, "settings.json", "harness edit");

    await expect(syncBackModifiedFiles(
      [{ path: "settings.json", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), {}, {}, baseline,
    )).rejects.toThrow(`Cannot recover settings.json: source ${source} and generated output both changed. Preserve both versions and reconcile their edits before retrying.`);
    expect(await Bun.file(source).text()).toBe("source edit");
    expect(await Bun.file(output).text()).toBe("harness edit");
    expect(await Bun.file(staged).text()).toBe("source edit");
  });

  it("rejects divergent harness copies before saving either edit", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "shared.md", "original");
    const first = await writeTestFile(stagingDir, "first.md", "original");
    const second = await writeTestFile(stagingDir, "second.md", "original");
    const baseline = await collectGeneratedOutputEntries(stagingDir);
    await writeTestFile(outputDir, "first.md", "first edit");
    await writeTestFile(outputDir, "second.md", "second edit");

    await expect(syncBackModifiedFiles(
      [{ path: "first.md", reason: "modified" }, { path: "second.md", reason: "modified" }],
      outputDir, stagingDir, new Map([[first, source], [second, source]]), {}, {}, baseline,
      { "first.md": new Bun.CryptoHasher("sha256").update("original").digest("hex"),
        "second.md": new Bun.CryptoHasher("sha256").update("original").digest("hex") },
    )).rejects.toThrow(`Cannot recover second.md: harness copies first.md and second.md contain conflicting edits for ${source}. Preserve both copies and reconcile them before retrying.`);
    expect(await Bun.file(source).text()).toBe("original");
    expect(await Bun.file(first).text()).toBe("original");
    expect(await Bun.file(second).text()).toBe("original");
  });

  it("does not recover without a verified generated baseline", async () => {
    const root = await createTestDirectory();
    const outputDir = join(root, "output");
    const stagingDir = join(root, "staging");
    const source = await writeTestFile(root, "source.md", "original");
    const staged = await writeTestFile(stagingDir, "source.md", "original");
    await writeTestFile(outputDir, "source.md", "harness edit");
    await expect(syncBackModifiedFiles(
      [{ path: "source.md", reason: "modified" }], outputDir, stagingDir,
      new Map([[staged, source]]), {},
    )).rejects.toThrow();
    expect(await Bun.file(source).text()).toBe("original");
  });
  it.each([
    '<%- include("/shared.md") %>',
    '<% if (true) { %>content<% } %>',
    '<%- env("VALUE") %>',
    '<%%- repo_root %>',
  ])("preserves EJS source and all outputs when recovery cannot reconstruct %s", async (template) => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, "output");
    const nextOutputDir = join(repositoryRoot, "staging");
    const plainSource = await writeTestFile(repositoryRoot, "plain.md", "Original plain text");
    const templateSource = await writeTestFile(repositoryRoot, "template.md", template);
    const plainOutput = await writeTestFile(nextOutputDir, "plain.md", "Original plain text");
    const templateOutput = await writeTestFile(nextOutputDir, "template.md", "Rendered template");
    await writeTestFile(outputDir, "plain.md", "Edited plain text");
    await writeTestFile(outputDir, "template.md", "Edited rendered text");
    const baseline = await collectGeneratedOutputEntries(nextOutputDir);

    await expect(syncBackModifiedFiles(
      [{ path: "plain.md", reason: "modified" }, { path: "template.md", reason: "modified" }],
      outputDir, nextOutputDir,
      new Map([[plainOutput, plainSource], [templateOutput, templateSource]]), {}, {}, baseline,
      { "plain.md": new Bun.CryptoHasher("sha256").update("Original plain text").digest("hex") },
    )).rejects.toThrow(`Cannot sync generated edits for template.md: edit the EJS template at ${templateSource} directly; expressions, includes, and control flow cannot be reconstructed from rendered output.`);
    expect(await Bun.file(plainSource).text()).toBe("Original plain text");
    expect(await Bun.file(templateSource).text()).toBe(template);
    expect(await Bun.file(plainOutput).text()).toBe("Original plain text");
    expect(await Bun.file(templateOutput).text()).toBe("Rendered template");
  });

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

    const baseline = await collectGeneratedOutputEntries(nextOutputDir);
    await syncBackModifiedFiles([{ path: relativePath, reason: "modified" }], outputDir, nextOutputDir, sourcePaths, {}, {}, baseline,
      { [relativePath]: new Bun.CryptoHasher("sha256").update(await Bun.file(variantPath).bytes()).digest("hex") });

    expect(await Bun.file(variantPath).text()).toBe("---\nname: example\ndescription: Example\nauthor: upstream\n---\nEdited host A.\n");
    expect(await Bun.file(defaultPath).text()).toBe("---\nname: example\ndescription: Example\nauthor: upstream\n---\nDefault.\n");
    expect(await Bun.file(otherPath).text()).toBe("Host B.\n");
    expect(await Bun.file(join(outputDir, relativePath)).text()).toBe(editedContent);
    expect(await Bun.file(join(nextOutputDir, relativePath)).text()).toBe("---\nname: example\ndescription: Example\nauthor: upstream\n---\nHost A.\n");
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
    await writeTestFile(sourceDir, sourceFileRelativePath, "Original content with <%- skills_dir %>");

    // Output dir has the modified file with absolute path resolved
    const outputRelativePath = "pi/default/skills/my-skill/SKILL.md";
    const resolvedPathText = `Modified content with ${sourceDir}`;
    await writeTestFile(outputDir, outputRelativePath, resolvedPathText);

    // Staging dir has the compiled file before modifications
    const nextOutputPath = join(nextOutputDir, outputRelativePath);
    await writeTestFile(nextOutputDir, outputRelativePath, `Original content with ${sourceDir}`);
    const baseline = await collectGeneratedOutputEntries(nextOutputDir);

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
      {}, baseline, { [outputRelativePath]: new Bun.CryptoHasher("sha256").update(await Bun.file(sourceFilePath).bytes()).digest("hex") },
    );

    // 1. Source file should have been updated with the reversed content
    const sourceContent = await readFile(sourceFilePath, "utf-8");
    expect(sourceContent).toBe("Modified content with <%- skills_dir %>");

    // Regeneration is required; recovery never changes the old staged copy.
    const stagingContent = await readFile(nextOutputPath, "utf-8");
    expect(stagingContent).toBe(`Original content with ${sourceDir}`);
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

    await expect(syncBackModifiedFiles(
      drift,
      outputDir,
      nextOutputDir,
      sourcePathByOutputPath,
      {},
    )).rejects.toThrow();

    // Staging file should NOT be modified
    const stagingContent = await readFile(nextOutputPath, "utf-8");
    expect(stagingContent).toBe("Original compiled");
  });
});
