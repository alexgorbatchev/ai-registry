import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";

import {
  assertMissingPiOutputPath,
  assertSupportedPiManifest,
} from "../profileOutputRules";

const TEST_ROOT = join(import.meta.dir, "..", ".tmp", "profile-output-rules-tests");
const createdDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  const testDir = await mkdtemp(join(TEST_ROOT, "case-"));
  createdDirectories.push(testDir);
  return testDir;
}

describe("assertSupportedPiManifest", () => {
  it("allows manifests that only use fields Pi can map directly", () => {
    expect(() => assertSupportedPiManifest({
      commands: ["*"],
      description: "default",
      skills: ["*"],
      system_prompt: "Use the repo rules.",
    }, "default")).not.toThrow();
  });

  it("rejects non-empty tools configuration", () => {
    expect(() => assertSupportedPiManifest({
      tools: { bash: true },
    }, "developer")).toThrow(
      'Pi harness does not support manifest.tools yet for profile "developer".',
    );
  });

  it("rejects non-empty permission configuration", () => {
    expect(() => assertSupportedPiManifest({
      permission: { bash: "allow" },
    }, "developer")).toThrow(
      'Pi harness does not support manifest.permission yet for profile "developer".',
    );
  });
});

describe("assertMissingPiOutputPath", () => {
  afterAll(async () => {
    for (const createdDirectory of createdDirectories) {
      await rm(createdDirectory, { force: true, recursive: true });
    }
  });

  it("allows a missing output path", () => {
    expect(() => assertMissingPiOutputPath("/tmp/does-not-exist", "test asset")).not.toThrow();
  });

  it("rejects collisions in generated prompts or skills", async () => {
    const testDir = await createTestDirectory();
    const existingPath = join(testDir, "skills", "pi-config", "SKILL.md");
    await mkdir(join(testDir, "skills", "pi-config"), { recursive: true });
    await writeFile(existingPath, "existing\n", "utf-8");

    expect(() => assertMissingPiOutputPath(existingPath, "profile-local skill pi-config for profile default")).toThrow(
      `Cannot stage profile-local skill pi-config for profile default because the output path already exists: ${existingPath}`,
    );
  });
});
