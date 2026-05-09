import assert from "node:assert";
import { afterAll, describe, expect, it } from "bun:test";
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
});
