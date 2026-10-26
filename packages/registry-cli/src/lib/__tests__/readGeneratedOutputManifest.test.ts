import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import type { IGeneratedOutputManifest } from "../generatedOutputUtils";
import { readGeneratedOutputManifest } from "../readGeneratedOutputManifest";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "read-generated-output-manifest-tests");
const createdDirectories: string[] = [];

async function createOutputDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const outputDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(outputDir);
  return outputDir;
}

afterAll(async () => {
  for (const createdDirectory of createdDirectories) {
    await rm(createdDirectory, { recursive: true, force: true });
  }
});

describe("readGeneratedOutputManifest", () => {
  it("returns null when no manifest has been written", async () => {
    expect(await readGeneratedOutputManifest(await createOutputDirectory())).toBeNull();
  });

  it("reads the managed entries and synced settings files", async () => {
    const outputDir = await createOutputDirectory();
    const manifest: IGeneratedOutputManifest = {
      version: 2,
      generatedAt: "2026-10-26T00:00:00.000Z",
      entries: {
        "codex/default/AGENTS.md": { kind: "file", checksum: "abc" },
        "codex/default/skills": { kind: "directory" },
        "codex/designer/rules": { kind: "symlink", target: "/repo/.output/codex/default/rules" },
      },
      syncedFilePaths: ["codex/default/config.toml"],
      sourcePaths: { "codex/default/AGENTS.md": "/repo/profiles/default/profile.yaml" },
      sourceChecksums: { "codex/default/AGENTS.md": "def" },
    };
    await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest), "utf-8");

    expect(await readGeneratedOutputManifest(outputDir)).toEqual(manifest);
  });

  it("converts a legacy file manifest", async () => {
    const outputDir = await createOutputDirectory();
    await writeFile(
      join(outputDir, ".generated-output-manifest.json"),
      JSON.stringify({ version: 1, generatedAt: "2026-01-01T00:00:00.000Z", files: { "opencode/opencode.jsonc": "abc" } }),
      "utf-8",
    );

    expect(await readGeneratedOutputManifest(outputDir)).toEqual({
      version: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      entries: { "opencode/opencode.jsonc": { kind: "file", checksum: "abc" } },
    });
  });

  it("rejects a manifest whose synced settings files are not paths", async () => {
    const outputDir = await createOutputDirectory();
    const manifestPath = join(outputDir, "manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify({ version: 2, generatedAt: "2026-10-26T00:00:00.000Z", entries: {}, syncedFilePaths: [42] }),
      "utf-8",
    );

    await expect(readGeneratedOutputManifest(outputDir)).rejects.toThrow(`Invalid generated output manifest: ${manifestPath}`);
  });
});
