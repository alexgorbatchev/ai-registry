import assert from "node:assert";
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  collectGeneratedOutputEntries,
  createGeneratedOutputManifest,
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
  it("preserves edits arriving after recovery preflight", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, "output");
    const stagingDir = join(repositoryRoot, "staging");
    const outputPath = await writeTestFile(outputDir, "settings.json", "original");
    const expectedCurrentEntries = await collectGeneratedOutputEntries(outputDir);
    const previousManifest = createGeneratedOutputManifest(expectedCurrentEntries);
    const session = await writeTestFile(outputDir, "sessions/active.jsonl", "session data");
    await writeTestFile(stagingDir, "settings.json", "source update");
    await Bun.write(outputPath, "new harness edit");

    await expect(
      syncManagedGeneratedOutputs({
        nextEntries: await collectGeneratedOutputEntries(stagingDir),
        nextOutputDir: stagingDir,
        outputDir,
        previousManifest,
        expectedCurrentEntries,
      }),
    ).rejects.toThrow(
      "Output application suspended: settings.json changed after recovery preflight. Preserve its edits and retry reconciliation.",
    );
    expect(await Bun.file(outputPath).text()).toBe("new harness edit");
    expect(await Bun.file(session).text()).toBe("session data");
  });

  it("applies an unchanged preflight while preserving unmanaged files written after it", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, "output");
    const stagingDir = join(repositoryRoot, "staging");
    const outputPath = await writeTestFile(outputDir, "settings.json", "original");
    const expectedCurrentEntries = await collectGeneratedOutputEntries(outputDir);
    await writeTestFile(stagingDir, "settings.json", "source update");
    const session = await writeTestFile(outputDir, "sessions/active.jsonl", "new session data");
    await syncManagedGeneratedOutputs({
      nextEntries: await collectGeneratedOutputEntries(stagingDir),
      nextOutputDir: stagingDir,
      outputDir,
      previousManifest: createGeneratedOutputManifest(expectedCurrentEntries),
      expectedCurrentEntries,
    });
    expect(await Bun.file(outputPath).text()).toBe("source update");
    expect(await Bun.file(session).text()).toBe("new session data");
  });
  it("collects managed files, directories, and symlinks from generated output", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");

    await writeTestFile(repositoryRoot, ".output/opencode/package.json", '{"name":"managed"}\n');
    await mkdir(join(outputDir, "pi", "sessions"), { recursive: true });
    await symlink(join(outputDir, "pi", "sessions"), join(outputDir, "pi", "linked-sessions"));
    await writeTestFile(repositoryRoot, ".output/manifest.json", "ignored\n");

    const entries = await collectGeneratedOutputEntries(outputDir);
    const packageEntry = entries["opencode/package.json"];
    assert(packageEntry?.kind === "file");

    expect(entries).toEqual({
      opencode: { kind: "directory" },
      "opencode/package.json": { kind: "file", checksum: packageEntry.checksum },
      pi: { kind: "directory" },
      "pi/linked-sessions": { kind: "symlink", target: join(outputDir, "pi", "sessions") },
      "pi/sessions": { kind: "directory" },
    });
  });

  it("ignores unmanaged current output entries during drift checks", () => {
    const manifest = createGeneratedOutputManifest({
      "pi/APPEND_SYSTEM.md": { kind: "file", checksum: "managed" },
    });

    const drift = getGeneratedOutputDrift(manifest, {
      "pi/APPEND_SYSTEM.md": { kind: "file", checksum: "managed" },
      "pi/TEST": { kind: "file", checksum: "unmanaged" },
    });

    expect(drift).toEqual([]);
  });

  it("updates managed paths without deleting unrelated files", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");

    await writeTestFile(repositoryRoot, ".output/pi/prompts/old.md", "old\n");
    await writeTestFile(repositoryRoot, ".output/pi/prompts/TEST", "keep\n");
    await writeTestFile(repositoryRoot, ".tmp/generated-output-staging/pi/prompts/new.md", "new\n");

    await syncManagedGeneratedOutputs({
      nextEntries: await collectGeneratedOutputEntries(stagingDir),
      nextOutputDir: stagingDir,
      outputDir,
      previousManifest: createGeneratedOutputManifest({
        "pi/prompts/old.md": { kind: "file", checksum: "old-checksum" },
      }),
    });

    expect(await readFile(join(outputDir, "pi", "prompts", "new.md"), "utf-8")).toBe("new\n");
    expect(await readFile(join(outputDir, "pi", "prompts", "TEST"), "utf-8")).toBe("keep\n");
  });

  it("materializes managed symlinks during sync", async () => {
    const repositoryRoot = await createTestDirectory();
    const outputDir = join(repositoryRoot, ".output");
    const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");

    await mkdir(join(stagingDir, "pi", "sessions"), { recursive: true });
    await symlink(join(stagingDir, "pi", "sessions"), join(stagingDir, "pi", "linked-sessions"));

    await syncManagedGeneratedOutputs({
      nextEntries: await collectGeneratedOutputEntries(stagingDir),
      nextOutputDir: stagingDir,
      outputDir,
      previousManifest: null,
    });

    expect(await readlink(join(outputDir, "pi", "linked-sessions"))).toBe(join(outputDir, "pi", "sessions"));
  });

  describe("synced settings files", () => {
    const syncedFilePaths = ["claude-code/settings.json"];

    it("leaves synced settings files out of the collected entries", async () => {
      const repositoryRoot = await createTestDirectory();
      await writeTestFile(repositoryRoot, "claude-code/settings.json", "{}\n");
      await writeTestFile(repositoryRoot, "claude-code/CLAUDE.md", "# Memory\n");

      const entries = await collectGeneratedOutputEntries(repositoryRoot, { syncedFilePaths });

      expect(Object.keys(entries)).toEqual(["claude-code", "claude-code/CLAUDE.md"]);
    });

    it("does not report drift when the harness edits a synced settings file an older manifest tracked", () => {
      const manifest = createGeneratedOutputManifest({
        "claude-code/settings.json": { kind: "file", checksum: "generated" },
      });

      const drift = getGeneratedOutputDrift(
        manifest,
        { "claude-code/settings.json": { kind: "file", checksum: "edited-by-harness" } },
        { syncedFilePaths },
      );

      expect(drift).toEqual([]);
    });

    it("preserves a synced settings edit after preflight even when an older manifest tracked it", async () => {
      const repositoryRoot = await createTestDirectory();
      const outputDir = join(repositoryRoot, ".output");
      const stagingDir = join(repositoryRoot, ".tmp", "generated-output-staging");

      await writeTestFile(repositoryRoot, ".output/claude-code/settings.json", '{ "model": "opus" }\n');
      await writeTestFile(repositoryRoot, ".tmp/generated-output-staging/claude-code/settings.json", "{}\n");
      const expectedCurrentEntries = await collectGeneratedOutputEntries(outputDir, { syncedFilePaths });
      await writeTestFile(repositoryRoot, ".output/claude-code/settings.json", '{ "model": "sonnet" }\n');

      await syncManagedGeneratedOutputs({
        nextEntries: await collectGeneratedOutputEntries(stagingDir, { syncedFilePaths }),
        nextOutputDir: stagingDir,
        outputDir,
        previousManifest: createGeneratedOutputManifest({
          "claude-code": { kind: "directory" },
          "claude-code/settings.json": { kind: "file", checksum: "generated" },
        }),
        syncedFilePaths,
        expectedCurrentEntries,
      });

      expect(await readFile(join(outputDir, "claude-code", "settings.json"), "utf-8")).toBe('{ "model": "sonnet" }\n');
    });
  });
});
