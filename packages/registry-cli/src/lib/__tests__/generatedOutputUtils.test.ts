import assert from "node:assert";
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  collectGeneratedOutputEntries,
  createGeneratedOutputManifest,
  createRuntimeDirectoryRegistry,
  getGeneratedOutputDrift,
  syncManagedGeneratedOutputs,
} from "../generatedOutputUtils";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "generated-output-utils-tests");
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

describe("generatedOutputUtils", () => {
  it("collects managed files, directories, and symlinks from generated output", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");

    await writeTestFile(repositoryRoot, ".output/opencode/package.json", '{"name":"managed"}\n');
    await mkdir(join(outputDir, "pi", "default", "sessions"), { recursive: true });
    await mkdir(join(outputDir, "pi", "developer"), { recursive: true });
    await symlink(join(outputDir, "pi", "default", "sessions"), join(outputDir, "pi", "developer", "sessions"));
    await writeTestFile(repositoryRoot, ".output/manifest.json", "ignored\n");

    const entries = await collectGeneratedOutputEntries(outputDir);
    const packageEntry = entries["opencode/package.json"];
    assert(packageEntry?.kind === "file");

    expect(entries).toEqual({
      "opencode": { kind: "directory" },
      "opencode/package.json": { kind: "file", checksum: packageEntry.checksum },
      "pi": { kind: "directory" },
      "pi/default": { kind: "directory" },
      "pi/default/sessions": { kind: "directory" },
      "pi/developer": { kind: "directory" },
      "pi/developer/sessions": { kind: "symlink", target: join(outputDir, "pi", "default", "sessions") },
    });
  });

  it("ignores unmanaged current output entries during drift checks", () => {
    const manifest = createGeneratedOutputManifest({
      "pi/default/APPEND_SYSTEM.md": { kind: "file", checksum: "managed" },
    });

    const drift = getGeneratedOutputDrift(manifest, {
      "pi/default/APPEND_SYSTEM.md": { kind: "file", checksum: "managed" },
      "pi/default/TEST": { kind: "file", checksum: "unmanaged" },
    });

    expect(drift).toEqual([]);
  });

  it("updates managed paths without deleting unrelated files", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");

    await writeTestFile(repositoryRoot, ".output/pi/default/prompts/old.md", "old\n");
    await writeTestFile(repositoryRoot, ".output/pi/default/prompts/TEST", "keep\n");
    await writeTestFile(repositoryRoot, ".tmp/generated-output-staging/pi/default/prompts/new.md", "new\n");

    await syncManagedGeneratedOutputs({
      nextEntries: await collectGeneratedOutputEntries(stagingDir),
      nextOutputDir: stagingDir,
      outputDir,
      previousManifest: createGeneratedOutputManifest({
        "pi/default/prompts/old.md": { kind: "file", checksum: "old-checksum" },
      }),
    });

    expect(await readFile(join(outputDir, "pi", "default", "prompts", "new.md"), "utf-8")).toBe("new\n");
    expect(await readFile(join(outputDir, "pi", "default", "prompts", "TEST"), "utf-8")).toBe("keep\n");
  });

  it("materializes managed symlinks during sync", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");

    await mkdir(join(stagingDir, "pi", "default", "sessions"), { recursive: true });
    await mkdir(join(stagingDir, "pi", "developer"), { recursive: true });
    await symlink(join(stagingDir, "pi", "default", "sessions"), join(stagingDir, "pi", "developer", "sessions"));

    await syncManagedGeneratedOutputs({
      nextEntries: await collectGeneratedOutputEntries(stagingDir),
      nextOutputDir: stagingDir,
      outputDir,
      previousManifest: null,
    });

    expect(await readlink(join(outputDir, "pi", "developer", "sessions"))).toBe(
      join(outputDir, "pi", "default", "sessions"),
    );
  });

  describe("runtime directories", () => {
    it("creates runtime directories under the staging root and records them relative to it", async () => {
      const repositoryRoot = await createTestDirectory();
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");
      const registry = createRuntimeDirectoryRegistry(stagingDir);

      await registry.ensureRuntimeDirectory(join(stagingDir, "claude-code", "default", "todos"));
      await registry.ensureRuntimeDirectory(join(stagingDir, "claude-code", "default", "sessions"));
      await registry.ensureRuntimeDirectory(join(stagingDir, "claude-code", "default", "todos"));

      expect(existsSync(join(stagingDir, "claude-code", "default", "todos"))).toBe(true);
      expect(existsSync(join(stagingDir, "claude-code", "default", "sessions"))).toBe(true);
      expect(registry.getRuntimeDirectoryPaths()).toEqual([
        "claude-code/default/sessions",
        "claude-code/default/todos",
      ]);
    });

    it("rejects runtime directories outside the staging root", async () => {
      const repositoryRoot = await createTestDirectory();
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");
      const registry = createRuntimeDirectoryRegistry(stagingDir);

      await expect(registry.ensureRuntimeDirectory(join(repositoryRoot, "elsewhere"))).rejects.toThrow(
        `Runtime directory must be inside the generated output root ${stagingDir}: ${join(repositoryRoot, "elsewhere")}`,
      );
    });

    it("leaves runtime directories and their contents out of the collected entries", async () => {
      const repositoryRoot = await createTestDirectory();
      const outputDir = join(repositoryRoot, ".output");

      await writeTestFile(repositoryRoot, ".output/claude-code/default/settings.json", "{}\n");
      await writeTestFile(repositoryRoot, ".output/claude-code/default/todos/task.json", "[]\n");
      await mkdir(join(outputDir, "claude-code", "default", "statsig"), { recursive: true });

      const entries = await collectGeneratedOutputEntries(outputDir, {
        runtimeDirectoryPaths: ["claude-code/default/statsig", "claude-code/default/todos"],
      });
      const settingsEntry = entries["claude-code/default/settings.json"];
      assert(settingsEntry?.kind === "file");

      expect(entries).toEqual({
        "claude-code": { kind: "directory" },
        "claude-code/default": { kind: "directory" },
        "claude-code/default/settings.json": { kind: "file", checksum: settingsEntry.checksum },
      });
    });

    it("does not report drift when a runtime directory disappears between builds", async () => {
      const repositoryRoot = await createTestDirectory();
      const outputDir = join(repositoryRoot, ".output");
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");
      const runtimeDirectoryPaths = ["claude-code/default/todos"];

      await writeTestFile(repositoryRoot, ".tmp/generated-output-staging/claude-code/default/settings.json", "{}\n");
      await mkdir(join(stagingDir, "claude-code", "default", "todos"), { recursive: true });

      const nextEntries = await collectGeneratedOutputEntries(stagingDir, { runtimeDirectoryPaths });
      await syncManagedGeneratedOutputs({
        nextEntries,
        nextOutputDir: stagingDir,
        outputDir,
        previousManifest: null,
        runtimeDirectoryPaths,
      });
      const manifest = createGeneratedOutputManifest(nextEntries);
      expect(existsSync(join(outputDir, "claude-code", "default", "todos"))).toBe(true);

      await rm(join(outputDir, "claude-code", "default", "todos"), { recursive: true, force: true });

      const currentEntries = await collectGeneratedOutputEntries(outputDir, { runtimeDirectoryPaths });
      expect(getGeneratedOutputDrift(manifest, currentEntries)).toEqual([]);
    });

    it("ignores runtime directories that an older manifest still tracks when computing drift", () => {
      const manifest = createGeneratedOutputManifest({
        "claude-code/default/settings.json": { kind: "file", checksum: "managed" },
        "claude-code/default/todos": { kind: "directory" },
      });

      const drift = getGeneratedOutputDrift(
        manifest,
        { "claude-code/default/settings.json": { kind: "file", checksum: "managed" } },
        { runtimeDirectoryPaths: ["claude-code/default/todos"] },
      );

      expect(drift).toEqual([]);
    });

    it("recreates missing runtime directories during sync without touching their contents", async () => {
      const repositoryRoot = await createTestDirectory();
      const outputDir = join(repositoryRoot, ".output");
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");
      const runtimeDirectoryPaths = ["claude-code/default/sessions", "claude-code/default/todos"];

      await writeTestFile(repositoryRoot, ".output/claude-code/default/sessions/history.jsonl", "keep\n");
      await mkdir(join(stagingDir, "claude-code", "default", "sessions"), { recursive: true });
      await mkdir(join(stagingDir, "claude-code", "default", "todos"), { recursive: true });

      await syncManagedGeneratedOutputs({
        nextEntries: await collectGeneratedOutputEntries(stagingDir, { runtimeDirectoryPaths }),
        nextOutputDir: stagingDir,
        outputDir,
        previousManifest: null,
        runtimeDirectoryPaths,
      });

      expect(await readFile(join(outputDir, "claude-code", "default", "sessions", "history.jsonl"), "utf-8")).toBe("keep\n");
      expect(existsSync(join(outputDir, "claude-code", "default", "todos"))).toBe(true);
    });

    it("keeps a runtime directory that an older manifest still tracked as managed", async () => {
      const repositoryRoot = await createTestDirectory();
      const outputDir = join(repositoryRoot, ".output");
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");
      const runtimeDirectoryPaths = ["claude-code/default/todos"];

      await mkdir(join(outputDir, "claude-code", "default", "todos"), { recursive: true });
      await mkdir(join(stagingDir, "claude-code", "default", "todos"), { recursive: true });

      await syncManagedGeneratedOutputs({
        nextEntries: await collectGeneratedOutputEntries(stagingDir, { runtimeDirectoryPaths }),
        nextOutputDir: stagingDir,
        outputDir,
        previousManifest: createGeneratedOutputManifest({
          "claude-code": { kind: "directory" },
          "claude-code/default": { kind: "directory" },
          "claude-code/default/todos": { kind: "directory" },
        }),
        runtimeDirectoryPaths,
      });

      expect(existsSync(join(outputDir, "claude-code", "default", "todos"))).toBe(true);
    });
  });
});
